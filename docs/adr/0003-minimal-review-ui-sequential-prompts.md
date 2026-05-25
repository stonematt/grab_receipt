# ADR-0003 — Minimal review UI via sequential prompts + Advanced accordion

- Status: accepted; **partially superseded by [ADR-0004](0004-two-pass-extraction-capture-and-llm.md)**
- Date: 2026-05-23

> **Superseded note (2026-05-25):** ADR-0004 prioritizes snap-and-go. The
> always-shown Vendor + Amount prompts and the confidence summary are removed;
> Entity becomes optional (default `Unassigned`). The review UI collapses to a
> single **Submit | Add details…** menu. The "sequential prompts, no native form"
> reasoning here still holds for the remaining optional prompts.

## Context

The target UX: after a scan, show **only** Vendor, Amount, Entity, Note; push
Date, Category, and confidence behind an **Advanced** accordion collapsed by
default. The 95% path is snap → glance → tap entity → submit.

Native Shortcuts has **no multi-field form action** — every `Ask for Input` and
`Choose from List` is its own full-screen prompt. A true single review *card*
(several editable fields at once) would require a `Show Web View` + Scriptable
round trip to get form data back, adding a third-party app dependency and brittle
JS bridging.

## Decision

Implement the minimal UI as **sequential prefilled prompts**, not a single card:

- **Main path (always shown):**
  `Ask for Input` Vendor (prefilled with OCR value) → `Ask for Input` Amount
  (prefilled) → `Choose from List` Entity (required) → `Ask for Input` Note
  (empty, tap-Done to skip).
- **Advanced accordion (one tap, collapsed):** a `Choose from Menu` with
  **Submit** (default, empty case) and **Advanced…**. Advanced reveals Date,
  Category, and a read-only confidence summary, then continues to submit.

The "glance" the brief wants is satisfied by the **prefilled default answers** —
you see the parsed value and tap Done if it's right.

## Consequences

- ✅ Pure Shortcuts, no extra apps, robust and offline until submit.
- ✅ Happy path ≈ 4 taps, comfortably <30s.
- ✅ Advanced fields are genuinely collapsed — one extra tap only when needed.
- ⚠️ It's sequential screens, not one combined card. Acceptable for MVP.
- ↪️ Phase 2 polish if a single card is desired: a Scriptable `WebView` form
  (HTML) returning all fields at once, or a native App Intent UI.
