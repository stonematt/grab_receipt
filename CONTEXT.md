# CONTEXT — Receipts Clearing House

Single-context domain doc. Read this + `docs/adr/` before changing behavior. Use
this vocabulary in code, commits, issues, and UI strings.

## What this is

A friction-free way to log household + business receipts at the point of sale.
**Snap a photo → it saves and posts.** Total + date are pulled on-device; entity +
note are optional taps; vendor + category are filled later by a home-host vision
LLM. The photo lands in Drive; a row lands in a Google Sheet. The priority is
**ease of capture** — snap-and-go, ~2 taps, no typing on the happy path. See
ADR-0004 for the two-pass design.

## Pipeline (two passes)

```
PASS 1 — capture (snap-and-go)
iPhone Camera ─▶ Shortcut "Grab Receipt"
                   │  Apple Vision OCR (on-device, text only)
                   │  parse: total (max currency) + date (first token)  — no confidence
                   │  optional: Entity (default Unassigned) + Note   (Submit | Add details…)
                   ▼
            POST JSON (+ base64 photo)
                   ▼
        Apps Script Web App  /exec   (executes as the owner)
                   ├─▶ Drive  grab_receipt_images/<year>/<stamp>_<entity>_<vendor>.jpg
                   └─▶ Sheet  Receipts tab  (append row: Source=heuristic, Processed=FALSE)

PASS 2 — post-processing (home host, async)
        watch Drive folder / poll Sheet for Processed=FALSE
                   │  vision LLM reads the image
                   │  extract: vendor, category, corrected total (+ tax/line items later)
                   ▼
        write back to the matching row (join on Image URL) → Source=llm, Processed=TRUE
```

## Glossary

- **Entity** — which household/business the spend belongs to. Fixed v1 list:
  `Household`, `Lithos`, `Purple Pastures`, `StoneGynOnc`, `Northwest Hub`,
  `Other`, `SPLIT`, plus `Unassigned`. **Optional at capture, defaults
  `Unassigned`** (ADR-0004). The receipt can't reveal your cost-center bucket, so
  Pass 2 never fills it — set it now or reconcile later in the Sheet.
  - **Purple Pastures** = the ranch (brief's "Ranch" placeholder).
  - **StoneGynOnc** = the spouse's practice (brief's "[wife's business]").
- **SPLIT** — a single receipt spanning multiple entities (e.g. ranch fencing +
  household snacks on one Wilco run). Captured as one row; `Needs Split = TRUE`
  flags it for later manual reconciliation in the Sheet. No line-item parsing in MVP.
- **Vendor** — the merchant name. **Not captured on-device** (first-line OCR was too
  unreliable); filled in Pass 2 by the vision LLM. Blank until processed.
- **Category** — coarse spend bucket, defaults `Uncategorized`. Filled in Pass 2.
- **Source** — which pass last wrote the row's extracted fields: `heuristic`
  (Pass 1 capture) or `llm` (Pass 2 post-processing).
- **Processed** — boolean. `FALSE` on capture; Pass 2 sets `TRUE` after enriching.
  The poll signal for the home-host job.
- **Post-processing (Pass 2)** — home-host job that reads each image with a vision
  LLM and writes back vendor / category / corrected total. Model choice (local vs
  cloud API) deferred — see ADR-0004.
- **Endpoint** — the Apps Script Web App `/exec` URL the Shortcut POSTs to.
- **Token** — shared secret (`SHARED_TOKEN`) gating writes to the Endpoint.

## Sheet schema (`Receipts` tab, in order)

`Timestamp · Date · Vendor · Total · Entity · Category ·
Image URL · Notes · Needs Split · Source · Processed`

## Hard boundaries (MVP)

- **On-device OCR for total + date only** — Apple Vision via Shortcuts. No cloud
  OCR vendor in Pass 1.
- **Vendor + category come from Pass 2** — a home-host vision LLM, not on-device.
- **No line-item parsing in MVP** — totals only. (Pass 2 may add line items later.)
- **Splits are manual** — `SPLIT`/`Mixed` flags; reconcile by hand in the Sheet.
- **Free tier on the capture side** — Apps Script + Drive + Sheets. Pass 2 cost
  depends on the deferred model choice (local = free, cloud API = ~cents/receipt).

## Out of scope (later)

Automatic split detection, Tiller sync, Apps Script automations (image rename,
weekly SPLIT digest, monthly pivots), batch capture. Line-item parsing and Pass 2
itself are **planned, not built** — Pass 2's design is ADR-0004; its model choice
is deferred to build time.
