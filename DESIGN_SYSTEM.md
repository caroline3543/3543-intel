# Shared Design System

**Repository context:** `caroline3543/3543-intel`  
**Applies to:** 3543 Intel, 3573 Caroline, 3739 Caroline  
**Status:** APPROVED CONCEPTUAL DESIGN · DRAFT DOCUMENT · NOT IMPLEMENTATION AUTHORISATION  
**Review:** 8/8 stages approved (100%)  
**Scope:** Shared design principles, components, UX rules, acceptance criteria and app-specific adoption governance.

> This file is a review artifact only. It has not been added to any repository. Approval of this design does not approve coding, commits, migrations, data changes or deployments.

## 1. Governance and scope

One shared specification defines design tokens, semantic patterns, component contracts, terminology, accessibility and error handling. Each application independently approves adoption of changes, tests regressions and controls which features are enabled. Shared standards **do not** imply a shared codebase, common database, automatic deployments or feature parity.

| Application | Identity accent | Scope guard |
|---|---|---|
| 3543 Intel | Warm gold `#E6B35E` | Its own authorised state/alliance workflows |
| 3573 Caroline | Soft blue `#8FA8D8` | Only approved 3573 tabs and functionality |
| 3739 Caroline | Sage `#9BC5B1` | Only approved 3739 functionality; Canyon Clash generator remains 3739-only |

**Change control:** Record the proposed component change, affected apps, per-app feature scope, visual/functional acceptance criteria, accessibility checks and regression results. Obtain explicit approval for each adopting app before implementation and separate approval before deployment. App-specific exceptions must be documented; never silently propagate features or overwrite app-specific behaviour.

## 2. Foundations and tokens

### 2.1 Colour

| Token | Value | Use |
|---|---|---|
| Canvas | `#0B1525` | Main dark background |
| Surface | `#1A293D` | Cards, panels |
| Elevated surface | `#26384D` | Menus, elevated controls |
| Border | `#364B62` | Low-emphasis separation |
| Primary text | `#F5F7FA` | Primary information |
| Secondary text | `#A8B8CA` | Supporting information |
| Success | `#83B8A0` | Confirmed positive state |
| Danger | `#E28C85` | Destructive/error state |

The three app accents are identity treatments, **not** substitutes for semantic success, warning, error or team colours. Blue, Yellow, Green and Pink team colours must have consistent meanings across TAL/Foundry, supplemented by visible text labels. Contrast target: WCAG AA 4.5:1 for normal text, 3:1 for large text; interactive boundaries and focus indicators 3:1 where applicable. Validate actual colour pairings before shipping.

### 2.2 Typography, spacing, density

- Use system font stacks with Unicode fallback to preserve stylised, Korean, Chinese, Arabic and other player names without transliteration.
- Baseline sizes: page title 24px, section title 18px, player name 16px, body 14px, supporting 13px, supplemental 12px. Support dynamic text scaling without hiding actions.
- Use 4px increments and an 8px spacing rhythm. Preserve a compact, information-dense roster without sacrificing legibility.
- Interactive targets must be at least 44 × 44px in touch contexts. Provide visible keyboard focus, clear pressed/selected/disabled states and reduced-motion alternatives.
- Prefer tabular numerals for aligned scores, rankings and power figures. Avoid ornamental borders and repeated headings that add no meaning.

## 3. Navigation and page structure

- Adapt navigation to viewport: bottom tabs on narrow screens, a compact intermediate layout and persistent sidebar on wide screens. Provisional breakpoints: under 700px mobile, 700–1099px compact, 1100px and above expanded; validate against actual content and safe areas.
- Show **only approved destinations** for the current app. Never expose unfinished features as live tabs by default.
- Use a compact contextual header with page title, relevant count/status and one clear primary action. Place **Manage** near the page title rather than as an app-level destination.
- Integrate **Add player** into the roster search/autocomplete affordance, with an unmistakable add icon or label. Save actions belong near the relevant editor; Generate belongs to planner context; destructive actions remain secondary.
- Preserve appropriate browsing state (search, filter, sort, scroll) on navigation and return. Manage selection and session-limited Undo do **not** persist across reload or account switch. Unsaved forms follow draft-recovery rules.
- Persist the **last saved event time** within the appropriate app/state/alliance/event context. Do not reset to a hard-coded 14 UTC when 12 UTC was saved.

## 4. Shared terminology and data semantics

| Label | Exact meaning |
|---|---|
| **City power** | Recorded player city power |
| **Troop tier** | User-facing troop progression/tier information and roster sorting option |
| **Troop-tier strength index** | Internal calculated index for sorting/comparison when valid coefficients are available; **not** actual troop power |
| **Troop power** | Recorded troop power used for applicable leader selection and balancing |
| **Selected** | Included in the current planning selection |
| **Available** | Meets the chosen event-time availability criterion |
| **Registered** | Registration is confirmed; separate from availability and selection |
| **Assigned** | Placed into a team, legion or building as specified |
| **Locked** | Protected against a named edit type, e.g. team assignment, registration or role |
| **Saved** | Latest write confirmed by the authoritative app server |
| **Synced** | External spreadsheet confirmed its update |
| **Missing info** | Missing information relevant to the current view or task |

**Final terminology decision:** Replace the user-facing term **“Troop strength”** with **“Troop tier”** throughout. A validated internal troop-tier strength index may support sorting, but must never be labelled as actual troop power. Do not imply that tier alone is a numeric troop-power measurement. Exact index coefficients remain an implementation dependency requiring verified game data.

A player may be selected but not registered, registered but unavailable, or assigned but not currently selected. Never collapse these into one Active/Inactive flag. Every lock must identify its scope.

## 5. Roster and player cards

### 5.1 Card structure

- Show player identity, contextual primary metric, and the existing **three compact coloured chips** for Infantry, Lancer and Marksman tiers. Do **not** replace the chips with large three-column troop tiles.
- Make Helios status visually more obvious with a restrained gold glow/sparkle on the applicable troop chip plus accessible text; avoid a redundant separate Helios chip.
- Show Labyrinth rank and game language where appropriate; include registration status/toggle in the appropriate planning context. Tap the card to open the player profile. A separate checkbox handles Manage selection.
- When sorting by a metric, show that metric prominently on each card. Missing values are labelled, not silently treated as zero.

### 5.2 Sorting and searching

- Visible quick sorts: **Name, City power, Labyrinth rank, Troop tier**.
- Accessible advanced sorts: Furnace, Kills, Labyrinth score, Missing info and other explicitly approved contextual fields.
- Support ascending and descending where meaningful. Labyrinth rank defaults to ascending (lower number is better). Put missing values last in both directions and use stable tie-breaking.
- Search current username, nickname, previous username and Player ID; prioritise exact Player ID matches. Autocomplete should explain alias matches and preserve Unicode. Never silently merge profiles because names resemble one another.
- Implement server-wide filtering/sorting **before** pagination. Infinite scrolling loads more near the bottom; include a visible Load more fallback and preserve scroll position after viewing a profile.

## 6. Manage and bulk actions

- Enter Manage from the contextual header. The selection checkbox is distinct from the profile-card tap target.
- Select all applies to **all matching filtered results**, including results not yet loaded, and must show the exact affected count. An entire-roster operation requires separate explicit scope selection.
- Freeze selected membership as stable Player IDs for the editing session. Changing filters must not silently add/remove targets. Clear selection on reload or account change. Recheck eligibility at execution and show affected/excluded counts.
- Provide contextual actions, with roughly three primary actions and a **More** menu:
  - Members: Language, Edit fields, other authorised roster operations.
  - TAL: Registration, Availability, Legion, Role, Locks, Works well together, Remove from TAL.
  - Foundry: Availability, Assign team, Role, Locks, Remove from event.
  - Team planner: Move, Assign zone, Clear assignment.
