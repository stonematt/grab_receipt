# OCR parsing + heuristic confidence

How the Shortcut turns the raw Vision text into `vendor`, `total`, `date`, and a
confidence score for each. All of this runs **on-device** — the only thing that
leaves the phone is the final reviewed payload.

## The honest limitation (read this first)

The Shortcuts **Extract Text from Image** action uses Apple's Vision framework
on-device, but it returns **plain text only**. It does **not** expose Vision's
per-character `confidence` values — those are reachable only from native Swift
(`VNRecognizeTextRequest` → `topCandidates(1).first.confidence`).

So the "OCR confidence" we store is a **heuristic**: a proxy for *how sure the
parser is that it grabbed the right field*, not Vision's raw recognition
confidence. It's good enough to flag fields worth a second look, and it's stored
read-only for audit. See `docs/adr/0001-on-device-ocr-heuristic-confidence.md`.

## Field extraction

Vision returns text roughly in reading order, top-to-bottom. We exploit receipt
layout conventions.

### Vendor — first meaningful line
The store name is almost always the top line(s) of a receipt.
- **Rule:** Split the OCR text by new lines; take the first non-empty line.
- **Confidence:** constant **70** (yellow). Vendor extraction is the least
  reliable field, so we always nudge you to glance at it. (A native helper could
  do better; not worth the complexity in v1.)

### Total — largest currency amount on the receipt
The grand total is nearly always the largest dollar figure printed.
- **Rule:**
  1. Remove thousands separators: replace `,` with `` (so `1,234.56` → `1234.56`).
  2. Match every currency-looking number: `\d+\.\d{2}`
  3. Take the **maximum** of those numbers (Calculate Statistics ▸ Maximum).
- **Confidence:**
  - **90** (green) if the text also contains a total keyword
    (`(?i)\b(grand\s+)?total\b|\bamount\s+due\b|\bbalance\s+due\b`).
  - **60** (red) if no keyword matched but a number was found (pure max fallback).
  - **30** (red) if no `\d+\.\d{2}` matched at all (total left blank for manual entry).

> Edge case: card receipts where a tip line makes the *final* total larger than
> the printed "TOTAL" — max still lands on the grand total. Documented tradeoff.

### Date — first recognizable date token
- **Rule:** First match of:
  ```
  (?i)\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|[A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})\b
  ```
  Covers `05/23/2026`, `5-23-26`, `2026-05-23`, `May 23, 2026`.
- **Confidence:**
  - **90** (green) if a date matched.
  - **40** (red) if none matched → **default to today** (`Current Date`,
    formatted `yyyy-MM-dd`).

## Confidence → color (display only)

| Score   | Color  | Meaning                          |
|---------|--------|----------------------------------|
| ≥ 85    | 🟢 green  | auto-trust                       |
| 70–84   | 🟡 yellow | glance, likely fine              |
| < 70    | 🔴 red    | check this one                   |

Per the minimal-UI design, vendor and total are **always** shown editable on the
main review path regardless of color — the score is informational and is surfaced
in the **Advanced** accordion (read-only) plus stored in the Sheet.

## ICU regex note

Shortcuts' **Match Text** uses ICU / `NSRegularExpression`. The patterns above are
ICU-safe. Use **Match Text** to get matches, then **Get Group from Matched Text**
or **Get Numbers from Input** to pull values. Exact action wiring is in
[`BUILD.md`](./BUILD.md).
