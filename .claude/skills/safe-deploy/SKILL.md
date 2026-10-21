---
name: safe-deploy
description: Ship a change from a feature branch to staging and production without risking live alliance data. Use whenever code is about to be pushed, merged, deployed, or a Supabase migration/edge function is about to change.
---

# Safe deployments

## The pipeline
`feat/*` or `fix/*` branch → PR → CI green → **staging** (Vercel preview; Caroline tests on her iPhone) → PR staging→main → **main = production** (auto-deploys on Vercel).

Production is used live by officers during multi-hour events. A broken deploy mid-SvS costs the alliance.

## Never (enforced by `.claude/settings.json` + `.claude/hooks/guard-bash.mjs`)
- Push to `main`, force-push, `vercel --prod`, promote/rollback, `supabase db push|reset`, `supabase functions deploy`, `supabase secrets`.
- Read or print `.env` / secret keys. The anon key in `.env.production` is public by design; the secret key is not.
- Delete or rename a localStorage key without a migration that keeps users' data.

Doing any of those requires Caroline's explicit "yes, deploy to production" (or equivalent) **in the current conversation**. A previous approval doesn't carry over.

## Checklist
1. On a feature branch (`git branch --show-current`). Rebase on `origin/main`.
2. `npm run verify` (rules → typecheck → unit → build) and `npm run test:browser`.
3. Run the `qa-release` agent; paste its table into the PR.
4. Data safety: list every storage key, schema or sync rule touched and the migration/rollback.
5. Push the branch; open the PR to `staging` with: what changed, why, how tested, manual iPhone checks needed.
6. After Vercel preview is READY: check runtime errors (Vercel MCP `get_runtime_errors`) and Sentry (environment = preview).
7. Caroline tests on iPhone → she merges staging → main (or explicitly asks you to).
8. Post-deploy: watch production runtime errors/Sentry for 15 minutes; if broken, *propose* a rollback and wait for approval.

## Timing
Avoid production deploys during live events (SvS, Foundry, Canyon Clash, Castle Battle, Bear Trap windows). Ask Caroline if unsure — times are UTC.

## Supabase changes
Migration file in `supabase/migrations/` (timestamped, data-preserving, with a rollback note), reviewed in the PR. Caroline applies it via the Supabase dashboard/CLI herself. Edge function code changes ship the same way; she deploys them.
