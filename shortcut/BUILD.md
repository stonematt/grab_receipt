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

## The 95% path you're building toward

snap → glance at Vendor → glance at Amount → tap Entity → Submit. Four taps,
under 30s. Date / Category / confidence live behind one **Advanced…** tap and are
skipped on the happy path.

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

## Section C — Parse vendor

5. **Split Text** — Text: `OCRText`, Separator: **New Lines**.
6. **Get Item from List** — **First Item** from the split result.
   → **Set Variable** `Vendor`.

## Section D — Parse total (largest currency amount)

7. **Replace Text** — Find `,` Replace with *(empty)* in `OCRText`. Regex **off**.
   → **Set Variable** `CleanText`. *(handles `1,234.56` → `1234.56`)*
8. **Match Text** — Text: `CleanText`, Regex: `\d+\.\d{2}`
   → magic variable, call it **Matches**.
9. **If** `Matches` **has any value**:
   - **Get Numbers from Input** — Input: `Matches`.
   - **Calculate Statistics** — Operation: **Maximum**, Input: the numbers.
     → **Set Variable** `Total`.
   **Otherwise**:
   - **Set Variable** `Total` to *(empty text)*.
   - **End If**
10. **Match Text** — Text: `OCRText`, Regex:
    `(?i)\b(grand\s+)?total\b|\bamount\s+due\b|\bbalance\s+due\b`
    → magic variable **TotalKeyword**.
11. Compute `ConfTotal` (nested If):
    - **If** `Total` **has any value**:
      - **If** `TotalKeyword` **has any value**: **Set Variable** `ConfTotal` = `90`
        **Otherwise**: **Set Variable** `ConfTotal` = `60` · **End If**
      **Otherwise**: **Set Variable** `ConfTotal` = `30`
    - **End If**

## Section E — Parse date (first date token, else today)

12. **Match Text** — Text: `OCRText`, Regex:
    `(?i)\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|[A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})\b`
    → magic variable **DateMatches**.
13. **If** `DateMatches` **has any value**:
    - **Get Item from List** — **First Item** from `DateMatches` → **Set Variable** `Date`.
    - **Set Variable** `ConfDate` = `90`
    **Otherwise**:
    - **Format Date** — Date: **Current Date**, Format: **Custom** `yyyy-MM-dd`
      → **Set Variable** `Date`.
    - **Set Variable** `ConfDate` = `40`
    - **End If**
14. **Set Variable** `ConfVendor` = `70`.   *(vendor is always heuristic — see ocr-parsing.md)*
15. **Set Variable** `Category` = `Uncategorized`.   *(Advanced default, pre-set)*

## Section F — Review (minimal main path)

16. **Ask for Input** — Input Type: **Text** — Prompt: `Vendor` — Default Answer: `Vendor`.
    → **Set Variable** `Vendor`.
17. **Ask for Input** — Input Type: **Number** — Prompt: `Amount ($)` — Default Answer: `Total`.
    → **Set Variable** `Total`.
18. **Choose from List** — Prompt: `Entity` — List items (add one per line):
    ```
    Household
    Lithos
    Purple Pastures
    StoneGynOnc
    Northwest Hub
    Other
    SPLIT
    ```
    → **Set Variable** `Entity`. *(If you cancel here the Shortcut stops — Entity is required.)*
19. **If** `Entity` **is** `SPLIT`: **Set Variable** `Category` = `Mixed` · **End If**.
20. **Ask for Input** — Input Type: **Text** — Prompt: `Note (optional)` — Default Answer: *(empty)*.
    → **Set Variable** `Note`. *(Tap Done to skip.)*

## Section G — Advanced accordion (one tap, collapsed by default)

21. **Choose from Menu** — Prompt: `Submit?` — two menu items, in this order:
    - **Submit** — *(leave this case empty; happy path falls straight through)*
    - **Advanced…** — put these inside this case:
      1. **Ask for Input** — **Text** — Prompt `Date` — Default Answer `Date`
         → **Set Variable** `Date`.
      2. **Choose from List** — Prompt `Category` — items:
         ```
         Uncategorized
         Groceries
         Fuel
         Supplies
         Equipment
         Meals & Entertainment
         Travel
         Utilities
         Professional Services
         Medical
         Mixed
         ```
         → **Set Variable** `Category`.
      3. **Text** → `Vendor {ConfVendor}%  ·  Total {ConfTotal}%  ·  Date {ConfDate}%`
         (insert the three Conf variables inline).
      4. **Show Result** — the text above. *(read-only audit glance; tap to continue)*
    - **End Menu**

## Section H — Encode + send

22. **Base64 Encode** — Input: `Photo`.
    → **Set Variable** `ImageB64`.
23. **Get Contents of URL** — URL: `Endpoint`
    - **Method: POST**
    - **Request Body: JSON** — add these fields (key → value):

      | Key          | Value (variable / literal) |
      |--------------|----------------------------|
      | `token`      | `Token`                    |
      | `vendor`     | `Vendor`                   |
      | `total`      | `Total`                    |
      | `entity`     | `Entity`                   |
      | `note`       | `Note`                     |
      | `date`       | `Date`                     |
      | `category`   | `Category`                 |
      | `confVendor` | `ConfVendor`               |
      | `confTotal`  | `ConfTotal`                |
      | `confDate`   | `ConfDate`                 |
      | `imageMime`  | `image/jpeg` (literal text)|
      | `imageBase64`| `ImageB64`                 |

    → magic variable **Response**.

## Section I — Confirm

24. **Get Dictionary from Input** — Input: `Response`.
25. **Get Dictionary Value** — Get **Value** for **Key** `error`
    → magic variable **ErrVal**.
26. **If** `ErrVal` **has any value**:
    - **Show Alert** — Title `⚠️ Save failed` — Message: `ErrVal`. *(turn off "Show Cancel")*
    **Otherwise**:
    - **Show Notification** — Body: `✅ Saved  {Vendor}  ${Total}  →  {Entity}`
      (insert variables inline).
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

- **Total is wrong / blank** — the "largest number" heuristic missed (e.g. a phone
  number with a decimal, or a faded total). Just type it in the Amount prompt; the
  field is always editable. Confidence in the Sheet will show why.
- **Vendor is an address line** — some receipts print the address above the name.
  Edit it in the Vendor prompt. (Vendor confidence is intentionally 70/yellow.)
- **`unauthorized` alert** — the `Token` text doesn't match the script's
  `SHARED_TOKEN`. Re-copy it from the `setup()` log.
- **Nothing appends but no error** — confirm the deployment access is **Anyone**
  and you re-deployed a **New version** after any code edit.
- **Curl test shows "unable to open the file at this time"** — not a permissions
  problem. Apps Script returns the response via a 302 to a GET-only
  `script.googleusercontent.com/macros/echo` URL; `curl -X POST -L` re-POSTs to it
  and gets a `405`. Drop `-X POST` (use plain `--data`) so curl follows the redirect
  as GET. The Shortcut's **Get Contents of URL** already does this, so it's unaffected.
