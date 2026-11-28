# Approved compact import and squad balancer revision

Approved 2026-11-28. This supplements Stage 9; unrelated visual and functional requirements remain unchanged.

Reference: 3543 production commit 8767d7163009fd5d5b28b6684a8bcb0e14be85ac, src/components/events/AddParticipantPanel.jsx and SquadBalancerPanel.jsx.

## Import review
- Foundry and Canyon Clash only. Offer paste list alongside screenshot upload; share identity and registration safeguards.
- Default to all rows visible; compact 32–36 CSS px matched rows, green check, name and right-aligned power. Expand ambiguous rows inline. Provide All / Needs review filter and final import action.
- Preserve permanent IDs, verified aliases, collision checks, cross-legion protections, power validation and explicit review of uncertain matches. Never silently create duplicate players.
- Target matching under 250 ms for 40 pasted rows against 1,000 records; measure separately from extraction and rendering.

## Squad balancer
- One compact configuration panel, 2–6 team count buttons, optional selectable leader chips, selected count, one Auto-Balance N Teams action. Use existing 3573 purple theme.
- Each leader anchors a distinct team. Exclude substitutes; scope to selected event/alliance/legion. Preserve locked assignments, manual adjustments, event-specific power, language and works-well-with preferences where feasible. Advanced preferences behind optional settings. Warn about missing power. Do not silently discard locks or players when reducing team count.
- Verify 320/390/428 px layouts, keyboard accessibility, touch targets, no overflow, leader limits, no duplicate assignments, and balancing regression tests.

No production release without explicit approval. This document records requirements, not implementation or benchmark evidence.