- Position mobile bulk controls above bottom navigation and safe areas.
- Routine reversible edits can save immediately with safe Undo. Significant mass changes require a review; destructive changes require confirmation.
- Undo is session-limited, latest eligible successful operation only, and revision-safe. Never use Undo to overwrite intervening edits.
- For partial failures, identify successful and failed Player IDs and retry **only** unresolved operations after safe verification. Separate backend-save status from Sheets-sync status.

## 7. TAL and Foundry planning

### 7.1 Page architecture and event context

One event-planner page contains four internal sections: **Players, Teams, Assignments, Share**. Keep event, alliance, legion and time context visible and persistent within the app. Do not introduce an additional app-level navigation destination or mandatory wizard for these sections. Scope data to app/state/alliance/event/legion.

### 7.2 Team generation and editing

- Use four teams: **Blue, Yellow, Green, Pink** for the approved TAL/Foundry planning contexts.
- Select team leaders by highest **recorded troop power**, not by troop-tier index.
- Offer exactly two generation intents:
  1. **Regenerate all teams:** rebuild from the current selected roster; may rearrange unlocked assignments, but must preserve explicitly locked team assignments.
  2. **Add unassigned players:** preserve every existing assignment and distribute only currently unassigned eligible players.
- Both paths generate a **preview**, run validation, and require explicit **Apply teams**. Cancel changes nothing. Read the current selection at generation time; later-selected players must not be omitted.
- Manual moves persist while editing. A locked assignment requires an explicit unlock before moving. Registration locks and role locks are distinct from team-assignment locks.
- Make the **entire username row** a practical drag target; differentiate tap from long-press/drag, prevent accidental text selection, provide generous drop zones and auto-scroll. Include a keyboard-accessible **Move to team** alternative.
- Three validation severities:
  - **Blocking:** duplicate assignment, invalid legion, selected player unassigned at apply time.
  - **Overridable warning:** missing recorded troop power, meaningful team imbalance.
  - **Informational:** cooperation preference mismatch, optional capacity missing when a capacity-dependent feature is requested.

### 7.3 TAL-specific rules

- State Alliance mode supports up to three host alliances; Solo Alliance mode is separate. Apply the approved eligibility rule of attending at least two of three event times where relevant.
- Registration, selection, availability, roles and legion assignment remain independent concepts. Follow the workflow-specific spreadsheet editing authority; do not assume the app can override every registration field.
- **Works well together** relationships are bidirectional. Consider language, reliable/priority joiners, voice coordination, T11→T10 fallback, Helios and a cooperation-aware balancing tolerance of approximately 5% when feasible.
- Structured joiner-hero data, Norah detection and rally/march-capacity information may inform advanced planning where validated.
- **Troop capacity is optional:** missing capacity never blocks registration, selection, manual assignment or standard team generation. Only capacity-dependent calculations may be unavailable or marked incomplete.
- Include the relevant troop-tier chips, language and Norah indicator only when applicable. Retain a visible, distinct Helios indicator.

### 7.4 Foundry-specific rules

- Keep team colour membership, opening building assignments and later movements as **separate data structures**. Do not hard-code permanent colour-to-building mappings.
- Opening assignment locations: Prototype I, Prototype II, Repair I, Repair II, Repair III, Repair IV, Boiler and Transit. Later movements are event-specific and editable.
- Flag assignments that become incompatible when a player is moved or removed. Do not silently rewrite building allocations.

### 7.5 Share and copy templates

- Templates can be created, edited, renamed, duplicated and deleted, with live preview and version history. Personal copies remain independent; shared alliance templates require authorised editors and conflict checks.
- Scope templates to app/state/alliance/event type and appropriate event context.
- Copy **the currently applied saved plan** by default. If copying a preview, label it explicitly as preview/unapplied.
- Output concise, readable team lists and opening assignments. Preserve Unicode player names. Use the edited team name as the header. Include full updated teams; do not append an unwanted “Absent” section.
- Template changes are separate from plan changes and must not silently modify applied assignments.

## 8. Statistics and visualisation

### 8.1 Information hierarchy

Use **Summary → Distribution → Detail**. Show the result and relevant threshold controls before graphs, then supporting distributions and inspectable underlying records. Avoid excessive decorative charts or summaries that overstate certainty.

### 8.2 Top-eight comparisons

- For each metric, independently rank the top eight eligible players **within each compared alliance**. Do not reuse a single top-eight roster across unrelated metrics.
- For higher-is-better positive scores, calculate lead percentage as `(higher total − lower total) / lower total × 100`, provided the denominator is positive and the samples are complete.
- A definitive Top 8 lead requires **eight valid metric records on each side**. If either side has fewer than eight, show available values and `n/8` coverage but **withhold the definitive lead**. Never zero-fill missing records.
- Distinguish missing from stale/outdated values. For lower-is-better metrics (such as Labyrinth rank), define and label a separate interpretation rather than applying the higher-is-better formula blindly.
- Copy summaries follow **Result → Evidence → Limitation**, including the compared metric, sample and scope. A single metric does not justify a broad claim that one alliance is universally stronger.

### 8.3 Furnace distributions and chart integrity

- Place FC/furnace threshold selectors **above** the chart. Order levels by actual game progression and include intermediate levels when available.
- Show counts and percentages with explicit denominators. Unknown furnace levels are **not** FC0.
- Clearly distinguish a full-roster distribution from a top-100 leaderboard subset; do not extrapolate subset percentages to an entire state.
- Selecting a bar should reveal the contributing players where authorised. Provide equivalent accessible table data and a textual summary.
- Coverage/completeness and freshness are **different indicators**. Show source, last successful refresh, sample size, metric-specific freshness criteria and limitations. Do not claim live data without confirmation.

## 9. Save states, Google Sheets and conflict recovery

### 9.1 Status contract

- **Unsaved changes:** local edits not confirmed by server.
- **Saving:** awaiting server confirmation.
- **Saved:** server confirmed the latest revision.
- **Spreadsheet sync pending:** app saved, Sheets has not confirmed update.
- **Spreadsheet sync failed:** app saved, Sheets update confirmed failed.
- **Conflict:** newer/different authoritative revision requires review.
- **Unknown outcome:** request was sent but its outcome cannot yet be confirmed.

Do not use a generic “Saved” message to imply Google Sheets has synchronised. Track last successful sync separately. Follow field/workflow-specific editing authority; two-way sync does not imply that either side always wins.

### 9.2 Write safety

- Every write carries a stable operation ID/idempotency key and expected revision. The backend must **enforce** idempotency and retain sufficient verification history; client IDs alone are not protection.
- If a response is lost, verify the original operation against the authoritative server **before any retry**.
- If confirmed succeeded, do not replay. If confirmed failed, allow safe retry. If still unknown, require review and do not silently retry.
- Prevent delayed queued Sheets updates from overwriting newer records. Resolve same-field conflicts explicitly; safely merge independent changes only when validation permits.
- After a merge, revalidate team uniqueness, assignment locks, legion and eligibility. Surface partial bulk outcomes by affected player.

## 10. Draft recovery and retention

