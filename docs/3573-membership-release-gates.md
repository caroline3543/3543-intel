# State 3573 automatic membership: production release gates

**Status: NOT READY FOR PRODUCTION. Free-tier release validation only.** Development branch only. Do not apply the staged SQL, deploy the Edge Functions, set enablement secrets, or merge to production without explicit user approval.

## Safety gates

1. **Real Whiteout Stats free-tier response validation:** Run a read-only provider diagnostic using an already-authorized server-side provider credential, without deploying to production or creating a paid Supabase branch. If no such credential is available to CI or a permitted diagnostic runner, record this as an explicit external dependency and request only the minimum access needed. Confirm the exact `/usage`, `/players/:fid?include=base`, and `/alliances/3573/:tag?include=info,roster` response shapes. The probe reports metadata, not player identities. Update parsers and tests to match observed provider fields. **Never infer freshness from HTTP success or proxy retrieval time.**
2. **Shared request accounting:** Confirm the existing `consume_whiteoutstats_lookup` 300/day limiter remains compatible with the new `caroline_3573_reserve_proxy_credit` reservation. Confirm provider account usage and the staged worker budget include other keys on the same account. Fail closed on unverified usage. Verify concurrent proxy/worker requests in isolated PostgreSQL.
3. **Private worker:** Verify `DATABASE_URL` connects using a trusted server-only role and the private `membership_3573` schema. Verify the Edge Function can bundle all shared JS modules, accepts only the cron secret, and defaults to disabled. No secrets in the browser or repository.
4. **Scheduler:** Confirm the 15-minute GitHub scheduler is gated by `MEMBERSHIP_3573_CRON_ENABLED=true`, and the Edge Function separately requires `MEMBERSHIP_3573_ENABLED=true`. Test repeated and overlapping ticks; verify job leases and daily/minute quotas.
5. **Membership correctness:** Confirm explicit No Alliance, alliance changes, and verified cross-state transfers update the existing workspace with manual fields preserved. Test cached/missing/failed API responses, roster disappearance, unknown previous state, stale observations, and concurrent manual edits. No inferred transfers.
6. **Transfer UI:** Verify `/api/transfers` requires a leader session and the new service-role-only transfer-feed RPC is installed. Test 72-hour promotion, monthly history, returning players, and zero events.
7. **End-to-end:** All GitHub workflows green on the final integration commit. Run an isolated PostgreSQL integration and preview UI smoke test in GitHub Actions, then run the read-only real provider diagnostic through an authorized server-side path. Confirm actual free-tier quota usage. Review deployment diff and rollback/disable plan.

## Controlled deployment sequence (requires separate user approval)

1. Back up the existing `3573-leaders` workspace and confirm rollback path.
2. Apply reviewed SQL migrations in dependency order to the intended project only.
3. Deploy the updated existing Whiteout Stats proxy, workspace transfer endpoint, and private worker Edge Function as one coordinated release. Keep the worker disabled.
4. Configure server-only worker database URL and cron secret. Run authenticated read-only provider diagnostic. Do not enable membership writes unless all evidence gates pass.
5. Deploy the tested site build and verify leader-authenticated transfer history.
6. Explicitly enable scheduler and worker only after a second confirmation of readiness. Monitor usage and errors. The emergency stop is to set either enablement flag to false.

## Known limitation

The user has a **Supabase Free** subscription. Do not create a preview branch, additional paid project, or upgrade. GitHub Actions' isolated PostgreSQL is the test database. Real provider freshness and account usage must still be verified using a credentialed, read-only diagnostic; simulated fixtures alone cannot pass this gate. If no safe diagnostic path is available, stop and request access rather than deploying unverified writes.

## Provider and scheduler verification

The documented free-tier usage endpoint returns nested account-wide counters
in `minute` and `daily`. The worker validates both limits and checks that used
plus remaining equals the limit. The player adapter requires explicit freshness,
identity, alliance membership and an observation no older than one hour. The
roster adapter validates the roster and alliance identity, freshness timestamp,
alliance member count, roster count when supplied, and unique member FIDs.

On 21 November 2026, a temporary authenticated diagnostic on Supabase
`nrksysaynoklqzhyhnmd` reused the deployed app's existing provider secret.
All three Whiteout Stats endpoints returned HTTP 200. The usage response
confirmed the free-tier account counters (0 used in the minute and 136
used in the day at the time of inspection). HOT returned 100 unique member
IDs and an alliance-reported count of 100. Its roster was one second old.
The player response matched the requested FID and reported State 3573 with
an explicit HOT alliance and a current timestamp. The roster had no
`complete` flag. The diagnostic accepted no anonymous requests and was
closed immediately after the check.

GitHub only triggers scheduled workflows from the default branch (`main`).
Merging to `release/3573-production` alone leaves the scheduler inactive.
Install the scheduler workflow on `main` separately after verifying its
target and keeping the scheduler and worker flags disabled. The development-branch GitHub diagnostic is optional when hosted
provider validation runs on Supabase. It runs on push only when
`WOS_DIAGNOSTIC_IN_CI` is true and needs an authorized GitHub Actions secret.
Manual dispatch additionally requires the workflow on the default branch.

Roster sightings of known transferred-out players can enqueue a one-off
player verification. Only a verified location in 3573 can record the return.
Players with unknown origins remain discoveries until independent evidence
supplies a previous state.

## Rollback preparation

Before SQL or Edge changes, export the `3573-leaders` workspace row and the
existing database definitions to restricted backup storage. Record the
workspace revision and verify the export restores into an isolated PostgreSQL
instance. Record the deployed Edge Function versions and archive their source
before replacing them. Confirm the Vercel production deployment is available
for rollback.

If an enabled release fails, disable the GitHub scheduler and the Edge worker
first, drain in-flight jobs, and restore the previous Vercel deployment and
Edge Function versions. Preserve the ledger and workspace. Compare the saved
workspace revision with its current state and reconcile automation edits
individually so that restoring a snapshot cannot erase later leader edits.
