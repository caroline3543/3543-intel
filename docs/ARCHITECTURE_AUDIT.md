# 3543 Intel — Architecture audit and roadmap

Audited 2026-10-21 on branch `feat/claude-dev-environment`, base `main @ b0f01ea`.
Method: full repository read-through, unit tests run locally (Node 22), Playwright run of the Hive planner at 390×844 touch, `tsc --checkJs` probe, secret scan of tracked files. `npm install`/`vite build` could not run in the audit sandbox (registry unreachable), so build and app-level browser suites are verified by CI on this branch.

## 1. What exists (preserve all of it)

| Area | Main files | Notes |
|---|---|---|
| Members / roster | `players/RosterTab`, `PlayerCard`, `ProfileView`, `PlayerSheet`, `FieldRegistry`, `RoleManagerSheet`, equipment/rankings/history sections, `RallyLeaderProfileSheet` | Players arrive via provider/alliance import; manual add & bulk add were removed (Oct 2026). Field registry, roles, avatars, troop power chart. |
| Provider data | `mightpulseService`, `playerDetailsService`, `providerProfileService`, `stateRankingsService`, `allianceImportService`, `playerChangeService`, `playerObservationService`; edge functions `mightpulse`, `whiteoutstats` | Officer-only, origin-checked proxies; validated chief-ID/state matching; non-destructive merges. |
| State workspaces | `stateWorkspaceService`, `workspaces/StateSwitcher`, `AllianceImportPanel` | Per-state storage namespaces; one-time legacy copy keeps originals. |
| Events | `events/EventsTab` (+ `EventSheet`, `ParticipantRow`, `SnapshotEditor`, `AddParticipantPanel`, `VerifyRosterPanel`, `LegionConflictModal`, `SquadBalancerPanel`), `eventListHelpers` | SvS Castle, Internal Sunfire Castle, Foundry, Canyon Clash, Bear Trap, Transfer Season, Custom. Legion 1/2 split, substitutes, excused absences, streaks, Discord/Helios text, squad balancing. |
| Battle | `svs/BattleTab`, `battle/*` (plans, rally slots, formation picker, joiner slots, allocation pool, holding board, command assignments, test rally log) | Uses `joinerMeta.js`; troop-tier filtering; allocation services. |
| Live Rally Room | `svs/LiveRallyRoom`, `rally/*`, `useLiveBattleRoom`, `castleTimingService` | Separate state; leader timers only; switching panel; backup/legacy import. |
| Intel | `stats/IntelTab`, Arena (`stats/arena/*`), state rankings, player changes, `JoinerRegistry`, `JoinerAnalysis` | Arena comparison with evidence-graded research notes. |
| Hive | `hive/HiveTab`, `HivePlannerFrame`, `AllianceLocationMap`, `HiveLocationFetch`; vendored `public/hive/*` | Bear Hive planner in iframe, roster bridge, reported-location map, bulk location fetch. |
| Notices / ASCII | `notices/NoticeLibrary`, `ascii/AsciiArtLibrary`, schemas, `noticeCycleService` | Copy-to-game text. |
| Data | `DataPanel`, `exportImportService`, `exportXlsx`, `xlsxImportService`, `xlsxDataSheets` | JSON + XLSX import/export, manual cloud pull. |

**Tests before this branch:** 20 files — 16 `node:test` suites (118 tests; 117 pass in the sandbox, `playerContext` needs `xlsx` installed) and 4 Playwright scripts. There was **no `test` script and CI ran only the build**, so none of the tests gated a merge.

## 2. Findings

Severity: **H** fix before next live event · **M** next sprint · **L** opportunistic.