| Recovery category | Approved period | Clock starts |
|---|---|---|
| Unfinished forms | 7 days | Last meaningful edit |
| Unapplied event-planner drafts | 14 days | Last meaningful edit |
| Unresolved save operations | Fixed 30 days | Original submission |
| Offline grace for unresolved operations | Up to 48 hours beyond deadline | Fixed, never rolling |

- Warn unresolved-operation users at **7 days, 3 days and 24 hours** before the fixed 30-day deadline.
- Maximum unresolved-operation recovery window is **32 days** including offline grace; cleanup occurs on the next available run after expiry. No silent retries during grace.
- Review differences **before restoring** a draft. Never overwrite newer saved revisions without explicit conflict resolution. Permit selective safe restoration of independent changes.
- Scope drafts to account/app/state/alliance/event and relevant legion. Do not expose a draft across account or alliance switches.
- Remove temporary recovery payloads once completed saves are reconciled, subject to separately defined server audit requirements. Deleting local recovery data does not undo server changes.
- Unresolved save-operation retention is **not** necessarily the retention policy for server audit logs.

## 11. Privacy and access controls

- Enforce all account/state/alliance/event authorisation **server-side**, including shared templates, roster edits, sync operations and recovered drafts.
- On logout or account switch, clear sensitive in-memory state and prevent access to cached drafts from the previous account. Revoked alliance access must prevent recovery of previously cached alliance information.
- Use appropriate platform storage protection for sensitive local drafts. Account-prefixed storage keys alone do not provide confidentiality. Never store plaintext credentials in drafts.
- Provide **Account → Settings → Privacy & local data** with Saved drafts, Unresolved changes and Clear local data.
- Explain that clearing device-local drafts does **not** delete server records. Confirm destructive local cleanup and distinguish hiding from secure deletion.
- Store only recovery-essential fields for the shortest approved duration. Treat server-side audit retention as a separate policy requiring its own controls.

## 12. Accessibility and inclusive interaction

- All critical touch controls meet 44px targets. Support keyboard navigation, visible focus, appropriate dialog focus management and Escape dismissal.
- Drag-and-drop must have a fully usable keyboard alternative. Do not rely on six-dot handles or colour alone to indicate available actions.
- Team colour, Helios status, locks, registration and validation severity require text/semantic equivalents. Screen readers must announce meaningful names, roles and states.
- Announce save success/failure, sync state, selection counts, assignment changes and validation results without unexpectedly moving focus.
- Error messages identify affected records/fields and give an actionable next step. Provide links/focus navigation to the issue when appropriate.
- Charts require equivalent tables and summaries reflecting the same active filters, samples and thresholds.
- Support dynamic type, long Unicode names, zoom and reduced motion. Never make essential information dependent on animation.
- Test full workflows, not only isolated components: bulk-select players, move a locked/unlocked player, resolve conflicts, interpret statistics and recover drafts.

## 13. Error handling and Needs attention

- Show errors **in context** first, adjacent to the affected action or record. Persistent unresolved issues also appear in a central **Needs attention** view.
- Group unresolved issues as **Retry available**, **Review required** and **Access restricted**. Unknown outcomes remain in review until verified.
- Display exact affected-player counts, last confirmed state and safe action. A failed save and an unconfirmed save must never share the same message.
- Remove resolved issues from the active list, retaining appropriate authorised audit history separately. Do not create a noisy permanent notification centre.
- Preferred copy examples:
  - “Couldn't save 3 player changes.”
  - “Saved in app. Spreadsheet sync failed.”
  - “Another planner changed this team. Review differences.”
  - “This player is already assigned to Blue.”
  - “You no longer have permission to edit this template.”

## 14. End-to-end acceptance tests

The following are **requirements for future verification**, not claims that any live app already passes:

1. **Shared visual tokens:** All adopting apps meet contrast, spacing, typography, team-colour and component-state standards while retaining their identity accent.
2. **Feature isolation:** 3739-only Canyon Clash functionality does not appear in 3573; no unapproved tabs or features propagate.
3. **Navigation and context:** Appropriate search/filter/sort/scroll and last saved event time survive normal navigation; account switching clears sensitive session state.
4. **Roster:** Quick sorts use Name, City power, Labyrinth rank and **Troop tier**; filtering/sorting happens before pagination; missing values remain last; aliases/Player IDs match correctly.
5. **Bulk selection:** Select-all filtered includes unloaded matches, freezes Player IDs, reports accurate affected/excluded counts and safely handles partial failures.
6. **Team generation:** Current selection is used; selected eligible players appear exactly once; locked assignments remain protected; Add unassigned does not move existing players; Apply is explicit.
7. **Drag interaction:** Entire username drag works on touch, large targets and auto-scroll; keyboard Move to team is fully functional.
8. **TAL optional capacity:** Missing troop capacity never blocks ordinary selection, assignment or generation.
9. **Foundry assignments:** Team membership, opening buildings and later movements remain independent and consistent after edits.
10. **Templates:** Personal/shared scopes, permission checks, versioning and saved-versus-preview copy are accurate.
11. **Statistics:** Top 8 requires eight valid records per metric/side; FC distribution displays correct denominator, scope, thresholds and freshness.
12. **Save and sync:** Server Saved and Google Sheets Synced are separate; delayed sync cannot overwrite newer edits.
13. **Recovery:** Unknown saves verify before retry; draft expiration and 30-day/48-hour policies behave as approved; conflicts require review.
14. **Privacy:** Cross-account, cross-state, cross-alliance and revoked-access scenarios cannot expose data or drafts.
15. **Accessibility:** Critical journeys work with keyboard, screen readers, larger text and reduced motion.
16. **Regression:** Each adopting app independently passes its relevant tests before any separately authorised deployment.

## 15. Open implementation dependencies (not design-review blockers)

- Validate exact game-derived coefficients and progression rules for any internal troop-tier strength index. **Do not invent values**; keep the user-facing label “Troop tier.”
- Document authoritative source/field ownership for Google Sheets versus app edits, including registration/legion workflows and conflict rules.
- Verify server capabilities for idempotency, revision checks, operation-status lookup, audit retention and permissions before relying on the UI contract.
- Validate exact breakpoints, token contrast combinations, long-name wrapping and assistive-technology behaviour against real devices.
- Confirm each app's approved feature inventory and rollout permissions immediately before any implementation work.

## 16. Decision and approval ledger

| Stage | Topic | Review status |
|---|---|---|
| 1 | Foundation and design tokens | Approved |
| 2 | Navigation and page structure | Approved |
| 3 | Player cards and roster | Approved |
| 4 | Manage and bulk actions | Approved |
| 5 | TAL and Foundry | Approved |
| 6 | Statistics and visualisation | Approved |
| 7 | Recovery, privacy and accessibility | Approved |
| 8 | Final consistency review and independent app adoption | Approved |

**Final correction:** User-facing **Troop strength → Troop tier**. Recorded **Troop power** and **City power** remain distinct.

**Design review:** 100% approved. **Document:** conceptual draft awaiting user review. **Repository/code/deployment:** no changes authorised or made by this artifact.

## 17. Shared search component contract (approved)

All applicable pages must use a shared search interface and matching behaviour, while retaining context-specific data scope and actions.

