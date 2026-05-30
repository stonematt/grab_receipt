/**
 * Receipts Clearing House — Apps Script append endpoint.
 *
 * Deployed as a Web App. The iOS Shortcut POSTs a Pass-1 capture payload here; this
 * script:
 *   1. saves the receipt photo to a Drive folder (year-bucketed), and
 *   2. appends a row to the Receipts sheet (Source=heuristic, Processed=FALSE).
 *
 * Vendor + category are filled later by the Pass-2 home-host vision LLM, which
 * matches the row on Image URL and sets Source=llm, Processed=TRUE. See
 * docs/adr/0004-two-pass-extraction-capture-and-llm.md.
 *
 * One-time setup: run setup() from the editor, copy the logged IDs/token,
 * then Deploy ▸ New deployment ▸ Web app. See apps-script/README.md.
 */

const PROP = PropertiesService.getScriptProperties();

const KEYS = {
  SHEET_ID: 'SHEET_ID',
  FOLDER_ID: 'FOLDER_ID',
  TOKEN: 'SHARED_TOKEN',
};

const SHEET_NAME = 'Receipts';

// grab_receipt_images/2026/… keeps the root folder from ballooning past a few thousand files.
const USE_YEAR_SUBFOLDERS = true;

// Makes the Image URL clickable straight from the Sheet. Flip to false for a
// private (owner-only) link if your Drive lives in a restricted Workspace org.
const SHARE_IMAGES_ANYONE_WITH_LINK = true;

const HEADERS = [
  'Timestamp',
  'Date',
  'Vendor',
  'Total',
  'Entity',
  'Category',
  'Image URL',
  'Notes',
  'Needs Split',
  'Source',
  'Processed',
];

/**
 * Run ONCE from the editor (Run ▸ setup). Creates the spreadsheet + Drive folder
 * if not already configured, writes the header row, seeds a shared token, and
 * logs everything you need for the Shortcut and the deployment.
 */
function setup() {
  // --- Spreadsheet ---
  let sheetId = PROP.getProperty(KEYS.SHEET_ID);
  let ss;
  if (sheetId) {
    ss = SpreadsheetApp.openById(sheetId);
  } else {
    ss = SpreadsheetApp.create('grab_receipt');
    sheetId = ss.getId();
    PROP.setProperty(KEYS.SHEET_ID, sheetId);
  }

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.getActiveSheet().setName(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else {
    // ADR-0004 changed the schema (dropped 3 OCR-confidence columns, added
    // Source + Processed). setup() won't rewrite a non-empty sheet, so warn loudly
    // if the existing header no longer matches — otherwise new rows misalign.
    const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (existing.join('') !== HEADERS.join('')) {
      Logger.log('⚠️  Sheet header does NOT match the current schema. New rows will ' +
        'misalign. Clear the Receipts tab (delete all rows incl. header) and re-run ' +
        'setup(), or hand-edit the header row to: ' + HEADERS.join(' · '));
    }
  }

  // --- Drive folder ---
  let folderId = PROP.getProperty(KEYS.FOLDER_ID);
  if (!folderId) {
    folderId = DriveApp.createFolder('grab_receipt_images').getId();
    PROP.setProperty(KEYS.FOLDER_ID, folderId);
  }

  // --- Shared token ---
  let token = PROP.getProperty(KEYS.TOKEN);
  if (!token) {
    token = Utilities.getUuid();
    PROP.setProperty(KEYS.TOKEN, token);
  }

  Logger.log('====== Receipts Clearing House — setup complete ======');
  Logger.log('SHEET_ID:    %s', sheetId);
  Logger.log('Sheet URL:   %s', ss.getUrl());
  Logger.log('FOLDER_ID:   %s', folderId);
  Logger.log('Drive URL:   %s', DriveApp.getFolderById(folderId).getUrl());
  Logger.log('SHARED_TOKEN (paste into the Shortcut Token field): %s', token);
  Logger.log('Next: Deploy ▸ New deployment ▸ Web app ▸ Execute as: Me ▸ Who has access: Anyone');
}

/** Health check — open the /exec URL in a browser to confirm the deployment. */
function doGet() {
  const configured = !!(PROP.getProperty(KEYS.SHEET_ID) && PROP.getProperty(KEYS.FOLDER_ID));
  return json_({ ok: true, service: 'receipts-clearing-house', configured: configured });
}

/** Append endpoint. Receives the Shortcut's JSON payload. */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'empty_body' });
    }
    const data = JSON.parse(e.postData.contents);

    // --- auth ---
    const expected = PROP.getProperty(KEYS.TOKEN);
    if (!expected || data.token !== expected) {
      return json_({ ok: false, error: 'unauthorized' });
    }

    const sheetId = PROP.getProperty(KEYS.SHEET_ID);
    const folderId = PROP.getProperty(KEYS.FOLDER_ID);
    if (!sheetId || !folderId) {
      return json_({ ok: false, error: 'not_configured_run_setup' });
    }

    const now = new Date();
    const tz = Session.getScriptTimeZone();

    // --- Pass-1 capture fields (mirror the Shortcut) ---
    // Vendor + Category are intentionally left blank here; Pass 2 fills them.
    const vendor = String(data.vendor || '').trim();
    const total = data.total != null && data.total !== '' ? Number(data.total) : '';
    const entity = String(data.entity || 'Unassigned').trim() || 'Unassigned';
    const category = String(data.category || '').trim();
    const note = String(data.note || '');
    const dateStr = String(data.date || Utilities.formatDate(now, tz, 'yyyy-MM-dd'));
    const needsSplit = entity.toUpperCase() === 'SPLIT';
    const source = 'heuristic';
    const processed = false;

    // --- image -> Drive ---
    let imageUrl = '';
    if (data.imageBase64) {
      const folder = targetFolder_(folderId, now, tz);
      const mime = data.imageMime || 'image/jpeg';
      const ext = mime.indexOf('png') >= 0 ? 'png' : 'jpg';
      const safeVendor =
        vendor.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'receipt';
      const stamp = Utilities.formatDate(now, tz, 'yyyyMMdd-HHmmss');
      const name = stamp + '_' + entity + '_' + safeVendor + '.' + ext;
      const blob = Utilities.newBlob(Utilities.base64Decode(data.imageBase64), mime, name);
      const file = folder.createFile(blob);
      if (SHARE_IMAGES_ANYONE_WITH_LINK) {
        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (shareErr) {
          // Workspace policy may forbid anyone-with-link; the row still saves with an owner-only URL.
        }
      }
      imageUrl = file.getUrl();
    }

    // --- append row ---
    const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(SHEET_NAME);
    sheet.appendRow([
      now, dateStr, vendor, total, entity, category,
      imageUrl, note, needsSplit, source, processed,
    ]);

    return json_({
      ok: true,
      total: total,
      entity: entity,
      needsSplit: needsSplit,
      imageUrl: imageUrl,
      processed: processed,
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** Resolve the destination folder, creating a YYYY subfolder when enabled. */
function targetFolder_(rootId, when, tz) {
  const root = DriveApp.getFolderById(rootId);
  if (!USE_YEAR_SUBFOLDERS) return root;
  const year = Utilities.formatDate(when, tz, 'yyyy');
  const it = root.getFoldersByName(year);
  return it.hasNext() ? it.next() : root.createFolder(year);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