### Security and data safety
- **H — Secret key exposed outside git.** The `.env` uploaded to the claude.ai Project "WOS Alliance Planner" contains `SUPABASE_SECRET_KEY` (bypasses RLS). It is *not* in the repository (`.gitignore` covers it; tracked-file scan clean). Rotate it in Supabase → API keys and delete `.env` from the Project files.
- **M — Base schema and RLS are not in source control.** Only `20261020000000_state_workspaces.sql` (ALTERs) exists; the "officer-only RLS policies" can't be reviewed or reproduced. Capture a baseline migration from the live DB (read-only MCP).
- **M — Cloud push is last-writer-wins.** `scopedCloudService.push` upserts whole JSON with no `updated_at` guard; pull merges by `profileLastUpdated`, but a stale device saving overwrites the newer cloud row. No retry/outbox for offline saves.
- **M — Device-only collections.** Events, notices, Hive plans, arena results and the live room aren't cloud-synced; a second officer's phone sees none of them.
- **L — `index.html` disables zoom** (`maximum-scale=1, user-scalable=no`) — accessibility trade-off; decide deliberately.
- **L — Tabler icon webfont from jsDelivr** without SRI and not cached for offline; icons vanish offline.
- **L — Edge function allow-list hardcodes one Vercel preview URL**; rely on `MIGHTPULSE_ALLOWED_ORIGINS` instead.

### Correctness
- **M — UTC rule violated in `eventMs()`** (`eventListHelpers.js`): `new Date('YYYY-MM-DDTHH:MM:00')` is local time. Only used for "nearest event" sorting today, but it's a trap for reuse.
- **M — `joinerMeta.js` provenance is mixed.** Gen 1–6 is transcribed from Tonton's community sheet (itself flagged out of date after the December update) but includes rows not in the sheet (Gen 4 Defense 50/2/48; Gen 5 "Logan & Norah & Greg") and differences (Gen 5 Defense "Hector/Logan" vs sheet "Hector"; Gen 5 48/4/48 alt2 "Zinman" vs blank; Gen 4 Defense extra ratio "50/20/30"). Gen 7–9 has no recorded source. No per-row `source`/`tier`.
- **L — `Jessie**` in Gen 6 "Jeronimo & Renee & Greg"** copies a sheet typo (`**` is the Sergey legend). Substitution logic may treat it wrongly.
- **L — `balanceSquads` drops leaders beyond `teamCount`.** Not reachable via UI (`toggleLeader` caps it); tracked as a `todo` test.
- **L — Stale root `/App.jsx`** duplicates `src/App.jsx` and is never imported — confusing for agents and humans. Delete after Caroline confirms.

### Performance
- **M — City drag renders the whole map per pointermove.** Measured: 21 `renderMap()` calls for 20 moves (~4–5 ms each on desktop; expect 20–30 ms on iPhone, i.e. dropped frames at 60–120 Hz). Pan is already rAF-coalesced; drag isn't (`updateDrag` in `public/hive/map-interactions.js`). `mapXY()` also calls `getBoundingClientRect()` per event.
- **M — No code splitting.** `xlsx` (~400 KB) is statically imported by `DataPanel` and `EventsTab`, so it's in the startup bundle; Arena/Hive panels also load eagerly. Use dynamic `import()` for XLSX and `React.lazy` for heavy tabs.
- **L — `world-data.js` ~450 KB** parsed on every Hive open.

### Maintainability
- 14 files exceed size limits (EventsTab 1092, exportXlsx 770, RosterTab 550, FormationPicker 484, useAppState 409, …), 33 hardcoded hex colours in JSX (App.jsx header uses hex instead of `C.*`). Now ratcheted.
- 59 `checkJs` type errors in services/utils/data (mostly inference noise, a few real: `metrics.js` null access, `noticeCycleService` Date arithmetic). Now ratcheted.
- CI used Node 20 while `@supabase/supabase-js` 2.110 declares `node >= 22`; CI now uses 22.

## 3. What this branch adds

