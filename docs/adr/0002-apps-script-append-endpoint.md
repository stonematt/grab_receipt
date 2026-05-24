# ADR-0002 — Single Apps Script Web App as the append endpoint

- Status: accepted
- Date: 2026-05-23

## Context

The Shortcut must (a) upload the photo to Drive and (b) append a row to a Sheet.
Two ways to reach Google from a Shortcut:

1. **Direct Drive + Sheets REST APIs** — needs an OAuth2 bearer token that expires
   hourly and must be refreshed. Shortcuts has no clean OAuth refresh story; you'd
   hand-manage tokens or add a third-party auth app. Two API calls, two failure
   points, CORS/scoping headaches.
2. **Apps Script Web App** — a `doPost` that runs **as the deploying owner**, so it
   already holds rights to that owner's Drive and Sheet. The Shortcut sends one
   JSON POST with a shared token; the script does both writes server-side.

## Decision

Use a single **Apps Script Web App** (`/exec`) as the only endpoint the Shortcut
talks to. One POST → image saved to `Receipts/<year>/`, row appended to the
`Receipts` tab, JSON response back. Auth is a **shared token** (UUID in Script
Properties), checked in `doPost`. Deployed **Execute as: Me**, **Access: Anyone**.

## Consequences

- ✅ No OAuth/token-refresh logic on the phone; the Shortcut stays simple.
- ✅ Free tier, comfortably within Apps Script quotas at receipt volume.
- ✅ One round trip → faster, fewer failure points, easy to extend later
  (e.g. add the Phase-2 weekly SPLIT digest in the same project).
- ⚠️ "Access: Anyone" means the unguessable URL + token is the only gate —
  acceptable for a personal log; rotate the token to revoke.
- ⚠️ Base64 image inflates the payload ~33%; fine for receipt-sized JPEGs, well
  under Apps Script's request limit.
- ↪️ Image link uses `ANYONE_WITH_LINK` so the Sheet's Image URL is clickable;
  toggleable to owner-only for restricted Workspace orgs.
