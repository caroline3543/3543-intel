# State 3573 TAL planner design review

## Goal

Help a state leader combine players from HOT, ARC, RKG, LUN and other loaded alliances into host-alliance legions, with different availability and an explicit in-game registration handoff. Primary target: phone use, without dragging or horizontal spreadsheet grids.

## Three concepts

An independent reviewer acting as a UX designer and R5/state organiser used Ease /30, Clarity /25, Correctness /25 and Mobile /20.

| Concept | Ease | Clarity | Correctness | Mobile | Total |
|---|---:|---:|---:|---:|---:|
| Guided Setup → Times → Legions → Review | 28 | 23 | 21 | 17 | 89 |
| Spreadsheet availability/assignment grid | 21 | 19 | 22 | 10 | 72 |
| Drag-and-drop legion board | 19 | 16 | 18 | 12 | 65 |

The guided approach won because prerequisites and next actions remain visible, while completed steps stay directly accessible.

## Implementation iteration

The first actual source review scored **81/100**. The reviewer identified duplicate time-triple choices for separate availability groups, an offscreen move editor, confirmation of unsaved time options, and unrecoverable missing-player assignments.

Corrections:

- Choose timing samples against remaining availability cohorts before balancing final assignments. The reproduced 15+15 disjoint-cohort case now produces two suitable triples and assigns all 30 players.
- Scroll and focus assignment editing, with errors beside the editor.
- Disable time confirmation while visible edits differ from saved options.
- Provide an Unassign action for a deleted/missing roster player.
- Use the configured attendance target consistently and filter registration checks by legion.

Re-review score: **89/100** (Ease 26, Clarity 23, Correctness 22, Mobile 18). No remaining release blocker was found in that review. This is source-and-test judgment, not a real-device usability study or proof that the allocation heuristic is globally optimal.

## Rules and source handling

Indexed official support excerpts report up to 30 combatants and 20 substitutes, roster finalisation after sign-up, return-to-host requirements, and matchmaking based on the top 20 registered players’ troop power. Official and community time lists differ: one official article lists 09:00 where the user's existing poll and community guides list 19:00. The app therefore defaults to the user's poll, allows five time options to be edited, and requires manual in-game confirmation.

The app distinguishes game rules from the user’s adjustable planning preferences (two-of-three availability, per-time combatant target, and up to three hosts in this plan). Dates, second-legion unlock and player eligibility must be checked in game. It never registers or transfers game accounts.

Sources reviewed 2026-11-07. Official deep articles returned 404 on direct fetch after their indexed excerpts were reviewed; the app therefore links to the Help Center and the accessible community guide, and explicitly requires in-game confirmation. No fixed live event calendar or guaranteed universal slot list is inferred:


- https://centurygames.helpshift.com/hc/en/64-whiteout-survival/faq/8419-how-are-the-combatants-for-tundra-arms-league-selected/
- https://centurygames.helpshift.com/hc/en/64-whiteout-survival/faq/8415-q-can-i-leave-my-alliance-during-tundra-arms-league/
- https://centurygames.helpshift.com/hc/en/64-whiteout-survival/faq/8409-how-is-tundra-arms-league-held/
- https://centurygames.helpshift.com/hc/en/64-whiteout-survival/faq/8413-how-does-matchmaking-in-tundra-arms-league-work/
- https://centurygames.helpshift.com/hc/en/64-whiteout-survival/faq/8424-tundra-arms-league-battlefield-rules/
- https://outof.games/realms/whiteoutsurvival/guides/498-tundra-arms-league-in-whiteout-survival/

## Validation

178 Node tests passed, including seven new state-planner tests: distinct time cohorts, manual assignment preservation, uniqueness and 30/20 caps, excluded/unanswered players, atomic move/swap, availability and coverage warnings, and Excel ID preservation.

Isolated DOM checks passed for host setup, unsaved time confirmation, player participation/time editing, preview-before-apply, different availability cohorts, focused move/conflict handling, missing-player recovery, review/export and incomplete-plan lock prevention. The standalone build passed. Physical iPhone testing remains outstanding.
