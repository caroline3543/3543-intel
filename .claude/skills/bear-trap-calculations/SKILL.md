---
name: bear-trap-calculations
description: Verify or change Bear Trap logic — event timing, attendance/reliability, trap (BT1/BT2) grouping, rally and joiner timing, troop/squad allocation. Use for the Bear Trap event type in Events, the Hive planner's trap/attendance model, or when porting logic from Caroline's separate Bear Trap Squad Calculator.
---

# Bear Trap calculations

## Where Bear Trap logic lives
- **This repo**
  - Event type `'Bear Trap'` (`src/utils/constants.js` EVENT_TYPES) — attendance via the shared Events system (`eventListHelpers.js`: `evSum`, `noShowStreak`, `recentMisses`).
  - Hive planner (`public/hive/`): two traps (BT1/BT2), trap assignment per member, attendance model (`attendance-model.js`, `Hive.attendanceStats`, `frequencyLabels`, `routeAttendanceGroups`), operations/schedule (`operations-model.js`: `generateSchedule`, `rallyInstruction`, `eventClock`).
  - Rally timing (shared with SvS): `svsTimingService.js`, `rallyTimingParser.js`, `castleTimingService.js`.
- **Separate app — do not import from it blindly:** `caroline3543/Bear-Trap-Calculator` (bear-trap-calculator.vercel.app). Squad strategies "Enough Troops" / "Short on Troops", accounts A/B, optional T11 "Helios" tier used first. Treat it as a reference implementation; port logic with its tests, not by copy-paste.

## Fixed rules
- All times UTC. `Date.UTC`/`'…Z'` only; never `new Date('YYYY-MM-DDTHH:MM')`.
- Rally leader *opens* the rally; the game auto-marches. Open = Impact − March − Rally duration. Durations 1/3/5 min. March input: last two digits are seconds (`412` = 4:12; `475` invalid).
- No joiner countdown timers.
- Attendance: substitutes excluded from reliability denominators; excused absences neither extend nor break streaks; unknown attendance stays unknown (not 0%).
- Troop tiers: T10 = "Apex", T9 = "Supreme" in Caroline's calculator vocabulary; FC levels are strings `"FC1"`–`"FC8"`.

## Anything numeric about damage, rally caps, march sizes or troop ratios
Run `wos-research` first. If it isn't OFFICIAL or COMMUNITY-TESTED, it can't be a hard rule — present it as a configurable default with a "community suggestion" label.

## Verification
1. Write `node:test` cases with synthetic members covering: BT1/BT2 split, substitutes, excused, unknown attendance, UTC boundaries (23:59→00:00), invalid march input.
2. `npm test`; for Hive changes also `npm run test:browser -- hive`.
3. Cross-check one real (anonymised) scenario against the standalone calculator output and note any difference in the PR.
