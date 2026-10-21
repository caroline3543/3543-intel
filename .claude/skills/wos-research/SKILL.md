---
name: wos-research
description: Research and verify a Whiteout Survival mechanic, number, hero skill, formation or formula before it goes into 3543 Intel. Use whenever code or copy would state a game fact, and when auditing joinerMeta.js, arenaResearch.js or hero catalog data.
---

# WoS research and formula verification

The rule: **never invent game formulas.** Every game fact in the app carries one evidence tier.

| Tier | Counts as | App may… |
|---|---|---|
| OFFICIAL | In-game text/screenshot, Century Games help centre, official patch notes/posts | encode as a rule |
| COMMUNITY-TESTED | Reproducible test with method + data, named tester, date | encode as a rule, cite in source notes |
| SPECULATIVE | Tier lists, opinions, unsourced or AI summaries, single anecdotes, your inference | show only as "estimate"/"trial", never as fact |

## Steps
1. **Check what's already decided.** Grep the repo first: `src/data/joinerMeta.js`, `src/data/arenaResearch.js`, `src/data/heroCatalog.json` + `HERO_CATALOG_SOURCES.md`, `docs/ARENA_RESEARCH.md`, `public/hive/*SOURCE*.md`, `CLAUDE.md` → Game mechanics.
2. **Define scope.** Which mode? Exploration Arena ≠ Expedition/troop combat ≠ Bear Hunt ≠ rally/garrison. Which generation/season? Which server age (State 3543)?
3. **Search primary sources** (delegate to the `wos-researcher` agent for anything non-trivial). Resolve name aliases: Jessie* = Jessie/Jasser/Jeronimo; Sergey** = Sergey/Bahiti/Lumak Bokan; Seeyoon = Seo-yoon. Check that wiki URLs show the hero they claim to.
4. **Grade each claim** and record: source URL, date checked, game version if known.
5. **Encode** only OFFICIAL/COMMUNITY-TESTED data, in a data/service file (not a component). Put the source + date + tier next to the data (comment or field). Add a test that pins the encoded values so silent edits are caught.
6. **UI wording** for anything SPECULATIVE: "Trial", "Estimate", "Community suggestion — test before relying on it". Never "best", "optimal", "guaranteed".
7. **Ask Caroline** for in-game confirmation when sources conflict — she can screenshot.

## Known data issues (as of 2026-10-21)
- `joinerMeta.js` Gen 1–6 is transcribed from Tonton's community sheet (COMMUNITY sheet, itself flagged "not all formations up to date after the December update"). Rows were added that are not in the sheet (e.g. Gen 4 Defense 50/2/48, Gen 5 "Logan & Norah & Greg"), and some differ (Gen 5 Defense leaders "Hector/Logan" vs sheet "Hector"; Gen 5 48/4/48 alt2 "Zinman" vs blank). Gen 7–9 rows have no recorded source. Rows have no per-row source/tier field yet.
- Sheet row Gen 6 "Jeronimo & Renee & Greg" lists `Jessie**` — `**` is the Sergey legend marker, so it's almost certainly a typo for `Jessie*`. Confirm before relying on substitution logic for that row.
- `eventMs()` in `eventListHelpers.js` parses event dates without `Z` (local time) — game times are UTC.

## Deliverable
A short evidence table in the PR description (claim | tier | source | date), and the tests that pin the values.