- Use consistent field height, search icon, typography, spacing, clear affordance, focus and disabled states across Members, TAL, Foundry and other approved search contexts.
- Use the same matching rules for current usernames, nicknames, previous usernames and Player IDs. Prioritise exact Player ID matches; preserve Unicode and stylised names; identify alias matches; never silently merge similar names.
- Use a consistent autocomplete suggestion structure, matching highlights, keyboard navigation, touch targets, loading/empty/error states and screen-reader announcements.
- Search the complete authorised, eligible dataset, not merely currently loaded cards; apply context-specific eligibility and permissions before presenting actions.
- Contextual actions may differ: e.g. Add player in Members, Add to TAL in TAL, Add to event in Foundry. Never imply that a search result is eligible for an action when it is not.
- Maintain appropriate search state across navigation according to Section 3. Ensure consistent clear/reset behaviour and no accidental selection changes.
- Acceptance: equivalent queries and identities produce consistent matching/ranking across applicable pages, subject only to explicit contextual eligibility and permissions; keyboard and touch journeys pass in each adopting app.

**Approved extension:** Section 18 establishes the remaining shared component contracts and their cross-page acceptance tests.


## 18. Shared component contracts and cross-page consistency (approved)

### 18.1 Contract governance and scope

A shared component is a **behavioural contract**, not merely a matching visual. Each contract must document: supported contexts and data scope; visual anatomy and design tokens; data/interaction semantics; state transitions; accessibility; loading, empty, error and offline behaviour; responsive behaviour; allowed context-specific variations; and executable acceptance/regression checks when implemented.

- Reuse the same underlying component or documented equivalent implementation across applicable pages. If separate implementations are unavoidable, they must pass the same contract tests; identical appearance alone is insufficient.
- Context-specific variations are permitted only when required by feature scope, permissions or task semantics. Document the variation, owner and reason. Do not force unrelated actions onto a page.
- Each application adopts shared changes independently, with explicit approval and its own visual, behavioural, accessibility and regression verification. No automatic rollout, feature activation, codebase consolidation or deployment is implied.
- Shared components must preserve the app/state/alliance/event scope and access controls specified in Sections 1, 3, 11 and 12.

### 18.2 Shared filters and sorting

- Use consistent filter-chip anatomy, active indicators, clear/reset affordances, ascending/descending controls and advanced-filter panels across applicable pages.
- Expose only fields meaningful in the current context. Use the approved roster quick sorts: Name, City power, Labyrinth rank and **Troop tier**; advanced options remain contextual.
- Apply filtering and sorting against the complete authorised dataset before pagination. Keep missing values last in both directions, use stable tie-breaking, and show the active sort's relevant metric where applicable.
- Preserve or reset filter state only according to the approved navigation/session rules; never silently change a frozen Manage selection when filters change.

### 18.3 Shared selection and Manage mode

- Standardise checkbox placement and separation from card/profile tap, selected counts, Select all filtered results (including unloaded matches), explicit entire-roster scope, bulk toolbar, confirmation and session-limited Undo.
- Freeze selected stable Player IDs within a Manage session. Revalidate permissions and eligibility before execution; show included, excluded, successful, failed and unresolved counts.
- Use consistent review-before-significant-changes, destructive confirmation and safe Undo rules. Partial failures identify affected records; unknown outcomes follow server verification-before-retry.
- Contextual bulk actions differ between Members, TAL and Foundry without changing the shared selection interaction.

### 18.4 Shared player cards and profile sheets

- Use one identity hierarchy, name/Player ID treatment, profile-opening interaction, compact Infantry/Lancer/Marksman troop chips and consistent Helios indication and accessible label.
- Keep contextual fields and badges relevant to the page, including active-sort metrics, registration, availability and event assignments. Do not redesign the card merely because it appears in a different tab.
- Preserve Unicode and long-name handling, loading placeholders, missing-data semantics and 44px touch targets. Manage selection must remain distinct from profile opening.

### 18.5 Shared status and badge system

- Define a single semantic registry for **Registered**, **Available**, **Locked** (with named lock type), **Missing info**, **Saved**, **Sync pending**, and other approved states. A label must mean the same thing in every app and page.
- Standardise colour, icon, wording, placement, accessibility label and state transition. Never rely on colour alone; app identity accents cannot override semantic meanings.
- Keep selection, registration, availability, assignment and lock types independent. Keep app-save confirmation separate from Google Sheets sync confirmation.

### 18.6 Shared forms and editing controls

- Standardise field labels, help text, required/optional indicators, validation timing and messages, Save/Cancel placement, disabled/saving states, draft indicators and unsaved-change warnings.
- Use the approved 7-day form and 14-day planner draft recovery windows, review-before-restore, scoped isolation and conflict checks. Do not claim Saved before authoritative server confirmation.
- On error, preserve user input, identify the affected field and provide a safe next action. Support keyboard, screen readers and dynamic text.

### 18.7 Shared menus, sheets and dialogs

- Standardise three-dot menus, contextual popovers, mobile bottom sheets, desktop dialogs, destructive confirmations, dismissal behaviour, focus placement/return and Escape/back handling.
- Place actions consistently according to importance and context. Do not bury primary tasks in overflow menus or expose disabled/unapproved actions as if available.
- Confirm before discarding meaningful unsaved work; avoid accidental dismissal during editing or conflict resolution.

### 18.8 Shared loading, empty and error states

- Use consistent skeleton layouts, loading progress, incremental-pagination feedback, retry controls and empty-result copy. Differentiate no data, no matches, insufficient permissions, offline, failed and unknown outcomes.
- Keep the last confirmed content visible when safe, rather than replacing it with a blank or broken-looking page. Provide clear recovery actions and screen-reader announcements.
- Unresolved issues may appear in the contextual **Needs attention** view; do not duplicate noisy error banners across unrelated pages.

### 18.9 Shared page headers and action hierarchy

- Standardise page title, contextual count/status, one primary action, Manage placement near the title, secondary actions and overflow positioning.
- Prevent duplicate controls or competing primary buttons. Preserve responsive hierarchy on mobile and tablet; actions must remain reachable above safe areas and bottom navigation.
- Context may change the primary action (e.g. Add player, Generate teams, Save) without changing the hierarchy.

### 18.10 Shared action feedback

- Standardise success confirmation, failure details, Undo affordance and expiry, pending states, conflict review, partial-success reporting and copy tone.
- Never equate locally cached, app Saved and spreadsheet Synced. Unknown save outcomes must be verified by operation ID/revision before retry; no silent overwrite or duplicate submission.
- Feedback must name the affected action or records, convey what is confirmed and provide the next safe step without stealing focus unnecessarily.

### 18.11 Shared responsive layout rules

- Use the same spacing tokens, navigation breakpoints as provisional guidance, safe-area handling, touch targets, keyboard/focus behaviour and overflow patterns across adopting apps.
- Allow page-specific information density, grids and editor layouts when justified by task. Test narrow phones, intermediate widths, tablets, long names, large text and landscape rather than relying only on fixed breakpoints.

### 18.12 Shared terminology and microcopy

- Use a controlled glossary for verbs, status names, confirmations, dates/times (including explicit UTC event times), empty-state copy, warnings and error messages. Keep context-specific details but not contradictory terminology.
- User-facing **Troop tier** replaces **Troop strength**. **Troop power** and **City power** remain distinct. Do not present the internal troop-tier strength index as troop power.
- Prefer concise, actionable wording: result or status first, then affected scope, then recovery action. Localise labels without changing underlying state meaning.

### 18.13 Cross-page and cross-app regression contract

Before a shared change is adopted by any app, verify applicable components in Members, TAL, Foundry and other approved contexts. At minimum, test:

