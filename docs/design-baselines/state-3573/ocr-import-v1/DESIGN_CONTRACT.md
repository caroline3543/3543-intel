# State 3573 Stage 9 design contract v1.0
Status: approved interaction direction; reconstructed visual references require confirmation before pixel-exact enforcement.
Scope: Foundry and Canyon Clash, all alliances, both legions. TAL excluded. Development branch fix/3573-ocr-upgrade; no production changes without approval.

## Visual invariants
Dark background #101A28; panels #1B2A3B; accent #D9B778; muted #A8B8CA; evidence #A7C2EC with #233E67 text. Persistent Foundry/Canyon, alliance and legion context; compact progress strip; clear title; one dominant action; secondary actions subdued. Dedicated workspace, no underlying roster visible. Reference viewport 428x926 CSS px (iPhone 13 Pro Max); test 390x844 and 320px width too. Reference reconstruction uses 20px margins, 10px radii and 50px primary action; these are proposed geometry, not measured original values. Minimum 44px touch targets, safe-area-aware sticky footer, no horizontal overflow, keyboard-safe editing, readable long Unicode names. Support light mode via existing design system; obtain approval for light reference before locking pixels.

## Screen contracts
- **01-import**: Select mode before scanning. First-use default powers only; remember last explicit choice. Primary action: Scan 21 screenshots.
- **02-processing**: Stop after current screenshot; resume unread files. No roster mutation. Primary action: Stop scan.
- **03-summary**: Counts are illustrative; real counts derive from current batch. Skip queue when no exceptions. Primary action: Resolve 4 examples.
- **04-identity**: Show real crop, candidate avatar and context. Confirm advances; search permits a different identity. Primary action: Confirm match.
- **05-power**: Offer actual competing values when available; validate positive safe integer. Never invent evidence. Primary action: Confirm troop power.
- **06-registration**: Preserve uncertain roles; explicit before/after approval for transfers, removals and role changes. Primary action: Keep existing registration.
- **07-review**: Expandable changes; exclusions reversible; validate live capacity and stale assignments before saving. Primary action: Confirm import.
- **08-completion**: Only display success after persistence verified. Show failures and recovery if needed. Primary action: Continue to Teams.

## Functional acceptance
F01 First use powers-only; remember explicit mode. Mode-specific exceptions only.
F02 Up to 25 images, hash deduplication, incremental processing, cancel/resume, failed image retry; no mutation during scan.
F03 Perfect import bypasses exceptions; unresolved queue defaults first, auto-advance with free navigation, skip/revisit/undo; multiple issues per player together.
F04 Exact unique identity only automatic; fuzzy suggestions require confirmation; manual search may select another player; dedupe confirmed IDs; stable row identifiers preserve edits.
F05 Original cropped evidence visible; competing power values selectable; validate numeric input; no fabricated values.
F06 Propose safe detected additions only after classifier verified; unknown/unassigned/other-legion preserve; role changes/transfers/removals explicit approval. Validate capacity and current event IDs.
F07 Final review summarises powers, combatants, substitutes, transfers, exclusions and capacity; expand details; reversible exclusions. No changes before final confirmation.
F08 Persist draft mode, evidence and decisions across navigation and refresh where supported; adding images retains unaffected decisions, reopens changed evidence only.
F09 Save atomically or report actual partial outcome; verify persistence, avoid duplicate retry, handle concurrent edits and stale events. Never show false success.
F10 Completion reports actual persisted changes and routes directly to Teams; preserve roster context.
F11 Test isolated data only; existing manual roster, teams and buildings unaffected.
F12 Target <=5 minutes from screenshots to confirmed roster; report measured timing and dataset size; zero incorrect automatic identity/legion changes.

## Baseline governance
PNG references are reconstructed, not captured from the original host. Confirm their fidelity with owner, then capture approved implemented screens at fixed viewport, DPR, browser, fonts, theme, fixture and state. Store immutable approved screenshots in version control. Run Playwright screenshot comparisons and behavioural assertions in CI. Disable animations and mask only documented dynamic content. Proposed initial tolerance: 0.1% differing pixels in deterministic same-renderer captures; any material hierarchy, spacing, clipping, colour or interaction change fails regardless of score. Never auto-update snapshots. Compare actual, expected and diff; record intentional exceptions with approval and version bump. No claim of passing without executed evidence.
