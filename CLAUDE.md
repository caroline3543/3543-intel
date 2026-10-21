# 3543 Intel — Claude Code project memory

Mobile-first PWA for Whiteout Survival alliance officers in State 3543 (and other state workspaces).
Used **live on iPhones during multi-hour events** (SvS, Castle Battle, Foundry, Canyon Clash, Bear Trap).
Owner, product lead and primary user: Caroline (R4). Reliability and one-handed speed beat features.

`CONSTITUTION.md` holds the original hard rules and still applies. This file is the operating manual on top of it.
Full audit and roadmap: `docs/ARCHITECTURE_AUDIT.md`. Older context: `SUNFIRE_COMMAND_HANDOFF.md`, `handoffs/`, `docs/`.

---

## 1. Architecture (verified 2026-10-21)

| Layer | Reality |
|---|---|
| App | React 18 + Vite 5, plain JavaScript (JSX), ES modules. No router (tab state in `src/App.jsx`), no UI library, no CSS files in `src/`. |
| Entry | `index.html` → `src/main.jsx` (Sentry init in prod when `VITE_SENTRY_DSN` set) → `src/App.jsx`. **Root `/App.jsx` is a stale duplicate — not imported. Never edit it.** |
| Tabs | 0 Members (`players/RosterTab`), 1 Intel (`stats/IntelTab` → Arena, rankings, joiner registry), 2 Events (`events/EventsTab` → Foundry/Canyon squads, attendance), 3 Battle (`svs/BattleTab` → plans, Live Rally Room), 4 Hive (`hive/HiveTab` → iframe planner). Header panels: Data, Settings, Alliance import, State switcher. |
| State | `src/hooks/useAppState.js` owns roster/events/plans/settings/notices/ASCII art; auto-saves via `exportImportService`. Feature-local state in its own hook/service (see §3). |
| Persistence | **localStorage is primary**, namespaced per state workspace (`stateWorkspaceService.stateStorageKey`). Supabase is an optional sync target. App must work with no network and no Supabase env. |
| Cloud | Supabase (`src/services/supabaseClient.js`, anon key only). Tables `players`, `svs_plans` (`id, state_id, alliance_tag, data jsonb, updated_at`, PK `(state_id,id)`). Edge functions `supabase/functions/mightpulse`, `whiteoutstats`: origin allow-list + signed-in officer allow-list + action allow-list; provider keys server-side only. |
| Embedded app | `public/hive/` = vendored Bear Hive planner (plain browser JS, own CSS/green identity), loaded in a same-origin iframe with `?state=&alliance=`. See `docs/HIVE_INTEGRATION.md`. |
| Deploy | GitHub `caroline3543/3543-intel` → Vercel. `main` = production (auto-deploy), `staging` = preview. SPA rewrite in `vercel.json`. |
| CI | `.github/workflows/ci.yml`: rules check, ratcheted typecheck, unit tests, build + 5 MB bundle cap, then iPhone-viewport Playwright suites. |
| Monitoring | Sentry (`VITE_SENTRY_DSN`, env = `VITE_VERCEL_ENV`). |

Folder rules (from CONSTITUTION): sub-components live next to their coordinator; `src/services/` are pure functions (no React, no side effects); hooks own state; components own layout.

## 2. Design system

- **Inline styles only**: `style={{…}}` with colour tokens from `C` in `src/utils/constants.js`
  (`bg #0A1628, card #1E3A52, section #152236, gold #F5A623, white, icy #A8C4D8, muted #5A7A94, border #2A4A64, red #FF453A, green #30D158, blue #0A84FF, inf, lan, mar`). Legion pairs: `LEGION_COLORS`. **No new hex literals** — `npm run check:rules` ratchets the 33 legacy ones down, never up.
