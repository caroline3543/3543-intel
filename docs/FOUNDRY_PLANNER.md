# Foundry planner implementation brief

Research and implement a mobile-first Foundry Battle planner inside 3543 INTEL. Start with WOS Tools, compare publicly discoverable alternatives, and synthesize useful workflows rather than embedding another site. Reuse existing members, preserve Unicode and FC strings, and keep all times UTC. Provide separate legion plans, phase-based multi-building targets, colour-coded teams, leaders, joiners, substitutes and loot patrols, individual instructions, local persistence and backup round trips. Export a high-resolution colour map with a readable team battle sheet inspired by the supplied HOT reference. Preserve existing navigation and design tokens. Verify the build, roster handling and backup merge. Deliver on a feature branch for review.

## Research, 18 October 2026

A bounded search cannot establish that every planner online has been found. Publicly discoverable tools reviewed:

| Tool | Useful workflow |
|---|---|
| https://wostools.net/foundry-planner | Phase targets, reusable players, leader/joiner rows, image output |
| https://whiteoutsurvival.dev/foundry-team-planner | Map overlays, legion/time, loot team, map/roster/battle sheets |
| https://wosguru.com/foundry | Building squads and movement when centre opens |
| https://wostoolkit.com/foundry | Phase responsibilities and copyable battle sheets |
| https://whitesim-lab.com/en/tools/foundry-battle/ | Phase operations and optional mock battles; assumptions explicitly approximate |
| https://www.anotherhq.com/ | Foundry team/map planning advertised; interactive workflows not fully verified |
| https://www.whiteoutsurvival-community.com/tools/wosc-index.html | Foundry assignments, rally leader checks, Discord-ready plan advertised |
| https://alliance300.com/ | Foundry battle planning advertised; detailed workflow not verified |
| https://wostools.app/ | Browser-local Foundry planning advertised |

## Delivered scope and verification limits

Native Foundry tab, multiple legion plans, duplication/deletion, editable three-phase targets, 4 initial teams with up to 9 total teams, loot patrol designation, existing roster picker and guests, roles and notes, schematic map with coloured target sectors, PNG download/native file sharing with download fallback, text battle sheet with clipboard fallback, JSON backup persistence and timestamp-aware merge.

PNG shows the selected map phase and all three phases in the team sheet. The map is an original schematic, not the game's battlefield artwork. Duplicate players are prevented in the existing roster picker and reported in validation; multiple teams may deliberately share an objective. No unverified point formulas, enemy simulation, external Discord posting, public share-link hosting or third-party source/assets were imported. Foundry records are device-local and included in JSON backups; existing cloud sync does not sync them. Actual iPhone export/share verification remains necessary before production merge.