1. Search ranking and alias/Player ID matching across contexts, including Unicode, empty, loading and error states.
2. Filter/sort direction, reset, missing-data placement, server-wide pagination and state preservation.
3. Selection counts, Select all filtered including unloaded results, profile-tap separation, Undo, permissions and partial failures.
4. Player-card layout, compact troop chips, Helios and long-name behaviour.
5. Badge meanings, independent registration/availability/selection states, named locks, app Saved versus Sheets sync.
6. Form validation, drafts, conflict handling, Save/Cancel and unsaved-change prompts.
7. Menus/dialogs/sheets with touch, keyboard, focus return, Escape/back and screen readers.
8. Loading/empty/offline/unknown-outcome feedback, retry safety and contextual recovery.
9. Header/action hierarchy, safe-area layout, responsive breakpoints and dynamic text.
10. Per-app feature isolation and permissions; a shared component change must not activate a feature in another app.

Document expected results, actual results, exceptions and approving app owner for each adoption. A failed relevant regression blocks that app's adoption until resolved or an explicit documented exception is approved. These are **future implementation acceptance requirements**, not tests performed as part of this draft.

### 18.14 Review status

All twelve additional component contracts are approved as **conceptual design requirements**. The eight-stage design review remains **100% approved**. This standalone Markdown draft is not a repository change, implementation authorisation, commit or deployment.

## 19. Shared data, state, permissions, event time and safe adoption (approved)

### 19.1 Shared data-fetching, freshness and cache invalidation

- Define a canonical, authorised player identity keyed by stable Player ID and scoped by app, state and alliance permissions. Members, TAL and Foundry must not maintain divergent editable copies of the same player field within a shared authorised data context.
- Document each field's authoritative source, edit authority, read model and sync direction. A common display component does not make a Google Sheets-authoritative field app-authoritative.
- Centralise or contractually standardise fetch keys, query/filter semantics, pagination, record revisions, invalidation events, refresh triggers and error handling. Context-specific eligible subsets are allowed; conflicting values for the same record revision are not.
- On a confirmed edit, invalidate or reconcile affected roster, profile, planner and search results across pages; prevent stale background responses from overwriting newer revisions. On app/account/alliance/event change, invalidate or partition caches before displaying scoped information.
- Refresh on relevant successful saves, sync completion, return to a stale view and explicit user refresh, subject to documented freshness policies. Show last successful refresh and stale/offline status where consequential; never label cached content as live.
- Preserve a safe last-confirmed view during network failure where permissions remain valid. Do not expose cached data after revoked access. Test concurrent edits, delayed responses, partial sync and offline reconnect.

### 19.2 Cross-page state ownership and lifecycle

- **Shared, scoped state:** canonical player records and revisions, authorised permissions, event identity, applied team assignments and confirmed save/sync status. Changes propagate to relevant views without duplicating authority.
- **Page-local browsing state:** search query, filters, sort, pagination cursor and scroll position; restore on expected back-navigation within the same app/account/context, but do not carry unrelated page searches into other pages by default.
- **Editing-session state:** Manage selection by stable Player ID, pending bulk operations, temporary editor values and session-limited Undo. Keep selection stable while filters change; clear on reload, logout or account switch, and on any context change that invalidates eligibility.
- **Recoverable drafts:** unsaved forms and unapplied planner edits follow their approved retention and scoped review-before-restore rules; drafts do not silently become applied teams.
- On state/alliance/event/legion change, evaluate each state object for relevance, explicitly confirm discarding meaningful unsaved work, and clear incompatible selections, cursors, permissions and caches. Prevent previous-context results from flashing in the new context.
- Define ownership, persistence duration, reset triggers and back-navigation behaviour for every shared component contract.

### 19.3 Shared permissions and eligibility

- Use one documented, server-enforced policy for access and eligibility decisions, parameterised by app, account, state, alliance, event, legion, action and player record. Search results, autocomplete suggestions, profile editing, Add player, bulk actions and team assignment must obey the same policy.
- Distinguish **can view**, **can select**, **can edit**, **can register**, **can assign** and **can administer**; a visible player is not necessarily editable or event-eligible.
- Filter sensitive suggestions at the authorised data boundary; do not fetch forbidden records and merely hide them in the UI. Explain disabled actions without exposing restricted information.
- Recheck permissions and eligibility at execution time, not only when controls render. Handle revoked access and partially eligible bulk selections with exact affected/excluded counts; never apply an operation to a broader scope than reviewed.
- Maintain app-specific feature isolation: an action enabled for 3739 is not implicitly enabled for 3573 or 3543.

### 19.4 Shared event-time handling

- Store event instants with unambiguous date/time and timezone semantics; distinguish an event's UTC instant from the user's local display timezone. Use explicit `UTC` labels in event notices and copied outputs, with a full date whenever needed to disambiguate a day boundary.
- Define a stable event identity incorporating the relevant app/state/alliance/event and legion context. Do not identify events by clock time alone; repeated events at the same UTC hour must not share accidental drafts or assignments.
- Persist and restore the **last saved event time** for the appropriate event context; never silently reset a saved 12 UTC selection to 14 UTC. Changing the viewed timezone must not change the underlying event instant.
- Apply the same time conversion and date-boundary rules to planner headers, availability eligibility, registration, reminders and copied notices. Clearly distinguish saved event time from unsaved time selection and from the viewer's local time.
- Test UTC-midnight crossings, New Zealand daylight-saving changes, repeated event times on different dates, account/alliance switches and copy output parity.

### 19.5 Change impact, regression gates and rollback

- Before each app adopts a shared change, record affected components, pages, APIs/data dependencies, permission surfaces, event workflows, visual differences, expected behaviour and the app-specific approval owner.
- Compare before/after behaviour using representative states: loading, empty, error, offline, long Unicode names, large text, touch/keyboard, active filters, pending saves and conflicts. Run relevant contract and cross-page regression tests.
- Protect the working production version through an independently testable development/preview environment and a documented restoration path. Define rollback triggers for data loss, permission leakage, wrong roster/search results, broken event assignments, save/sync regressions and critical navigation failures.
- Keep schema/data migrations separately reversible where feasible, with explicit recovery plans when they cannot be safely rolled back. A UI deployment rollback alone must not be presented as a data rollback.
- Shared design approval does not authorise implementation, production rollout or deployment. Obtain separate explicit app-specific adoption and deployment approvals; never propagate a change to other apps automatically.

### 19.6 Acceptance criteria and review status

1. A confirmed player edit becomes consistent across Members, TAL and applicable profiles without a stale response reversing it; differences in eligibility are labelled, not mistaken for data disagreement.
2. Search, selections and cached records never leak across accounts, states or alliances; permissions are checked both for suggestions and for final writes.
3. Back-navigation restores appropriate browsing state; context switches clear incompatible editing state and protect unsaved drafts.
4. A saved 12 UTC event remains 12 UTC in planner, availability and copy output, including across date boundaries and timezone changes.
5. Each app's adoption has a documented impact assessment, regression evidence, explicit approval and tested restoration procedure before production rollout.

All five requirements in Section 19 are **approved conceptual design requirements**. The eight-stage review remains **100% approved**. This file remains a standalone draft; no repository edit, code implementation, commit or deployment is authorised.

## 20. Data authority, canonical identity, lock precedence and history (approved)

### 20.1 Field-level data authority and synchronisation contract

