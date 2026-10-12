# Battle allocation and live player pool

Extends the existing Battle tab, existing event-linked plans and isolated Live Room. No production dependencies added.

## Operator workflow
1. Open a plan and expand Battle pool. Attendance seeds planning estimates; manually confirm Ready/Offline/Busy/Returning/Healing. Override troop tiers, available counts for the recorded tiers, capacity, Skill-5 heroes and commander leader rank. Temporary participants stay in the event pool.
2. Create castle/turret slots or preview auto-fill. Qualified leaders are assigned castle-first unless target priority is overridden. Commander rank wins when supplied; otherwise recorded troop power is only a proxy, and unknown strength is labelled.
3. Configure each rally's exact Infantry/Lancer/Marksman ratio, tier policy, wave, target joiner count, capacities and locks. Strict Helios never downgrades. Preferred-tier alternatives must be explicitly accepted.
4. Preview rebalance, inspect warnings, apply or cancel. Undo is available only while the plan and pool remain unchanged. Different waves allow reuse; live commitments block reuse until explicitly released.
5. Go Live. Confirming an opening commits leader, priority joiners and filler troop IDs. Troops returned releases that commitment; completing/cancelling a timer does not assume a return. Pool status changes do not rewrite active timers.

## Rules
- Floaters are eligible across rallies, not simultaneously committed to them.
- Priority providers count inside the target joiner count; leaders are excluded from that count.
- Hero alternatives come from the selected/matching formation metadata. Named fallback sets and one-Mia constraints are encoded where present in the source. Skill 5 is required; hero class does not dictate supplied troop type.
- Allocation is a deterministic heuristic, not a combat simulator or a guarantee of victory. Scarce preferred providers are placed first; then flexible troop fillers are distributed across the wave. The main-castle mode concentrates fillers instead.
- Counts are exact only when rally capacity, leader contributions, recorded-tier quantities and march caps are supplied. Otherwise coverage stays estimated, with missing-type/quantity warnings.
- Manual availability is separate from RSVP attendance. No in-game presence API is assumed.
- Plans and assignment locks use existing plan storage/cloud sync. Event-specific overrides, temporary participants, active commitments and holding reports use isolated local svs_battle_pool_v1 storage. They are device-local.
- Existing timers, preset data, joiner forms, formation controls, checklist, summary and test result logs remain available. Large plan UI was split into smaller colocated sections while retaining its structure.

## Verification
35 Node tests pass. React StrictMode DOM checks cover allocation preview/apply/undo, persistent readiness, stale-preview rejection, offline leader exclusion, and live opening/return commitments without timer resets. Vite production build and diff checks pass. Real-browser geometry and actual iPhone testing remain outstanding. Existing bundle-size warning remains.
