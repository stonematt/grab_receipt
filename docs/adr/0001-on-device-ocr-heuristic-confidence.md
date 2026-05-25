# ADR-0001 — On-device OCR via Shortcuts; heuristic (not Vision) confidence

- Status: accepted; **partially superseded by [ADR-0004](0004-two-pass-extraction-capture-and-llm.md)**
- Date: 2026-05-23

> **Superseded note (2026-05-25):** ADR-0004 splits extraction into two passes.
> On-device parsing is kept for **total + date only**; vendor moves to a home-host
> vision LLM. The **heuristic confidence scores below are dropped** (no at-capture
> review to justify them) and replaced by `Source` / `Processed` columns. The
> "on-device only / nothing leaves the device" stance is revisited in ADR-0004.
> The rest of this ADR (Vision returns text-only; no native app in MVP) still holds.

## Context

The brief asks for Apple Vision on-device OCR that returns **per-field confidence
scores** (date/vendor/total), color-coded green/yellow/red, with high-confidence
fields auto-accepted and low-confidence flagged for review.

The Shortcuts **Extract Text from Image** action does run Vision on-device — but it
returns **plain text only**. Vision's actual recognition confidence
(`VNRecognizeTextRequest` → `observation.topCandidates(1).first.confidence`) is
reachable **only from native Swift**, not from any Shortcuts action and not from
Scriptable. Delivering true per-field Vision confidence would require shipping a
native app or App Intent — out of scope for a free, one-shot, pure-Shortcut MVP.

## Decision

1. Keep OCR **on-device** via Shortcuts `Extract Text from Image` (honors the
   privacy/no-cloud constraint).
2. Replace "Vision per-field confidence" with a **heuristic confidence** — a 0–100
   proxy for *how sure the parser is it grabbed the right field*:
   - **Total** = largest currency amount; 90 if a `total/amount due/balance due`
     keyword is present, 60 on pure max-fallback, 30 if no amount found.
   - **Date** = first date token; 90 if matched, 40 if defaulted to today.
   - **Vendor** = first text line; constant 70 (always worth a glance).
3. Store all three percentages read-only in the Sheet for audit; surface them in
   the Shortcut's **Advanced** accordion, not the main path.

## Consequences

- ✅ Ships free, on-device, no native app, no API cost.
- ✅ Confidence still flags fields worth checking and preserves an audit trail.
- ⚠️ The numbers are parser-confidence, **not** Vision recognition confidence —
  documented plainly in `shortcut/ocr-parsing.md` and the README so the audit
  column isn't over-trusted.
- ↪️ Phase 2 path if true Vision confidence is needed: a Swift App Intent that runs
  `VNRecognizeTextRequest` and returns per-observation confidence to the Shortcut.