| Deliverable | Files |
|---|---|
| Project memory | `CLAUDE.md` |
| Integrations | `.claude/settings.json` (plugins github, playwright, chrome-devtools-mcp, context7, typescript-lsp, security-guidance; permission allow/ask/deny; Bash guard hook), `.mcp.json` (Supabase, project-pinned, `read_only=true`) |
| Not re-declared (already present via claude.ai, avoids duplicates) | superpowers, feature-dev, code-review, frontend-design (account-synced plugins), Vercel (claude.ai connector) |
| Agents | `.claude/agents/` wos-researcher, arena-modeller, mobile-ux-designer, map-engineer, supabase-architect, qa-release |
| Skills | `.claude/skills/` wos-research, arena-modelling, bear-trap-calculations, bear-hive-planning, roster-sync, iphone-ui-audit, map-performance-profiling, safe-deploy |
| Guardrails | `.claude/hooks/guard-bash.mjs` blocks push-to-main, force-push, prod deploy/promote, Supabase writes, `.env` reads, secret strings |
| Quality gates | `scripts/check-constitution.mjs`, `scripts/typecheck.mjs`, `scripts/quality-baseline.json`, `scripts/run-browser-tests.mjs`; npm scripts `test`, `test:browser`, `typecheck`, `check:rules`, `verify`; CI split into build-gate and browser jobs |
| New tests | `tests/hiveCityDragBrowser.cjs` (select → drag → valid drop, undo, locked city, persistence, render budget), `tests/foundryParticipants.test.js` (squad balancing, Legion siblings/colours, attendance totals, per-type streaks) |

No application source file was modified. `package-lock.json` is unchanged (Playwright is installed in CI with `--no-save`).

## 4. Prioritised roadmap

| # | Item | Why | Owner agent / skill | Size |
|---|---|---|---|---|
| 1 | Rotate the Supabase secret key; remove `.env` from the claude.ai Project | Full DB bypass key is outside your control | Caroline | 10 min |
| 2 | Merge this branch to staging; confirm CI green, then make the typecheck step blocking | Turns 126 unit tests + 5 browser suites into real gates | qa-release | S |
| 3 | rAF-coalesce city drag rendering + cache viewport rect; tighten `HIVE_MAX_RENDERS_PER_MOVE` to 1 | Drag lag on iPhone during Bear Trap setup | map-engineer · map-performance-profiling | S |
| 4 | Baseline schema + RLS migration captured from live DB; RLS tests with anon/non-officer | Can't safely change sync without it | supabase-architect | M |
| 5 | Conditional cloud push (`updated_at` guard) + local outbox/retry | Stops officers overwriting each other; offline edits reach cloud | supabase-architect · roster-sync | M |
| 6 | Roster → Hive auto-sync end-to-end test in CI (`hiveBrowser.cjs`) + bridge contract test for removal/rename/duplicate FID | Priority area; currently only unit + one fixture | map-engineer · bear-hive-planning | S |
| 7 | Foundry participants: wire squads to Legion siblings (block a player in both Legions), harden `balanceSquads`, Playwright flow for add → balance → copy | Priority area | mobile-ux-designer · bear-trap-calculations | M |
| 8 | Arena lineup: Wilson-interval win rates from recorded battles with n shown; browser test for tap-to-place and drag swap on touch | Priority area; avoid over-claiming | arena-modeller · arena-modelling | M |
| 9 | `joinerMeta.js`: add `source`, `tier`, `checked` per row; reconcile with the sheet; fix `Jessie**`; pin with a test | Evidence standard; formation advice drives real rallies | wos-researcher · wos-research | M |
| 10 | Fix `eventMs()` to UTC + test | UTC rule | any | XS |
| 11 | Code-split XLSX (dynamic import) and heavy tabs (`React.lazy`) | Faster cold start on phones | mobile-ux-designer | S |
| 12 | iPhone audit pass of all 5 tabs (targets, safe areas, sticky bars); fix blockers | Mobile layout and gesture correctness | mobile-ux-designer · iphone-ui-audit | M |
| 13 | Split EventsTab (1092), RosterTab (550), FormationPicker (484), useAppState (409); move App.jsx header hex to `C.*` | Ratchet debt down | any | M–L |
| 14 | Self-host Tabler icons (or inline SVG) + PWA offline cache | Works with poor signal mid-event | mobile-ux-designer | S |
| 15 | Delete stale root `/App.jsx` (after confirmation) | Removes a misleading duplicate | any | XS |
| 16 | Cloud sync for events and Hive plans (design first) | Multi-officer coordination | supabase-architect | L |

Manual checks that automation can't close: physical iPhone Safari (safe areas, keyboard, PWA mode), authenticated live provider refresh, Supabase RLS behaviour against the real project.