- Before enabling two-way synchronisation for a field, document a **field authority matrix** with: field name and semantic definition; canonical storage and display source; authorised editors and surfaces (app, Google Sheets, import/API); permitted direction(s) of change; validation; revision/version identifier; conflict resolution policy; and audit requirements.
- Authority is **per field and workflow**, not a universal rule that the app or Sheets always wins. A field may be app-editable, Sheets-editable, or both only when a documented reconciliation rule exists. Unknown ownership blocks automatic overwrites, not unrelated editing.
- Preserve source provenance, server revision and sync status per affected field/record. A timestamp alone is insufficient to resolve conflicting concurrent edits; use revision checks and verified operation identities.
- Sync only authorised changes. Detect out-of-order updates and conflicts, quarantine irreconcilable changes for explicit review, and never treat a successful app save as confirmed Sheets synchronisation.
- Changes to authority or schema require migration/compatibility review and app-specific approval. **The matrix's actual field assignments remain an implementation dependency** until verified against each app's current workflows and Sheets schema; do not invent them in this design specification.

### 20.2 Canonical player identity and duplicate handling

- Identify a player by **(state ID, stable Player ID)** within the relevant data domain; usernames, display names, nicknames and prior names are searchable attributes, never primary keys. Preserve Unicode and original names.
- Alliance membership is a time-varying relationship, not part of the canonical player key. App/account/alliance permissions still strictly constrain which records and relationships may be viewed or edited. Do not conflate cross-state identities merely because a numeric ID appears identical.
- An alliance transfer updates authorised membership/history without creating a second canonical player. Retain event-specific historical assignments under their original event context where permitted.
- Imports and sync must detect duplicates by canonical key; alias matches alone must not trigger merges. For conflicting player IDs, ambiguous aliases, mismatched data or overlapping memberships, flag for authorised review rather than automatically overwriting or joining records.
- Merges require an explicit before/after preview, field-level provenance, permission validation and audit entry. Maintain reference integrity for planner assignments, registration, selection and template references; avoid silent cascading changes.

### 20.3 Lock precedence across operations

- Define independent, field-scoped locks for **team assignment**, **registration**, and **role** (and any separately authorised lock types). Each lock has a clearly displayed type, scope and authorised unlock action; a generic Locked badge cannot imply all fields are frozen.
- For manual moves, bulk edits, generation, imports and sync reconciliation, evaluate lock permissions **before applying** changes. A locked field is immutable until explicitly unlocked by an authorised user. Unrelated unlocked fields remain editable.
- **Regenerate all** may change only unlocked team assignments; **Add unassigned** must preserve all existing assignments whether locked or unlocked. An authorised unlock is a separate explicit operation, not a side effect of regeneration or bulk selection.
- If an operation targets locked and unlocked fields or players, show proposed affected/excluded counts, lock reasons and a safe preview; apply only eligible changes after validation, with explicit reporting of exclusions. Never silently bypass locks or imply that a skipped locked change succeeded.
- Conflict merges, spreadsheet sync and retries cannot override locks through a different editing path. Revalidate locks and revisions at execution time to prevent time-of-check/time-of-use errors.

### 20.4 Undo, draft recovery, conflict resolution and version history

- **Undo:** Reverses the latest eligible confirmed change within the approved editing session, subject to permissions, revisions and intervening edits. It is not a universal rollback or an unconditional replay of previous values.
- **Draft recovery:** Offers review-before-restore of uncommitted form/planner edits within approved 7-/14-day windows. Restoring a draft never silently applies an event plan or overwrites a newer saved revision.
- **Conflict resolution:** Compares concurrent versions and their provenance, safely merges independent changes when possible, and requires explicit review for overlapping edits; revalidate permissions, locks and assignment integrity before committing.
- **Version history:** A separate authorised record of saved versions and significant edits, with who/when/what context where permitted. Viewing history does not imply permission to restore it; restoration is a **new reviewed, permission-checked, revision-checked write**, not an invisible reversal of subsequent work.
- **Unresolved operations:** Keep the approved fixed 30-day verification/review window, warnings at 7 days/3 days/24 hours, maximum 48-hour offline grace, and cleanup on the next available run. These are recovery-payload rules, not automatic audit-log retention periods.
- Define audit retention, access and redaction separately according to app requirements; do not assume audit history lasts forever or that clearing local recovery data deletes server history.

### 20.5 Acceptance criteria and review status

1. A field marked Sheets-authoritative cannot be silently overwritten by an app-originated update; a conflicting edit produces a traceable review state.
2. Two imported rows with the same (state ID, Player ID) reconcile to one canonical player without merging unrelated alias matches; an alliance move preserves identity and authorised history.
3. A team-assignment lock prevents a generator, bulk move and sync reconciliation from moving that player, while an unrelated editable field can still be changed.
4. A partial bulk operation explicitly identifies locked/excluded players and confirmed successes; no skipped change is reported as saved.
5. Undo, draft recovery, conflict review and version-history restoration have distinct controls, permission checks and user-facing explanations.

All four requirements in Section 20 are **approved conceptual design requirements**. The eight-stage design review remains **100% approved**. This file is a standalone draft only; no repository edit, implementation, commit or deployment is authorised.

## 21. Component versioning, migration safety and end-to-end consistency (approved)

### 21.1 Shared component versioning and compatibility

- Maintain one versioned shared design-system specification and versioned behavioural contracts for reusable components (search, filters/sorting, player cards, selection/Manage, forms, status feedback, menus, event-time controls and other applicable shared patterns).
- Each app (3543 Intel, 3573 Caroline, 3739 Caroline) records the exact design-system revision and relevant component-contract versions it has **actually adopted**, separately from the latest draft specification. A document approval is not evidence of code adoption.
- For each proposed adoption, record changed contracts, compatible/incompatible behaviours, affected pages and workflows, data/API dependencies, accessibility impacts, migration needs, regression evidence and the app-specific approver. Breaking changes require an explicit compatibility plan; no silent propagation between apps.
- Document and test permitted app-specific variants and feature flags. Shared component version parity must not automatically enable a feature in an app where it has not been approved.
- Maintain an adoption matrix showing, for each app, the approved target version, current deployed version, verification status and rollback constraints. Do not mark a version deployed until deployment is independently confirmed.

### 21.2 Migration, backup and rollback safeguards

- Every schema-changing release must include a forward migration plan, compatibility assessment for concurrently running app versions, and an explicit rollback or roll-forward recovery strategy. Identify irreversible transformations and their consequences before approval.
- Validate backups and restoration procedures for the actual affected data and services, including canonical player identities, alliance membership, registration, event plans, assignments, locks, templates and synchronisation metadata. A backup existing is not equivalent to a tested restore.
- Account for in-flight writes, queued sync operations, idempotency records, revision identifiers and external Google Sheets edits during migration and recovery. Never restore an old schema or data snapshot in a way that silently overwrites newer authorised writes.
- Prefer staged, backward-compatible schema transitions where feasible; define the point after which an earlier app version is no longer safe to run. A frontend redeploy or rollback does **not** roll back the database, spreadsheet or queued operations.
- Record migration verification checks, recovery ownership, decision thresholds, rollback limitations and app-specific approval. Do not run migrations, create backups, modify production data or deploy based solely on this conceptual specification.

### 21.3 End-to-end data consistency and regression tests

