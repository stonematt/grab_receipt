# Apps Script append endpoint — setup

The Shortcut talks to **one** HTTPS endpoint: a Google Apps Script Web App. That
endpoint saves the photo to Drive and appends a row to the Sheet in a single
POST. No OAuth tokens to manage on the phone — auth is a shared secret.

## Why Apps Script and not the Sheets/Drive APIs directly

The Sheets and Drive REST APIs need an OAuth2 bearer token that expires hourly
and must be refreshed — painful inside Shortcuts. An Apps Script Web App runs
**as you** (the deploying account), so it already has rights to your Sheet and
Drive. The Shortcut just POSTs JSON with a shared token. Free tier, no quotas
you'll hit at receipt volume. See `docs/adr/0002-apps-script-append-endpoint.md`.

## Setup (≈10 minutes)

1. **Create the project.** Go to <https://script.google.com> ▸ **New project**.
   Name it `grab_receipt`.

2. **Add the code.**
   - Paste `Code.gs` over the default `Code.gs`.
   - Project settings (⚙) ▸ check **"Show appsscript.json manifest file"**, then
     paste `appsscript.json` over the generated manifest. (Adjust `timeZone` if
     you're not on US Pacific.)

3. **Run `setup()`.** Pick `setup` in the function dropdown ▸ **Run**. Approve the
   OAuth consent screen (Drive + Sheets). When it finishes, open
   **Execution log** and copy three values:
   - `SHEET_ID` / Sheet URL — your receipts spreadsheet (created automatically).
   - `FOLDER_ID` / Drive URL — the `grab_receipt_images/` folder (created automatically).
   - `SHARED_TOKEN` — paste this into the Shortcut's **Token** text field.

   > `setup()` is idempotent. Run it again any time to re-read the IDs/token; it
   > won't create duplicates.

4. **Deploy as a Web App.** **Deploy ▸ New deployment ▸** type **Web app**.
   - Description: `v1`
   - **Execute as: Me**
   - **Who has access: Anyone**  ← required so the Shortcut can reach it without a
     Google login. The shared token is what actually gates writes.
   - **Deploy**, approve again, and copy the **Web app URL** (ends in `/exec`).
     Paste it into the Shortcut's **Endpoint** field.

5. **Smoke test.** Open the `/exec` URL in a browser. You should see:
   ```json
   {"ok":true,"service":"receipts-clearing-house","configured":true}
   ```

   To test the **POST** path from a terminal, send the body but **don't** force the
   method with `-X POST`:
   ```sh
   curl -sL --data '{"token":"<SHARED_TOKEN>","vendor":"TEST","total":1.23,"entity":"Other"}' \
     -H "Content-Type: application/json" "<EXEC_URL>"
   ```
   Apps Script answers every web-app call with a 302 to a
   `script.googleusercontent.com/macros/echo` URL that serves the body, and that URL
   accepts **GET only**. `curl -X POST -L` re-POSTs to it → `405` → an "unable to open
   the file at this time" HTML page (looks like a permissions failure but isn't).
   Plain `--data` lets curl follow the redirect as GET and return the JSON. The iOS
   Shortcut's **Get Contents of URL** follows the redirect as GET automatically, so the
   Shortcut is unaffected.

## Re-deploying after edits

Apps Script pins each deployment to a code version. After editing `Code.gs`:
**Deploy ▸ Manage deployments ▸** (pencil) ▸ **Version: New version ▸ Deploy**.
The `/exec` URL stays the same.

## Security notes

- **Token, not identity.** Anyone with the `/exec` URL *and* the token can append
  a row. The URL is unguessable and the token is a UUID; for a personal receipts
  log that's adequate. Rotate by changing `SHARED_TOKEN` in
  **Project Settings ▸ Script Properties** and updating the Shortcut.
- **Image link sharing.** `SHARE_IMAGES_ANYONE_WITH_LINK = true` makes each photo
  link-viewable so the Sheet's Image URL is clickable. The link is unguessable but
  not access-controlled. Set it to `false` in `Code.gs` for owner-only links (you'll
  still see them when logged in as the owner).

## Payload contract

The exact JSON the Shortcut sends is documented in
[`../shortcut/payload-schema.json`](../shortcut/payload-schema.json).
