# State 3573 TAL · Google Sheets connection

## Source
- Workbook: https://docs.google.com/spreadsheets/d/1iHHBMYDu2FF3HjNTzas8VoyzUQz7_3L__ZS48EDXMdY/edit
- Key worksheet: `Players` (including player ID, selection, registration, availability, language and legion labels)
- Supporting worksheets are retrieved for future reconciliation but not automatically written or merged into events.
- Match by valid, unique `Player ID`. Duplicate or missing IDs are excluded from import.

## Security and one-time setup
The Google Drive connector inside ChatGPT does **not** authorize the deployed website.

1. In a Google Cloud project, enable the Google Sheets API and create a service account with a JSON key.
2. Share the exact source workbook with that service account email as **Viewer**. Do not make the workbook public.
3. On Vercel project `3573-caroline`, set the **server-only** environment variable `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` to the complete JSON key for the intended environment(s). Never prefix this secret with `VITE_` and never commit it to GitHub.
4. Redeploy the tested branch to ensure the deployment reads that environment variable.
5. Sign in with the leader password, open TAL planner, choose **Refresh sheet & review changes**, review discrepancies, and confirm import.

The read-only API `/api/tal-sheet` requires a valid signed leader session. No browser token or Google private key is transmitted to clients; Google OAuth access tokens remain server-side.

## Data-safety contract
- The workbook is read-only to the app. The first integration **does not** write to Google Sheets.
- Refresh makes no changes to local data.
- Confirmation saves source observations to `importedSheet`, and sheet status/availability evidence to TAL records.
- Existing saved player identity, notes, power, confirmed in-game registration, troop inventory, team assignment, priority relationships, battle attendance and rally drafts remain untouched.
- Sheet language is retained as `sheetLanguage`, a **soft** coordination hint. It is not automatically presented as confirmed fluency or preferred voice language.
- If the TAL plan is locked, previews still work, but imports require unlocking it first.
- The shared workspace synchronization will propagate a confirmed import to other leaders.

## Follow-up
Bidirectional updates should be developed with range-specific write controls, revision checks and a separate explicit confirmation. Do not enable sheet writes simply by increasing the service account permissions; this implementation requests read-only OAuth scope.
