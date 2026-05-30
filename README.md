# Grab Receipt — Receipts Clearing House (MVP)

Snap a receipt → on-device OCR → glance + pick an entity → it lands in Google
Drive + a Google Sheet with a confidence audit trail. No typing amounts on the
happy path. Free, private, on-device OCR.

```
iPhone ▸ Shortcut "Grab Receipt"  ──POST──▶  Apps Script /exec  ──▶  Drive photo + Sheet row
        (Apple Vision OCR, on-device)        (runs as you)
```

Full domain model: [`CONTEXT.md`](./CONTEXT.md). Decisions: [`docs/adr/`](./docs/adr/).

## Repo layout

| Path | What |
|------|------|
| `apps-script/Code.gs` | The Web App: image→Drive, row→Sheet, token auth, `setup()` bootstrap |
| `apps-script/appsscript.json` | Manifest (scopes + web app config) |
| `apps-script/README.md` | Deploy the endpoint (do this first) |
| `shortcut/BUILD.md` | Step-by-step iOS Shortcut build |
| `shortcut/ocr-parsing.md` | Parsing rules + heuristic confidence model |
| `shortcut/payload-schema.json` | The POST contract between Shortcut and Apps Script |
| `CONTEXT.md` | Domain glossary |
| `docs/adr/` | Architecture decisions (3) |

## Setup order

1. **Deploy the endpoint** — [`apps-script/README.md`](./apps-script/README.md).
   Run `setup()`, then deploy as a Web App. You get an **Endpoint URL** + a **Token**.
2. **Build the Shortcut** — [`shortcut/BUILD.md`](./shortcut/BUILD.md). Paste the
   Endpoint + Token into the two config actions.
3. **Test** — run it on a real receipt; confirm the notification, the Sheet row,
   and the Drive photo.

## Entity list (v1, hardcoded in the Shortcut)

`Purple Pastures` · `Lithos` · `SGO` · `NWHub` · `Other` ·
`Unassigned` · `SPLIT`

> **Placeholder mapping from the brief:** `Ranch` → **Purple Pastures**;
> `[wife's business]` → **SGO** (StoneGynOnc). These are drawn from the entities named in
> the brief's Problem statement. **Rename freely** — they're just lines in the
> Shortcut's `Choose from List` action (Section E, step 11 of BUILD.md). The Apps
> Script doesn't hardcode the list, so editing the Shortcut is all it takes.
> `Household` is still a legal value in the payload schema but is omitted from the
> v1 picker by choice — add a line to bring it back.

- **SPLIT** = one receipt covering multiple entities. Saves as a single row with
  **Needs Split = TRUE** and Category auto-set to **Mixed**; reconcile later by
  hand in the Sheet. No line-item parsing in MVP.

## Advanced field defaults

The main review path shows only **Vendor, Amount, Entity, Note**. Everything else
is behind one **Advanced…** tap and uses these defaults when you skip it:

| Field | Default when Advanced is skipped |
|-------|----------------------------------|
| **Date** | OCR'd date if a date token was found; otherwise **today** (`yyyy-MM-dd`) |
| **Category** | `Uncategorized` (or `Mixed` when Entity = SPLIT) |
| **OCR confidence** (Date/Vendor/Total) | computed automatically, stored read-only |

Category starter list (edit in the Shortcut): Uncategorized, Groceries, Fuel,
Supplies, Equipment, Meals & Entertainment, Travel, Utilities, Professional
Services, Medical, Mixed.

## Data model — `Receipts` sheet tab

| Column | Source |
|--------|--------|
| Timestamp | server time at submit |
| Date | OCR, reviewed (or today) |
| Vendor | OCR, reviewed |
| Total | OCR (largest amount), reviewed |
| Entity | user-selected (can be `SPLIT`) |
| Category | user-selected (can be `Mixed`); not required |
| OCR Confidence: Date (%) | heuristic, read-only |
| OCR Confidence: Vendor (%) | heuristic, read-only |
| OCR Confidence: Total (%) | heuristic, read-only |
| Image URL | clickable Drive link |
| Notes | optional manual |
| Needs Split | auto-`TRUE` when Entity = `SPLIT` |

## Drive structure

```
Receipts/                         ← FOLDER_ID from setup()
  2026/                           ← auto-created per year (USE_YEAR_SUBFOLDERS)
    20260523-142031_Purple Pastures_Wilco-Farm-Store.jpg
    ...
```

Filename: `<yyyyMMdd-HHmmss>_<Entity>_<sanitized-vendor>.jpg`. Photos are link-
viewable so the Sheet's Image URL resolves on tap (toggle off in `Code.gs` for
owner-only links).

## About "OCR confidence" — read this

Shortcuts' on-device Vision OCR returns **text only**; Apple does **not** expose
per-field recognition confidence to Shortcuts. The confidence percentages here are
a **heuristic** — how sure the *parser* is it grabbed the right field — not
Vision's raw confidence. They're useful for flagging fields to double-check and as
an audit trail, but don't read them as ground-truth recognition accuracy. Details
and the Phase-2 path (a native Swift App Intent) are in
[`docs/adr/0001-on-device-ocr-heuristic-confidence.md`](./docs/adr/0001-on-device-ocr-heuristic-confidence.md).

## Known limits (MVP)

- No line-item parsing — totals only.
- Splits are manual (`SPLIT`/`Mixed` flags; reconcile in the Sheet).
- Crumpled/faded/thermal receipts → low confidence; manual override always available.
- One photo per receipt.
