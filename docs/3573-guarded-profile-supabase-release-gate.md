# State 3573 guarded profile editor: Supabase release gate

Status: **BLOCKED / REVIEW ONLY**. This document is not a migration and does not authorise changes to the connected database.

## Read-only production inspection (2026-11-24)

Project: `3543-intel` (`nrksysaynoklqzhyhnmd`).

- `public.players` has row-level security enabled.
- Its sole inspected policy is `Allow all`, for `authenticated`, command `ALL`, with both `USING` and `WITH CHECK` comparing `auth.uid()` against one hard-coded user UUID. The UUID is deliberately not copied here.
- The table has broad table-level grants to `anon` and `authenticated`. RLS still applies to ordinary API requests. Do not revoke grants blindly: existing application operations may rely on them.
- `public.update_player_if_unchanged` is **not installed** in the connected database.
- Existing policy does not implement a multi-organiser or officer role model.

## Existing branch artifacts

- `database/3573_player_profile_compare_and_swap.sql` is review-only and has not been applied.
- `tests/sql/3573_guarded_profile_integration.sql` runs against disposable PostgreSQL 17 with *simulated* permissions.
- The guarded notes feature is off by default, controlled by `VITE_ENABLE_GUARDED_PROFILE_NOTES`.

## Blocking decisions

1. **Who may edit? DECIDED:** The owner and explicitly approved organisers only. Alliance R4/R5 rank alone does not grant access. Actual organiser account IDs and approval/revocation administration still require configuration.
2. **How are permissions stored? DRAFTED:** `database/3573_approved_organisers_review_only.sql` defines a private, server-managed allowlist keyed by `auth.users.id`, with approval and revocation timestamps. It has not been applied. Never use editable user metadata for authorization. Existing owner-only RLS cannot simply be widened: a permissive players UPDATE policy would expose unrestricted direct JSON updates. A server-checked guarded RPC and snapshot-read path remain to be designed and tested.
3. **Existing writer compatibility.** Identify current service-role and client-side writes to `players` before narrowing existing table grants or RLS policies. The current `ALL` policy is not a per-field editor restriction.
4. **Isolated environment.** Create or explicitly designate a separate State 3573 Supabase test project. The existing content-planner staging project is unrelated and must not be repurposed without approval.

## Required pre-release verification

- Confirm a permitted real authenticated session can SELECT the row and perform a valid compare-and-swap.
- Confirm a different authenticated user cannot read or update the protected row.
- Confirm anonymous requests cannot execute the RPC or access protected player data.
- Confirm stale timestamps, wrong alliance tags, forbidden fields and cross-state requests are rejected.
- Confirm the authorised user's existing import, refresh, bulk editing and sync paths still work.
- Confirm the browser editor preserves an unsaved draft on conflicts, and disabled-by-default behaviour is unchanged.
- Inspect Supabase security advisors after any schema or policy changes.

## Rollout

1. Obtain permission-model decision and isolated-project designation.
2. Apply migration **only to isolated Supabase**, run authenticated tests, inspect RLS and advisors.
3. Review effects on existing application writers.
4. Obtain separate approval for production SQL changes and feature flag activation.
5. Keep rollback instructions and an independently verified backup before production changes.

**No production schema, policy, data or feature-flag changes are authorised by this document.**