- Test a complete authorised player-edit journey from Members through TAL, Foundry, search/autocomplete, profile views, paginated roster caches and Google Sheets where integrated. Verify all relevant views converge on the same **server-confirmed canonical field value**, while respecting contextual visibility, eligibility and field authority.
- Cover immediate same-session propagation, refresh/navigation, cache invalidation, concurrent edits, stale/out-of-order responses, offline reconnection, duplicate operation IDs, partial bulk success, revoked permissions and external Sheets edits.
- Verify a stale fetch or delayed sync cannot reverse a newer confirmed revision. Check canonical (state ID, Player ID) identity, alias search, alliance transfers, field-level provenance, lock precedence and per-field authority throughout the journey.
- Distinguish expected asynchronous sync delay from genuine inconsistency: show accurate pending/stale/failed indicators and last-confirmed revisions or times. Never assert real-time cross-system agreement before the destination confirms it.
- Include event-time regression (saved 12 UTC stays 12 UTC across planners, availability and copied notices), long Unicode usernames, keyboard/touch accessibility, and app-specific feature isolation.
- Capture pass/fail evidence per adopting app and component-contract version. A failure blocks that app's adoption until fixed or explicitly risk-reviewed; passing in one app does not certify another.

### 21.4 Acceptance criteria and approval scope

1. Each app has a traceable adopted contract version and independent approval record; shared specification changes do not alter another app without explicit adoption.
2. A schema-changing release has documented compatibility boundaries, a validated recovery path and clearly stated rollback limits before production approval.
3. A player edit is reflected consistently in every authorised relevant view; stale responses and queued Sheets updates cannot silently overwrite newer confirmed values.
4. Pending or failed spreadsheet sync is displayed separately from successful app persistence; tests exercise concurrent edits, lock checks and field authority.
5. Regression evidence is recorded per app, including its permitted feature differences and accessibility behaviour.

All three requirements in Section 21 are **approved conceptual design requirements**. The eight-stage design review remains **100% approved**. This standalone draft is not an implementation authorisation. No repository modification, commit, migration or deployment is authorised.


## 22. Proposed design: AI/OCR-assisted Foundry bulk matching (3573 only)

**Status: discussion draft, not implementation approval.** This section records the user's 16 November 2026 request to improve bulk pasted names and troop powers extracted from game screenshots by AI/OCR. Applies to 3573 Caroline Foundry; does not change 3739 or other apps. Preserve all source usernames and player IDs. No code, production data, or deployment changes are authorised by this section.

### 22.1 Problem observed

- A screenshot-to-AI/OCR workflow produces text such as `Name,Power` or `Username, troop power`, often without spaces and with inconsistent punctuation. The current Foundry bulk importer expects lines with optional comma/tab and numeric power.
- OCR and language models may alter stylised Unicode, Cyrillic, Korean, symbols, spaces and punctuation, even when the correct person exists in the roster. Examples observed include shortened names (`8ARI` vs `8ARI` plus power), stylised spellings, and ambiguous aliases.
- The current flow attempts exact Player ID, exact name/alias, then a restrictive normalised comparison; it shows `No exact match` and candidate suggestions for unresolved lines. A suggested candidate requires a manual selection followed by rerunning `Match and register players`. This is cumbersome for batches and obscures what will be saved.
- OCR output is untrusted input, **not** proof of identity. An incorrect automatic match can register the wrong player or overwrite troop power. Avoid automatic creation or silent fuzzy merging.

### 22.1a Screenshot-specific examples and parsing boundaries

The supplied LM Studio screenshot and Foundry paste screenshot show why matching and parsing must be treated as two distinct operations:

| OCR/AI output | Review requirement |
|---|---|
| `A L F is ENFJ,3280` | Preserve the entire source string and suggest plausible roster candidates. Do not assume `ENFJ` is removable or part of a particular player's name. |
| `G ~ is INTJ,3429` | Treat spaces, tilde and words as potentially significant. Suggest candidates, never auto-merge from visual similarity. |
| `8ARI,3593` | Parse the final comma-delimited numeric value as power, leaving `8ARI` as the source name. Do not compare `8ARI,3593` to usernames as one string. |
| `REINTLESSRKG,5472` | Offer name variants and roster search, but do not assume the `RKG` suffix can safely be removed. |
| `Бакит Кыргыз,5049` | Preserve Cyrillic exactly; transliteration is a suggestion aid only. |
| `MotherEarth` | If power is absent, allow a name-only match and mark power as missing rather than guessing. |

The two screenshots represent different import stages and may contain different sets of names. Do not assume they are row-for-row paired or use them to establish a definitive player identity. All examples are illustrative; a saved roster/FID must resolve actual matches.

**Parsing rule:** Extract power from the **rightmost clearly numeric field** only when the delimiter and numeric format are unambiguous. Names can contain spaces, punctuation, digits, non-Latin characters and symbols. If a row could reasonably be interpreted in two ways, ask for review instead of guessing.

**Suggested compact review layout:** `Source: G ~ is INTJ · 3,429` → `Possible match: [username] · [alliance] · [FID]` → `Choose / Search / Skip`. Show the original line in an expandable detail. The primary bulk action remains disabled for unresolved or conflicting rows unless the officer explicitly skips them.

### 22.2 Proposed user journey

1. **Paste or import:** One clearly labelled `Add players` surface accepts `Name, power`, `Name power` where unambiguous, tab-separated rows, optional header, or names alone. Accept direct paste from OCR/AI; image upload and on-device OCR are separate future options, not prerequisites. Preserve original text verbatim alongside parsed fields.
2. **Parse and preview:** Show a compact summary such as `18 rows · 12 ready · 5 review · 1 invalid`, plus a table of source name, proposed roster match, extracted troop power and status. Never register or edit profiles at this stage.
3. **Suggest matches:** Use the canonical roster for the selected state and permitted alliance scope. Rank exact Player ID first, then exact current username, verified previous username/alias, safe Unicode/case/spacing variants, and finally fuzzy candidates. Explain why a candidate is shown. Never treat fuzzy confidence alone as authorisation.
4. **Resolve uncertain rows inline:** Display up to three plausible players with avatar, canonical username, alliance and Player ID where available. Let the officer tap the correct profile, search manually, choose `Skip`, or mark `Not in roster`. Distinguish `No candidate`, `Several candidates`, `Possible OCR error`, `Duplicate row` and `Already registered`. Preserve original OCR text next to any suggested correction.
5. **Review changes:** Show exact totals for registrations, troop-power updates, unchanged entries, skipped rows and conflicts. Indicate whether the power is imported event power or a profile field, with timestamp and source. Existing stronger/newer or manually entered values must not be overwritten silently.
6. **Confirm once:** `Register N players` applies only reviewed eligible rows. Provide per-row results, Undo where supported, and a clear retry path for failed rows without duplicating successes. Keep unresolved rows available to resolve later.

### 22.3 Matching and identity safeguards

- Use **(state ID, immutable Player ID/FID)** as canonical identity when present; a displayed username is never a unique key.
- Apply Unicode-aware matching carefully: compare normalised forms without mutating stored/displayed usernames. Preserve diacritics, script, decorative glyphs and invisible combining marks in the source preview and copied text. A transliteration or aggressive symbol-stripped comparison is a *candidate hint*, not an exact match.
- Distinguish **exact**, **strong candidate**, **needs review** and **unmatched**. Only an unambiguous canonical Player ID or unique exact verified roster name/alias may be proposed as ready, and all changes remain subject to final confirmation.
- Never infer a match from troop power alone. Power may help an officer visually disambiguate, but is mutable and may be outdated.
- Do not infer that two different rows with similar usernames represent one person. Flag repeated source rows, repeated resolved FIDs and contradictory powers before confirmation.
- A manual match selection is scoped to that exact source row and current import session, not globally to a name string; identical OCR strings can refer to different players.
- Keep event-registration and troop-power updates separate. Explicitly respect player locks, eligibility, role limits (30 combatants / 10 substitutes), alliance scope, existing registration, provenance and last-update rules. Failed or skipped rows must not be reported as registered.
- If an AI service is later considered, require explicit opt-in, privacy/security review, transparent processing destination, no secrets in the browser and a deterministic offline/manual fallback. AI may suggest parsing or candidates but never directly commit identity changes.

