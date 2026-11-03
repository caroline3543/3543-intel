# Google Sheets connection: implementation contract (not yet enabled)

## Existing app
React + Vite; Supabase project 3543-intel. Keep OAuth and Google API calls on a trusted server (Supabase Edge Functions). Do not bundle src/services/googleSheetsRest.js into browser components.

## Google Cloud configuration
1. Enable Google Sheets API for the selected Google Cloud project.
2. Configure OAuth consent screen with minimal scope https://www.googleapis.com/auth/spreadsheets.
3. Create a Web application OAuth client; register the **exact** production and preview redirect URIs being used (Google requires exact matches).
4. Store GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI and server-side token encryption key in Supabase secrets; never VITE_ env vars.
5. Use a signed, short-lived OAuth state value tied to the currently authenticated user and intended workspace. Reject missing/expired/replayed state.
6. Request offline access and use authorization-code exchange **server-side**. Persist refresh tokens encrypted, not in public tables or logs.
7. Limit connected spreadsheet IDs to those chosen by the user. Before importing, display detected worksheets, row counts and intended field mappings.
8. For testing, keep access to explicit test users until consent screen and verification requirements are satisfied. Google may require verification for sensitive scopes.

## Backend responsibilities
- GET /sheets-oauth/start: authenticated session -> nonce/state -> redirect to Google.
- GET /sheets-oauth/callback: verify state, exchange authorization code, encrypt token, persist token reference.
- POST /sheets-import/preview: fetch metadata and row subset; no writes.
- POST /sheets-import/confirm: store approved mapping, baseline snapshots and stable row key.
- POST /sheets-sync/run: server-only job; refresh token, compare DB + sheet against baseline, enqueue minimal cell edits.
- POST /sheets/disconnect: revoke Google token where possible, delete token reference, pause sync.

## Safety conditions before enabling
- Implement account/workspace authorization for each request; distinguish public app viewers and private spreadsheet editors.
- Never trust the client-provided state or spreadsheet id to authorize operations.
- Persist locks or leases so concurrent pollers cannot sync the same mapping at once.
- Use incremental cell-level three-way merge and snapshots; do not rewrite whole worksheets.
- Batch writes conservatively. On 429/5xx use exponential backoff.
- Only advance snapshots after the Google write is confirmed and the matching DB transaction succeeds; reconcile ambiguous network outcomes.
- Retain audit records and user-controlled conflict resolution.
- Do not delete roster records automatically when someone deletes a row in Google Sheets.
- Spreadsheet identity: stable hidden record_id plus game FID; do not identify by username or row number.
- API authoritative fields: API values win or are flagged, not imported from Google Sheets.

## Review gates
No production DB migration or deployment until test suite runs and existing RLS policies and privileges are reviewed. A Google Drive ChatGPT plugin connection does not grant this web app OAuth access.
