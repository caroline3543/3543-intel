# Google Sheets integration: production release gate

Status: **NOT READY TO MERGE OR ENABLE WRITES** (last reviewed 2026-11-02).

## Confirmed
- Feature branch preview builds and CI have passed on earlier commits.
- OAuth, metadata, connection status and read-only row preview functions deployed.
- OAuth refresh tokens are encrypted at rest by the Edge Function.
- Sync UI explicitly says writes are disabled.
- Protected credentials are not embedded in Vite environment variables.

## Blocking before production
1. Authenticate with a real registered Supabase user from the feature preview. Verify OTP email delivery, session persistence, OAuth redirect, token storage, reconnect, and expiry/error handling.
2. Confirm Google OAuth consent and requested scopes. Grant minimum scope possible for the selected operation.
3. Test metadata and row reading on a disposable spreadsheet; verify 401/403 without session, owner isolation, expired Google tokens, CORS, and large worksheet handling.
4. Complete mapping UI with explicit field ownership (WoS API-owned vs editable), stable player ID, duplicate keys, safe preview and explicit confirmation.
5. Implement import as a durable, idempotent database transaction with source/version checks and no overwriting API-owned fields; test zero writes on preview/cancel.
6. Implement server-side Google export using outbox, rate limits, retries/backoff, snapshots and durable conflict records. Never write directly from the browser.
7. Add bounded worker leases, retry-after handling, replay protection and recovery from partial Google success; Google API writes and Postgres commits cannot form one distributed atomic transaction.
8. Complete owner-scoped authorization for each endpoint, explicit disconnect/revocation, log redaction, and adversarial tests.
9. Run clean CI, security advisor review, preview build and read/write e2e with a disposable spreadsheet and a non-production state. Observe sync consistency after simulated failures.
10. Stage a production build only after checks and explicit review. No production merge, data migration that affects existing roster records, or spreadsheet writes until then.

## Release rules
- Production remains unchanged while this gate is open.
- Avoid presenting successful CI as proof of real-world OAuth, Google API or sync correctness.
- All backfills, sync jobs and writes must be opt-in and reversible or recoverable.
