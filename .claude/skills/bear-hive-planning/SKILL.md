---
name: bear-hive-planning
description: Work on the Bear Hive planner embedded in the Hive tab — city slots, templates, trap placement, locks, undo, attendance groups, reported locations and the React↔planner bridge. Use before editing anything in public/hive/ or src/components/hive/.
---

# Bear Hive planning

## Architecture
- React `HiveTab` → `HivePlannerFrame` renders `/hive/index.html?state=<id>&alliance=<tag>` in a **same-origin iframe**.
- `embed-bootstrap.js` validates the query and sets `HiveEmbed.key = bear-hive-intel:state:<state>:alliance:<encoded tag>` (+ `-history`, `-dark`). The standalone `bear-hive-v1` key is never read or written.
- `embed-guard.js` wraps `Hive.validate` so backups from another state/alliance are rejected.
- `intel-bridge.js` / `intel-model.js` receive a minimal roster via origin+source-checked `postMessage` (local ID, chief ID, exact name, furnace, validated coordinates). No tokens, secrets or provider payloads cross the bridge.
- Planner state is global `state` in `app.js`; mutations go through `commit(fn)` (undo/redo, persistence). Pure rules are on `Hive.*` (`moveCity`, `moveMapItem`, `assignSlotMember`, `applyHiveTemplate`, `placeUnassignedPlayers`, `validCityPosition`, …).
- Full contract and validation history: `docs/HIVE_INTEGRATION.md`. Template provenance: `public/hive/TEMPLATE-SOURCES.md`.

## Rules
1. **Vendored code:** keep diffs minimal, record every change in `docs/HIVE_INTEGRATION.md`, prefer fixes that can be upstreamed to `caroline3543/Bear-Trap-Calculator`.
2. **Never lose a plan.** Sync never deletes members, never clears slots/locks/notes/attendance; templates clear assignments only after an explicit preview; storage-full shows "Download a backup now".
3. Legality (overlap, blocked world tiles, trap bounds) only via `Hive.*` model functions.
4. Planned slot ≠ reported location. Locating cities never changes planned slots.
5. Templates contain geometry only — no names, IDs or attendance. Territory coverage and in-game legality are "not proven"; say so in UI.
6. The planner keeps its own green identity and CSS. Don't apply React `C.*` tokens inside `public/hive/`.

## Test fixtures
- Standalone, no build needed: serve `public/` and open `/hive/index.html?state=3543&alliance=LUN`. Seed with
  `const d=Hive.demo();d.settings.state='3543';d.settings.alliance='LUN';localStorage.setItem(HiveEmbed.key,JSON.stringify(d))` then reload.
  Note: `state`, `renderMap`, `point`, `selectedMapItem` are script-scope globals — use `typeof state!=='undefined'`, not `window.state`.
- `tests/hiveCityDragBrowser.cjs` (drag/undo/lock/persist/render budget), `tests/hiveBrowser.cjs` (embedded in the app with roster bridge), `tests/hiveIntegration.test.js`, `tests/hiveLocationFetch.test.js`.

## Done means
`npm test` + `npm run test:browser -- hive` green, a phone screenshot of the changed view, and the vendored-change list updated.
