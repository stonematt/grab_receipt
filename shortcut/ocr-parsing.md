# On-device parsing (Pass 1 capture)

How the Shortcut turns the raw Vision text into `total` and `date`. This is the
**capture pass** — fast, on-device, no confidence scoring. Vendor and category are
**not** parsed here; a home-host vision LLM fills them later (Pass 2). See
[`docs/adr/0004-two-pass-extraction-capture-and-llm.md`](../docs/adr/0004-two-pass-extraction-capture-and-llm.md).

> **Why so little on-device?** First-line vendor extraction was wrong about half
> the time, and the "largest currency" total breaks on cash receipts (amount
> *tendered* > total). Rather than dress those up with a confidence score nobody
> reviews at capture, we keep only the two fields that are cheap and good enough as
> a provisional value (total, date) and let the LLM do the accurate extraction.

## What leaves the phone

Only the reviewed payload + the photo (Base64) — same as before. The image is read
again in Pass 2 from Drive, on the user's home host.

## Field extraction

Vision returns text roughly in reading order, top-to-bottom.

### Total — largest currency amount (provisional)
The grand total is usually the largest dollar figure printed.
- **Rule:**
  1. Remove thousands separators: replace `,` with `` (so `1,234.56` → `1234.56`).
  2. Match every currency-looking number: `\d+\.\d{2}`
  3. Take the **maximum** (Calculate Statistics ▸ Maximum).
- **Blank** if nothing matched (manual entry, or Pass 2 fills it).
- No confidence score. Known blind spot: **cash receipts** — `CASH 100.00 / CHANGE
  15.68` makes the max land on the tendered amount, not the total. Pass 2's vision
  LLM corrects this; the heuristic value is provisional.

### Date — first recognizable date token
- **Rule:** First match of:
  ```
  (?i)\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|[A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})\b
  ```
  Covers `05/23/2026`, `5-23-26`, `2026-05-23`, `May 23, 2026`.
- **Fallback:** today (`Current Date`, formatted `yyyy-MM-dd`) if none matched.
- No confidence score. The date regex is reliable (~90%); when it's wrong it's
  usually because the photo caught an old receipt, and Pass 2 can correct it.

### Vendor / Category — not parsed on-device
Left blank at capture. Pass 2 reads the image with a vision LLM and writes the
merchant name + category back to the Sheet row (joined on Image URL).

## ICU regex note

Shortcuts' **Match Text** uses ICU / `NSRegularExpression`. The patterns above are
ICU-safe. Use **Match Text** to get matches, then **Get Numbers from Input** (total)
or **Get Item from List ▸ First Item** (date) to pull values. Exact action wiring is
in [`BUILD.md`](./BUILD.md).
