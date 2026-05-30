# ADR-0004 — Two-pass extraction: snap-and-go capture + home-host vision LLM

- Status: accepted
- Date: 2026-05-25
- Supersedes (in part): ADR-0001 (heuristic confidence), ADR-0003 (review UI)

## Context

ADR-0001 committed to on-device heuristic parsing of **vendor / total / date**
with per-field heuristic confidence, because Vision's real confidence is
unreachable from Shortcuts and a native app was out of scope. ADR-0003 then built
a sequential review UI around those parsed fields (Vendor + Amount + Entity + Note
always shown, Date/Category/confidence behind an Advanced accordion).

Field-testing the heuristics surfaced the limits honestly:

- **Vendor = first line** is right maybe half the time (address blocks, "WELCOME
  TO", store #, "CUSTOMER COPY" all print above the merchant name).
- **Total = largest `\d+\.\d{2}`** is solid on card/retail receipts but wrong on
  **cash receipts** — `CASH 100.00 / CHANGE 15.68` makes the max land on the amount
  *tendered*, not the total. Worse, the keyword bump still colors that wrong value
  green. High confidence, wrong number.

So the heuristic's real accuracy backstop was never the score — it was the human
glancing and editing **with the receipt in hand**. That conflicts with the actual
priority: **maximize ease of capture.** The user wants snap-and-go.

Separately, the user has a home host that can run a job on a schedule / file
trigger, and the receipt image is already in Drive. A vision LLM reading the image
beats any on-device regex at vendor and total.

## Decision

Split extraction into **two passes**.

### Pass 1 — on-device capture (Shortcut), optimized for snap-and-go
The only hard requirement is **the image saves and the row posts.** Everything
else is optional or deferred.

- **Total** — `max(\d+\.\d{2})` (comma-stripped), automatic. Blank if none. No
  confidence score.
- **Date** — first date token, else today, automatic. No confidence score.
- **Entity** — *optional*, user-pickable, **default `Unassigned`** (was required in
  ADR-0003). The receipt can't reveal your cost-center bucket, so the LLM never
  fills this — you set it now or reconcile later in the Sheet.
- **Note** — optional free text.
- **Vendor / Category** — **not captured on-device.** Left for Pass 2.

The review UI collapses to a single **Submit | Add details…** menu: tap Submit to
post immediately (Entity `Unassigned`, Note empty), or Add details to set Entity +
Note first. No Vendor/Amount/Date prompts on the happy path.

### Pass 2 — home-host vision LLM (post-processing), enriches asynchronously
A job on the user's home host watches the Drive image folder (or polls the Sheet
for `Processed = FALSE`), runs a **vision LLM on the image**, and writes back:

- **Vendor** (the real merchant name),
- **Category**,
- a **corrected Total** (fixes the cash-receipt tendered/change blind spot),
- optionally tax / line items later.

It matches image ↔ row on **Image URL**, then sets `Source = llm`, `Processed =
TRUE`. The on-device heuristic value stays as the provisional/fallback.

The model choice (local model vs cloud API) is **deferred** to when Pass 2 is
built — see Consequences.

## Consequences

- ✅ Capture is now ~2 taps (shutter + Submit). Snap-and-go honored.
- ✅ Much simpler Shortcut: vendor parsing and all confidence math removed (the
  fiddliest build sections).
- ✅ Real vendor/total accuracy moves to the LLM, which is genuinely better at it.
- ⚠️ Vendor/Category/corrected-Total arrive **minutes later**, not at capture — you
  no longer fix them with the paper in hand. Accepted: the priority is capture
  ease, and the LLM is more accurate than in-hand heuristic correction anyway.
- ⚠️ Adds a moving part: the home host must be up, or rows sit `Processed = FALSE`
  until it catches up. The heuristic Total + Date keep the row useful meanwhile.
- ⚠️ **Privacy:** ADR-0001's "nothing leaves the device but the reviewed payload"
  no longer fully holds — the image is in Drive (already true) and Pass 2 reads it.
  A **local** home-host model keeps processing on the user's own infra; a **cloud
  API** sends the image off-infra. This is the deferred decision; if cloud, update
  the privacy claims in CONTEXT.md and the README.
- ↪️ Heuristic confidence (ADR-0001) and the always-shown Vendor/Amount review
  (ADR-0003) are dropped. The Sheet's three OCR-Confidence columns are replaced by
  `Source` + `Processed`.
