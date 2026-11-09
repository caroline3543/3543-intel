# State 3573 TAL · Google Sheets connection

## Existing source
- Workbook: https://docs.google.com/spreadsheets/d/1iHHBMYDu2FF3HjNTzas8VoyzUQz7_3L__ZS48EDXMdY/edit
- Primary worksheet: `Players`, keyed by `Player ID`.
- Other worksheets are included as read-only reference data.
- The initial app integration is **read-only** with a preview and explicit confirmation. It does not write back to the Google Sheet.

## Recommended setup: free Google Apps Script (no card)

The script runs with your existing Google account's permission to access the spreadsheet. You do not need to create a Google Cloud billing account or a service account.

1. Open the spreadsheet in a desktop browser and choose **Extensions → Apps Script**.
2. Replace the editor's sample `Code.gs` with the contents of [`scripts/tal-google-apps-script.js`](../scripts/tal-google-apps-script.js). Save the Apps Script project.
3. In Apps Script, go to **Project settings → Script properties**. Add `TAL_BRIDGE_SECRET`, set to a securely generated random secret at least 32 characters long. Keep it private.
4. Choose **Deploy → New deployment → Web app**. Choose **Execute as: Me** and **Who has access: Anyone**. Approve the Google permissions to read the spreadsheet and copy the resulting URL ending in `/exec`.
5. In Vercel project `3573-caroline`, add these **server-only** environment variables:
   - `GOOGLE_TAL_SCRIPT_URL`: the Apps Script web-app deployment URL.
   - `GOOGLE_TAL_SCRIPT_SECRET`: exactly the same value as `TAL_BRIDGE_SECRET`.
6. Redeploy the application, then sign in to the leader website and open **TAL → Refresh sheet & review changes**.

**Privacy model:** The spreadsheet remains private. The Apps Script web app is reachable by anyone with its URL, but it performs no read unless the request contains the shared secret. Keep the URL and secret out of client code and shared links. If the secret is leaked, rotate it in both Apps Script and Vercel. The script has no `doGet` data endpoint.

**Limits:** Free Apps Script executions are subject to Google quotas, and some accounts or Workspace admins can restrict public web-app deployments. If the app cannot be deployed with those settings, do not make the spreadsheet public as a workaround.

## Alternate setup: service account

The Vercel endpoint also supports a service-account reader using `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` if that is already configured. It is **not required** for the Apps Script route, and the website automatically selects Apps Script when `GOOGLE_TAL_SCRIPT_URL` is provided.

## Data-safety contract
- Refreshing Google Sheets does not modify your data.
- Confirming an import saves source evidence to `importedSheet` and the existing TAL planning records, matched by valid unique player IDs.
- Existing profiles, team and legion assignments, battle attendance, manual notes, priority relationships and rally-team drafts are preserved.
- Missing or duplicate IDs are excluded and listed for review.
- Spreadsheet language is a soft coordination hint, not a verified claim of spoken fluency.
- A locked plan may be reviewed, but not changed until unlocked.
- The shared leader workspace syncs the confirmed import to other connected leaders.

## Possible future phase
Bidirectional edits would require separate explicit write authorization, column-level conflict handling, and safeguards against overwriting formulas or another leader's changes. It is not enabled in the current implementation.