- **Fonts**: native stack `system-ui, -apple-system, sans-serif`; inputs/buttons `font-family: inherit`; monospace only for copyable ASCII/code. **No web fonts.** (Exception already present: Tabler icon webfont from jsDelivr in `index.html` — icons only; don't add more CDN assets.) Scale 9/11/12/13–14/15–16/18–22, timers 48–80; weights 400/600/700/800–900.
- **Colour meaning**: red = delete/danger or "OPEN RALLY NOW" only; gold = primary action/active; green = success/rally open.
- **Layout**: max width 480 centred; bottom nav 60 px; page padding `16px 20px`; content bottom padding ≥ 80 (+ sticky bar height). Bottom sheets for forms, toasts for confirmations, `vibe()` on significant actions (no-op on iOS — never the only signal).
- **Touch**: ≥ 44×44 targets, tap-first (no hover-only UI), no `window.confirm/alert/prompt` (use `DeleteConfirmModal` or inline two-step).
- **Size limits**: components 300 lines, hooks 150, services 200. 14 legacy files exceed this (listed in `scripts/quality-baseline.json`) — they may shrink, not grow; new files must comply.
- **Hive planner** keeps its own CSS variables and green palette (`public/hive/design-system.css`). Don't apply React tokens inside it.
- **Copy-to-game text**: raw strings from stored data, never markdown fences, never read back from the DOM. In-game chat limit 448 chars.

## 3. Data model and ownership

Schemas live in `src/data/playerSchema.js` (add fields there, not ad hoc). Key facts:
- `furnaceLevel` is a string `"FC1"`…`"FC8"`; never a number, never re-prefixed.
- Players are matched by chief ID (`fid`) and exact name; provider data lives under `providerDetails` / `providerStats` and never overwrites identity or manual setups.
- Only Skill-5 joiner heroes count for coverage and pickers. `src/data/joinerMeta.js` is the only source of joiner formations.

| Data | Single writer | Storage key |
|---|---|---|
| Roster, events, plans, settings, roles, notices, ASCII art, checklist | `useAppState` → `exportImportService` | `svs_rally_data:state:<id>` |
| Workspace registry (active state, list) | `stateWorkspaceService` | `svs_state_workspaces_v1` |
| Live Rally Room (timers, calculator, march registry) — **never** in `useAppState` | `rallyRoomHelpers` / `useLiveBattleRoom` | `svs_live_rally_room_v2` (state-scoped) |
| Battle allocation pool | `useBattlePool` | `svs_battle_pool_v1` (state-scoped) |
| Castle command | castle services | `svs_castle_command_v1` (state-scoped) |
| Field registry custom options / hero gens | `fieldRegistryService` | `svs_field_registry_custom_options`, `svs_field_registry_custom_hero_gens` (state-scoped) |
| Arena battle results | `arenaResultsService` | `svs_arena_results_v1:state:<id>` |
| Hive plan + history + theme | Hive planner `commit()` | `bear-hive-intel:state:<s>:alliance:<tag>` (`-history`, `-dark`) |
| Onboarding flag | `App.jsx` | `svs_onboarded` |
| Cloud copy of players/svs_plans | `cloudSyncService` → `scopedCloudService` | Supabase |

State-scoped keys are `<key>:state:<id>`; the un-suffixed legacy keys are left untouched as a backup by the one-time migration in `initializeWorkspaces`.

Sync rules: pull merges per player by `profileLastUpdated`; push is a fire-and-forget whole-row upsert (cloud row is last-writer-wins). Events, notices, Hive plans and arena results are **device-only**. Roster → Hive is additive (never deletes, preserves slots/locks/notes/attendance). Details: `.claude/skills/roster-sync`.

## 4. Rules for modifying existing features

1. **Read before you write.** Open the coordinator, its sub-components, its service and its tests. Check `docs/` and `handoffs/` for the decision history.
2. **Never delete or silently change existing functionality** unless Caroline asks. If a change alters behaviour, say so up front.
3. **Never lose user data.** Any storage key/shape change ships with a migration that preserves existing data and an entry in §3. Any merge/sync change states its conflict rule and offline behaviour.
4. Decisions already made stay made (CONSTITUTION "Decisions already made"): no joiner countdown timers; timer identity system reverted; no router; no CSS files; no TypeScript migration yet (JSDoc + ratcheted checkJs is fine).
5. Keep diffs small and scoped. Fix incidental bugs inline only if trivial, and call them out.
6. After removing anything, verify imports still resolve; after changing a shared signature, update every call site (`grep` them).
7. Vendored Hive code: minimal diffs, logged in `docs/HIVE_INTEGRATION.md`.
8. Explain every change: what, why, how verified, what Caroline must check on her phone.

## 5. Game mechanics and research evidence standards

**Never invent game formulas.** Every game fact carries one tier — use the `wos-research` skill / `wos-researcher` agent:
- **OFFICIAL** — in-game text/screenshot, Century Games help centre, official notes. May be encoded as a rule.
- **COMMUNITY-TESTED** — reproducible method + data, named tester, date. May be encoded, with source noted beside the data.
- **SPECULATIVE** — opinions, tier lists, unsourced/AI summaries, inference. UI must say "trial"/"estimate"; never "best"/"optimal".

Store source + date + tier next to encoded data, and pin values with a test. Exploration Arena ≠ Expedition/troop combat ≠ Bear Hunt ≠ rallies: don't transfer rules between modes.

Established rules (keep accurate):
- All times UTC; no timezone conversion. Use `Date.UTC`/`…Z`. (Known violation: `eventMs()` parses local time — roadmap.)
- Rally leaders **open** the rally; the game auto-marches. Open = Impact − March − Rally duration. Durations 1/3/5 min. No joiner countdown timers.
- March input: last two digits are seconds (`412` = 4:12; `475` invalid). Impact input `2200`, `22:00`, `220030`.
- Substitutes: `Jessie*` = Jessie/Jasser/Jeronimo; `Sergey**` = Sergey/Bahiti/Lumak Bokan; Seeyoon = Seo-yoon.
- Arena: hero power ≠ Attack; random skill ranges stay ranges; unknown ≠ 0 ≠ locked; placement advice is a reversible trial; win rates only from recorded results with sample size shown.
- Hive: planned slot ≠ reported location; templates are geometry only and not proven legal in-game.

## 6. Testing and validation

| Command | What |
|---|---|
| `npm run check:rules` | Hard bans (confirm/alert, CSS imports, UI libs/router, committed secrets/env) + ratchets (hex colours, oversize files) |
| `npm run typecheck` | `tsc --checkJs` over services/utils/data, ratcheted to `typecheckErrors` in `scripts/quality-baseline.json`; files starting `// @ts-check` must be clean |
| `npm test` | `node --test tests/*.test.js` (pure services, synthetic data) |
| `npm run test:browser [-- filter]` | Playwright at 390×844 touch: `hiveCityDrag` (static, no build), `hiveBrowser`, `arena*` (start Vite automatically) |
| `npm run build` | Vite production build (CI also caps `dist/` at 5 MB) |
| `npm run verify` | rules → typecheck → unit → build |

Requirements:
- New or changed logic → a `node:test` first (TDD). Bug fix → a regression test that fails before the fix.
- UI/gesture changes → a Playwright check at iPhone size, plus a manual iPhone Safari item in the PR (emulation can't prove safe areas, keyboard, haptics, PWA mode).
- Fixtures are synthetic only. No real player data, sessions, or provider calls in tests (stub `mightpulseService` as `tests/hiveBrowser.cjs` does).
- Priority regression areas: city drag-and-drop and map performance; roster → Hive sync; Foundry participants/squads; Arena lineup and calculations; mobile layout and gestures.
- After `--update-baseline`, commit `scripts/quality-baseline.json` only when the numbers went **down**.

## 7. Deployment safety

- Work on `feat/*` / `fix/*`. Never push to `main`, never force-push. PR → `staging` → Caroline tests on iPhone → she merges to `main`.
- No production deploy, promote, rollback, Supabase migration apply, edge-function deploy or secrets change without Caroline's explicit approval **in the current conversation**. Enforced by `.claude/settings.json` (deny/ask rules) and `.claude/hooks/guard-bash.mjs`.
- Secrets: only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN` belong in the client (`.env.production` is public by design). Never read `.env`/`.env.local`, never print or commit service-role/secret/provider keys. If a secret is exposed anywhere, tell Caroline to rotate it.
- Supabase MCP (`.mcp.json`) is pinned to the project with `read_only=true`. Schema changes = migration file in `supabase/migrations/` (data-preserving, with rollback note) that Caroline applies.
- Avoid production deploys during live event windows (UTC). Use the `safe-deploy` skill and the `qa-release` agent before any merge.

## 8. Claude Code setup in this repo

- **Agents** (`.claude/agents/`): `wos-researcher` (read-only, web), `arena-modeller`, `mobile-ux-designer`, `map-engineer`, `supabase-architect` (read-only Supabase MCP), `qa-release` (no edit tools).
- **Skills** (`.claude/skills/`): `wos-research`, `arena-modelling`, `bear-trap-calculations`, `bear-hive-planning`, `roster-sync`, `iphone-ui-audit`, `map-performance-profiling`, `safe-deploy`.
- **Plugins** (project scope, `.claude/settings.json`): github, playwright, chrome-devtools-mcp, context7, typescript-lsp, security-guidance — each collaborator runs `claude plugin install <name>@claude-plugins-official --scope project` once. superpowers, feature-dev, code-review and frontend-design already come from Caroline's claude.ai account and Vercel is a claude.ai connector — not re-declared here to avoid duplicates.
- **Working style with Caroline**: short, direct messages; infer intent, ask only about real ambiguity with concrete options; explain changes after each task; she says "commit" when ready.