### 22.4 Mobile layout and copy

- One primary search/add field with a visible `Paste list` action. The bulk review opens as a full-height mobile sheet, not a cramped alert below a textarea.
- Top summary and primary action remain visible; show a segmented `All / Ready / Review` filter, with review rows first by default. Each row has a readable source-name line, suggested profile, match-reason label, troop-power field and an obvious `Change match` action.
- Candidate choices have at least 44 × 44 pt touch targets. Support keyboard selection, screen-reader labels, long names, non-Latin scripts, and an explicit cancel/close action that retains the draft.
- Suggested copy: `Review 5 matches` rather than `No exact match` for all cases; `Matched by previous username` and `Possible OCR spelling` explain why. Use neutral status colours plus text; do not imply a probability is measured when it is not.
- Keep the raw OCR paste editable, with a side-by-side or expandable `Original text` view. A correction changes the parsed row, not the source evidence.
- Show a post-import outcome such as `12 registered · 2 skipped · 1 needs review` only after confirmed writes.

### 22.5 Open product decisions for discussion

1. Should **unique exact current-name matches** be preselected as ready, or should every row require a tap? Recommendation: preselect exact verified matches, with one final batch confirmation; manually review alias/fuzzy candidates.
2. Should importing power update **Foundry event power only**, or the player's shared profile field? Recommendation: default to Foundry event power, explicitly label any shared-profile update.
3. Should users be able to **upload screenshots directly** for OCR? Recommendation: phase 2, after reliable pasted-text matching, with opt-in and privacy review.
4. Should the app remember confirmed OCR-to-FID corrections? Recommendation: remember verified previous usernames as provenance-backed aliases only after explicit officer approval; never create a global fuzzy override.

### 22.6 Acceptance tests before implementation or release

- Parse pasted `Name,Power`, comma-thousands, tabs, extra spaces, mixed newlines, headers, missing power and invalid/negative/decimal power without shifting values to the wrong row.
- Verify exact FID, exact current username, verified alias, visually similar Unicode, mixed scripts, combining marks, Cyrillic/Latin lookalikes, truncated OCR, punctuation changes and unrelated near matches. Preserve original strings byte-for-byte in review.
- Two rows with identical OCR names but different possible FIDs must not share a manual resolution; duplicated FIDs and contradictory powers must block unsafe bulk commit.
- Check selected alliance vs other alliances, transferred/unverified players, registration caps, locks, stale powers, manual overrides, concurrent edits, partial save failures and idempotent retries.
- Simulate 5, 20, 50 and 100 pasted rows on iPhone-sized screens, VoiceOver, keyboard and touch; verify that the reviewer can resolve every row without repeated full imports.
- Validate zero incorrect automatic identity assignments on adversarial test fixtures; log false-positive suggestions and unmatched rates separately. Run integration and browser tests on the 3573 development branch; do not deploy without separate authorisation.

**Decision state:** Added to the design system for discussion. No matching algorithm, OCR integration, bulk-import UI or registration logic is approved for implementation yet.


### 22.7 Approved 3573 compact bulk-match review and exact-match behaviour (16 November 2026)

**Design decision: approved for the 3573 bulk-entry experience in Foundry, TAL and Battle Planner.** This documents UX and matching behaviour; it does not authorise a code change or deployment. Preserve each workflow's existing registration, power and save semantics. Other apps remain out of scope.

**Default mobile layout**
- Replace large per-player matching cards with a dense, single-column list of approximately 60–70px collapsed rows. Use restrained separators rather than repeated borders, panels and headings.
- The header contains the event/alliance/role context, one compact `N matched · M to review · T total` summary and a slim progress indicator. Do not duplicate statistics in tiles and a second filter bar.
- Show **Needs review** first. Automatically matched entries stay collapsed under an expandable **Exact matches (N)** group, available for inspection or correction.
- Each row shows the **verbatim pasted username**, pasted troop power (if supplied), and a clear status. Show the candidate's **current alliance, furnace level and city power** as identifying context, using `Unknown` for unavailable values, never fabricated or zero-filled data. Player ID/FID must be available in expanded results.
- Expand only one unresolved row at a time. Resolving one collapses it and advances to the next. The full-height mobile review sheet keeps the final confirmation action accessible above the bottom safe area. All interactive touch targets remain at least 44 × 44px.
- Only the expanded row displays editable troop power, candidate selection and an optional manual search. Put **Other matches**, **New player** and **Skip** behind restrained contextual controls rather than repeating large buttons and input fields on every row.

**Expanded search and alternate selection**
- Keep the original pasted identity and power visible while searching by current username, previous name, alias or immutable Player ID.
- Offer an inline, compact list of alternatives with each candidate's exact display username, current alliance, furnace level, city power and Player ID. Allow optional alliance filtering without hiding transfers from other alliances by default.
- The best suggested candidate appears first, but a fuzzy/OCR suggestion must be explicitly selected. Selecting a result highlights it; **Confirm match** commits the choice to the local import draft, not the server. No accidental auto-save or silent profile merge.
- Empty results offer clear-filter, new-player and skip paths. Corrected power remains distinct from the original pasted source text.

**Exact-match rules and safeguards**

| Input match | Local draft behaviour |
|---|---|
| Unique, valid exact immutable Player ID/FID in the authorised state | Preselect automatically |
| Unique exact current username in the selected alliance, with no conflicting identity evidence | Preselect automatically |
| Exact username found in a different alliance | Require explicit review, even if unique |
| Duplicate exact usernames or conflicting Player IDs | Require explicit review |
| Normalised, alias, previous-name, partial or fuzzy/OCR name | Suggest only; require explicit review |
| No matching authorised roster identity | Require manual search, explicit new-player action or skip |

- Exact username comparison must preserve the actual Unicode display value; do not conflate a normalised/OCR-similar name with an exact match.
- Automatic preselection is **not a save**. The user can expand and override any preselected exact match. No roster/event mutation occurs until the final **Confirm import**.
- Revalidate canonical identity, selected alliance/event eligibility, duplicate identities and concurrent changes at final confirmation. Show blocking conflicts instead of silently selecting a different player.
- City power and furnace level are **human disambiguation cues**, not automatic identity keys; they may change over time.
- Keep skipped and unresolved rows visible in the final outcome, and do not imply that creating a new player happened unless a real authorised create operation succeeded.

**Acceptance criteria**
1. Paste 30 entries with 27 unique exact same-alliance usernames and 3 ambiguous names: show **27 matched · 3 to review**, with only the three unresolved entries expanded or needing interaction.
2. Exact Player ID, duplicate usernames, cross-alliance exact names, visually similar Unicode names and conflicting identifiers follow the rules above without false automatic matches.
3. An officer can review an alternative candidate's alliance, furnace, city power and ID without leaving the import screen; one-tap progression keeps the next unresolved entry in view.
4. Edited missing troop power remains missing, not zero. The user can inspect the original OCR text before final confirmation.
5. Verify compact list density, 44px targets, VoiceOver labels, keyboard access, iPhone Safari touch interactions and screenshot fidelity to the approved 3573 styling before release.
