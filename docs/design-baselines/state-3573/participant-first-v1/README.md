# Participant-first planner v1

Approved 2026-11-28; issue #54. This is a textual design contract, not a completed screenshot baseline. Preserve the original ../ocr-import-v1 baseline unchanged. Base release commit: 855302648fce05cbb4918bde3e36fa42c6ce40b7.

## Screen reference manifest

| ID | Screen | Required layout and behaviour |
|---|---|---|
| R01 | Empty planner | Event/alliance/legion context; 0/30 combatants and 0/10 substitutes; Register players primary; Import roster and Record troop power secondary; empty participant list. |
| R02 | Combatant selection | Search, count, compact member cards, gold selected perimeter, bulk selection, haptics, other-legion protection. |
| R03 | Substitute selection | Same layout, excludes selected combatants, 10 maximum, skip available. |
| R04 | Participant power | Selected participants only, grouped by status, editable numeric fields, missing count, bulk paste. |
| R05 | Review | Counts, power summary, missing power, edit/back and explicit confirm. |
| R06 | Independent power | All alliance members accessible, filters All/Combatants/Substitutes/Not participating/Missing power, manual numeric fields and bulk paste, no registration changes. |
| R07 | Populated planner | Registered participants only; edit participants, update power, squad balancer; nonparticipants hidden. |
| R08 | Bulk paste | Compact AI extraction card with Copy prompt, Edit, sync status; paste list; Review matches. |
| R09 | Prompt editor | Editable prompt, save, restore default, cross-device sync. |
| R10 | Match review | Preserve compact 3543-style matching, existing aliases, uncertain matches, duplicate/conflict review. |

## Functional invariants
Foundry and Canyon Clash only. Empty new roster; existing registrations only. Manual registration and AI roster paste converge on review. Shared parser/matcher; power-only mode never changes registration. Preserve exact multilingual names, explicit status and legion, support both legions, protect other-legion and alliance boundaries. 30 combatants and 10 substitutes per legion. Only combatants in automatic squad balancing; unregistered players excluded from legion totals. Preserve event-specific power history and timestamps across weekly resets and removal. Keep existing dark theme and compact mobile density. No disposable Supabase.

## Release gates
Capture and approve reference screenshots R01–R10 before implementing changed screens; textual manifest is not a substitute. Test at 390 and 430 CSS px, keyboard open, long names, scrolling and missing power. Compare actual browser screenshots to locked reference assets; document differences and require approval for material deviations. Test all functional invariants, aliases, prompt sync, cross-device persistence and permissions. Attach CI evidence and preview verification. Do not silently regenerate references from implementation. Production deployment requires applicable authorization.

## Status
Existing Stage 9 PDF and eight PNGs located in repository tree. New R01–R10 screenshot assets outstanding; no visual or functional pass claimed.
