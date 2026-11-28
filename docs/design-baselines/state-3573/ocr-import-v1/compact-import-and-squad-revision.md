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

## Implementation and review evidence

- Both import methods enter the same ordered review list. Successful rows are 35 CSS px with a green check and full, right-aligned integer power. The All and Needs review filters are visible above the list. Edit controls for resolved rows are available through Review options.
- Resolve identity, power and registration exceptions inline. A selected candidate becomes a match only after confirmation. The final confirmation shows changed values and projected legion capacity before the one save action.
- The paste entry accepts a copyable transcription prompt, explicitly labels the fallback legion and reports invalid source line numbers before review. The screenshot entry retains image processing, evidence crops and draft recovery.
- The Squad Balancer uses purple count and leader selections, places Settings behind disclosure and confirms rebalancing after teams exist. Existing locked and manually assigned players stay on their teams. Reducing the count requires moving protected players off removed teams first.
- Capture the unmodified browser journey at 320, 390 and 428 CSS px. Review captures against the Stage 9 dark workspace, context and confirmation requirements and the newer compact interaction references. The original PNG checksums continue to identify the Stage 9 reference set.

### Paste-only preview

The Foundry and Canyon Clash import workspace opens directly to the player-list field. Screenshot upload, processing stages and OCR assets are excluded from this preview. The copyable external extraction prompt uses four tab-separated fields. A separately supplied permanent player ID is still accepted in pasted data.

Keep compact matching, registration review, the manual confirmation for a move, and the gold Squad Balancer action. Preserve saved paste text and decisions on the device. Existing import receipts remain available for verification, including receipts created through the older screenshot workflow. Legacy screenshot drafts remain in browser storage.
