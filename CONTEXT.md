# CONTEXT — Receipts Clearing House

Single-context domain doc. Read this + `docs/adr/` before changing behavior. Use
this vocabulary in code, commits, issues, and UI strings.

## What this is

A friction-free way to log household + business receipts at the point of sale.
**Snap a photo → on-device OCR pulls vendor/total/date → glance + pick an entity →
submit.** The photo lands in Drive; a row lands in a Google Sheet with a confidence
audit trail. No typing amounts on the happy path.

## Pipeline

```
iPhone Camera ─▶ Shortcut "Grab Receipt"
                   │  Apple Vision OCR (on-device, text only)
                   │  heuristic parse: vendor / total / date + confidence
                   │  minimal review UI (Advanced accordion for edge cases)
                   ▼
            POST JSON (+ base64 photo)
                   ▼
        Apps Script Web App  /exec   (executes as the owner)
                   ├─▶ Drive  grab_receipt_images/<year>/<stamp>_<entity>_<vendor>.jpg
                   └─▶ Sheet  Receipts tab  (append row)
```

## Glossary

- **Entity** — which household/business the spend belongs to. Fixed v1 list:
  `Household`, `Lithos`, `Purple Pastures`, `StoneGynOnc`, `Northwest Hub`,
  `Other`, `SPLIT`. Required at capture.
  - **Purple Pastures** = the ranch (brief's "Ranch" placeholder).
  - **StoneGynOnc** = the spouse's practice (brief's "[wife's business]").
- **SPLIT** — a single receipt spanning multiple entities (e.g. ranch fencing +
  household snacks on one Wilco run). Captured as one row; `Needs Split = TRUE`
  flags it for later manual reconciliation in the Sheet. No line-item parsing in MVP.
- **Category** — coarse spend bucket, user-selected, defaults `Uncategorized`.
  `Mixed` auto-set for SPLIT. Not required to save.
- **Heuristic confidence** — a 0–100 proxy for *how sure the parser is it grabbed
  the right field*. **Not** Vision's raw recognition confidence (unreachable from
  Shortcuts — see ADR-0001). Stored read-only per field for audit. Color bands:
  🟢 ≥85, 🟡 70–84, 🔴 <70.
- **Endpoint** — the Apps Script Web App `/exec` URL the Shortcut POSTs to.
- **Token** — shared secret (`SHARED_TOKEN`) gating writes to the Endpoint.

## Sheet schema (`Receipts` tab, in order)

`Timestamp · Date · Vendor · Total · Entity · Category ·
OCR Confidence: Date (%) · OCR Confidence: Vendor (%) · OCR Confidence: Total (%) ·
Image URL · Notes · Needs Split`

## Hard boundaries (MVP)

- **On-device OCR only** — Apple Vision via Shortcuts. No cloud OCR vendor.
- **No line-item parsing** — totals only. Vision returns reading-order text, not
  table cells.
- **Splits are manual** — `SPLIT`/`Mixed` flags; reconcile by hand in the Sheet.
- **Free tier** — Apps Script + Drive + Sheets, no paid APIs.

## Out of scope (Phase 2)

Line-item parsing (Document AI / vision LLM), automatic split detection, Tiller
sync, Apps Script automations (image rename, weekly SPLIT digest, monthly pivots),
batch capture, OCR-trend analysis.
