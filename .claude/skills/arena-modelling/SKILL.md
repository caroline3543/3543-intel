---
name: arena-modelling
description: Build or change Arena lineup selection, hero/gear comparisons, battle-result statistics or win-probability estimates in 3543 Intel. Use for anything under src/components/stats/arena, arena*Service.js or useArena*.js.
---

# Arena modelling

## What exists (don't rebuild it)
- UI: `src/components/stats/arena/*` (ComparePanel coordinator, Formation, TeamEditor, HeroEditor, GearComparison, HolgerBonuses, BattleLog, Assessment, ResearchNotes, PlayerFetch).
- Services: `arenaComparisonService` (formations, swaps, gear gaps), `arenaHolgerService`, `arenaResearchService` (skill arithmetic from `src/data/arenaResearch.js`), `arenaResultsService` (bounded per-state battle log), `arenaFetchService` (authenticated proxy → isolated comparison profile).
- Hooks: `useArenaResults`, `useArenaPlayerFetch`, `useArenaPortraitDrag` (touch + mouse portrait swap, undo).
- Tests: `tests/arenaComparison|arenaFetch|arenaResearch.test.js`, `tests/arena*Browser.cjs`.
- Research record: `docs/ARENA_RESEARCH.md`, `docs/ARENA_COMPARISON.md`.

## Rules
1. Label every displayed number: **skill-text**, **from your N recorded battles**, or **trial**. No unlabeled win %.
2. Win-rate estimates come only from recorded results. Use a Wilson score interval:
   `p̂=w/n; z=1.96; centre=(p̂+z²/2n)/(1+z²/n); half=z·√(p̂(1−p̂)/n+z²/4n²)/(1+z²/n)`.
   Show "too few battles" for n<10. Never extrapolate to an untested lineup.
3. No combat simulator claims without OFFICIAL/COMMUNITY-TESTED damage, targeting and turn order (run `wos-research`). Placement advice stays a reversible trial.
4. Hero power and player power are not Attack. Random skill ranges stay ranges. Unknown ≠ 0 ≠ locked.
5. Lineup edits preserve exact hero objects, equipment, Holger inputs and opponent snapshots; Undo always available; defence positions protected unless the explicit correction mode is on.
6. Arena results are per-device and per-state (`localStorage`); never written into roster players.

## Workflow
- TDD: add a failing `node:test` with synthetic heroes → implement in a pure service (≤200 lines) → wire UI (≤300-line components, `C.*` styles, 44px targets).
- Verify: `npm test`, `npm run test:browser -- arena`, then an iPhone check of drag-to-swap (tap-to-place must also work without drag).
