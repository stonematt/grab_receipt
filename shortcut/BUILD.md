# Build the "Grab Receipt" Shortcut

Step-by-step, action-by-action. iOS 16+ (the **Extract Text from Image** action
is iOS 16+). Build it once on your iPhone; it takes ~20 minutes.

> **Why hand-build instead of a `.shortcut` file?** A distributable `.shortcut`
> is a signed binary plist; it can't be reliably hand-authored off-device, and an
> unsigned one often won't import. The brief explicitly allows build instructions
> as the deliverable. See `docs/adr/0003-minimal-review-ui-sequential-prompts.md`.

## Before you start

- Deploy the Apps Script Web App first (see [`../apps-script/README.md`](../apps-script/README.md)).
  Have two strings ready:
  - **Endpoint** — the `/exec` Web app URL.
  - **Token** — the `SHARED_TOKEN` from `setup()`.
- Settings ▸ Shortcuts ▸ enable **Allow Running Scripts** (on by default).

## The path you're building toward

snap → **Submit**. Two taps. Total + date are pulled automatically; the image saves
and the row posts. Entity + Note live behind one **Add details…** tap and are
skipped on the happy path. Vendor + category are filled later by the home-host
vision LLM (Pass 2 — see `docs/adr/0004-two-pass-extraction-capture-and-llm.md`),
not on the phone.

---

## Section A — Config (edit these two later, never the logic)

1. **Text** → paste your `/exec` **Endpoint** URL.
   → **Set Variable** `Endpoint`.
2. **Text** → paste your **Token**.
   → **Set Variable** `Token`.

## Section B — Capture + OCR (on-device)

3. **Take Photo**. Turn **Show Camera Preview** on.
   → **Set Variable** `Photo`.
   - *Alternative for crumpled receipts:* use **Scan Document** instead, then add
     **Get Item from List ▸ First Item** to grab page 1, and Set Variable `Photo`.
4. **Extract Text from Image** — Image: `Photo`.
   → **Set Variable** `OCRText`.

## Section C — Parse total (largest currency amount, automatic)

5. **Replace Text** — Find `,` Replace with *(empty)* in `OCRText`. Regex **off**.
   → **Set Variable** `CleanText`. *(handles `1,234.56` → `1234.56`)*
6. **Match Text** — Text: `CleanText`, Regex: `\d+\.\d{2}`
   → magic variable, call it **Matches**.
7. **If** `Matches` **has any value**:
   - **Get Numbers from Input** — Input: `Matches`.
   - **Calculate Statistics** — Operation: **Maximum**, Input: the numbers.
     → **Set Variable** `Total`.
   **Otherwise**:
   - **Set Variable** `Total` to *(empty text)*.
   - **End If**

> No confidence score, no keyword check — `Total` is **provisional**. Pass 2's
> vision LLM corrects it (notably the cash-receipt tendered-vs-total blind spot).

## Section D — Parse date (first date token, else today, automatic)

8. **Match Text** — Text: `OCRText`, Regex:
   `(?i)\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|[A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})\b`
   → magic variable **DateMatches**.
9. **If** `DateMatches` **has any value**:
   - **Get Item from List** — **First Item** from `DateMatches` → **Set Variable** `Date`.
   **Otherwise**:
   - **Format Date** — Date: **Current Date**, Format: **Custom** `yyyy-MM-dd`
     → **Set Variable** `Date`.
   - **End If**

## Section E — Optional details (Submit | Add details…)

Set defaults first so a straight **Submit** posts a complete row:

10. **Set Variable** `Entity` = `Unassigned`.
11. **Set Variable** `Note` = *(empty text)*.
12. **Choose from Menu** — Prompt: `Submit?` — two menu items, in this order:
    - **Submit** — *(leave this case empty; snap-and-go falls straight through)*
    - **Add details…** — put these inside this case:
      1. **Choose from List** — Prompt `Entity` — items (one per line):
         ```
         Household
         Lithos
         Purple Pastures
         StoneGynOnc
         Northwest Hub
         Other
         SPLIT
         Unassigned
         ```
         → **Set Variable** `Entity`.
      2. **Ask for Input** — **Text** — Prompt `Note (optional)` — Default Answer *(empty)*
         → **Set Variable** `Note`. *(Tap Done to skip.)*
    - **End Menu**

> Vendor + category are **not** asked here — Pass 2 fills them. `SPLIT` still flags
> `Needs Split = TRUE` server-side (the Apps Script sets it from the entity value).

## Section F — Encode + send

13. **Base64 Encode** — Input: `Photo`.
    → **Set Variable** `ImageB64`.
14. **Get Contents of URL** — URL: `Endpoint`
    - **Method: POST**
    - **Request Body: JSON** — add these fields (key → value):

      | Key          | Value (variable / literal) |
      |--------------|----------------------------|
      | `token`      | `Token`                    |
      | `total`      | `Total`                    |
      | `entity`     | `Entity`                   |
      | `note`       | `Note`                     |
      | `date`       | `Date`                     |
      | `imageMime`  | `image/jpeg` (literal text)|
      | `imageBase64`| `ImageB64`                 |

    → magic variable **Response**.

## Section G — Confirm

15. **Get Dictionary from Input** — Input: `Response`.
16. **Get Dictionary Value** — Get **Value** for **Key** `error`
    → magic variable **ErrVal**.
17. **If** `ErrVal` **has any value**:
    - **Show Alert** — Title `⚠️ Save failed` — Message: `ErrVal`. *(turn off "Show Cancel")*
    **Otherwise**:
    - **Show Notification** — Body: `✅ Saved  ${Total}  →  {Entity}`
      (insert variables inline). *(Vendor lands later, via Pass 2.)*
    - **End If**

---

## Name it + make it fast to launch

- Rename the Shortcut **Grab Receipt**, pick an icon (🧾).
- **Add to Home Screen** for a one-tap icon, and/or
- Settings ▸ **Action Button** (iPhone 15 Pro+) → Shortcut → Grab Receipt, or
- Add to the **Lock Screen / Control Center** for instant capture.

## Testing without spending a real receipt

- Run it, photograph any printed receipt (or a receipt image on another screen).
- Confirm the **Show Notification** fires, then check the Sheet for a new row and
  the Drive `grab_receipt_images/<year>/` folder for the JPEG.
- To test the endpoint alone, open the `/exec` URL in Safari — it should return
  `{"ok":true,...,"configured":true}`.

## Common gotchas

- **Total is wrong / blank** — the "largest number" heuristic missed (faded total,
  or a cash receipt where the *tendered* amount is larger). It's provisional by
  design (no Amount prompt at capture — snap-and-go); Pass 2's vision LLM corrects
  it, or fix it directly in the Sheet.
- **Vendor is blank in the Sheet** — expected. Vendor + category are filled by
  Pass 2 (home-host vision LLM), not on the phone. Rows show `Processed = FALSE`
  until then.
- **`unauthorized` alert** — the `Token` text doesn't match the script's
  `SHARED_TOKEN`. Re-copy it from the `setup()` log.
- **Nothing appends but no error** — confirm the deployment access is **Anyone**
  and you re-deployed a **New version** after any code edit.
- **Curl test shows "unable to open the file at this time"** — not a permissions
  problem. Apps Script returns the response via a 302 to a GET-only
  `script.googleusercontent.com/macros/echo` URL; `curl -X POST -L` re-POSTs to it
  and gets a `405`. Drop `-X POST` (use plain `--data`) so curl follows the redirect
  as GET. The Shortcut's **Get Contents of URL** already does this, so it's unaffected.
