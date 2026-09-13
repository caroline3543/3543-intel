# 3543 Intel — Session Handoff

> Generated for conversation migration. Covers one very long session of iterative
> feature work, bug fixes, and UX refinement on the Members, Events, Battle Plans,
> and Intel sections. Supersedes any earlier handoff doc for these areas.

---

## 1. Project Overview

**3543 Intel** — React/Vite PWA for Caroline, R4 leader of an alliance in Whiteout
Survival (State 3543), used live on her phone during multi-hour SvS events. Same
project as documented in prior handoffs (`SUNFIRE_COMMAND_HANDOFF.md`,
`HANDOFF_2026-09-final.md`) — this doc covers everything built *since* those.

**Working model unchanged:** Claude is sole developer. Caroline uploads current
files when Claude doesn't have them, Claude delivers full-file replacements,
Caroline runs `cp` → `npm run build` → `git add -A && git commit` → **`git push
origin main`**. That last step was repeatedly missed this session — see §7.

**Deployment:** Vercel, auto-deploys on push to `main`. Local `npm run build`
alone does **nothing** for what Caroline sees on her phone if she's testing the
live URL — it only writes to local `dist/`.

---

## 2. What This Session Actually Built

Rough chronological summary — start here if you need the "why" behind a file.

### Events (`EventsTab.jsx` and friends) — the biggest area of work
- **Touch-point safety pass**: two-step confirm (tap → "Remove?" → tap again,
  auto-reverts after ~2.5s) added everywhere a single tap used to delete
  something — participant removal, JoinerRegistry owner removal, the Done-status
  button (which bulk-writes attendance). All touch targets audited to a real
  44×44px minimum after repeated "hard to tap" reports.
- **Auto-attend on Done**: marking an event Done auto-sets `attendance.attended
  = true` for anyone whose attendance was never explicitly touched. **Substitutes
  are skipped** by this — their attendance stays `null` (reliability-neutral,
  see `metrics.js`) unless an officer explicitly records they showed up.
- **RSVP schema**: added `intermittent` ("pops in randomly") and `unsure`;
  **removed `onTime` entirely** (schema, editor, export — zero references left
  anywhere). `willJoinDiscord` label renamed to "Will join voice chat" app-wide.
- **Category-first RSVP assignment**: "Join & set RSVP by status" — pick a
  status (Coming Late, Present Whole Time, etc.) *first*, then search/add names
  into it. Search pool is alliance-scoped (`eventEligiblePlayers`), and picking
  someone **both adds them as a participant and sets their RSVP** in one action
  if they weren't already on the roster.
- **Multi-alliance events**: `event.allianceTag` (string) → `event.allianceTags`
  (array). `AlliancePicker.jsx` gained a `multi` prop (default `false`, so
  `PlayerSheet`/`BatchAddSheet` are unaffected). `EventSheet.jsx` has a
  **backward-compat shim** (`withMigratedAlliance`) that wraps an old event's
  single `allianceTag` into the new array on load. Participant search
  (`AddParticipantPanel.jsx`) is now restricted to the event's selected
  alliance(s) when any are set; "Copy roster from a previous event" respects
  the same restriction. Participant list splits into per-alliance sections
  (with rank sub-groups nested inside) whenever an event has >1 alliance.
- **Copy/export features** (all plain text, **never code-fenced** — pastes
  straight into Discord/the game):
  - `generateParticipantsText` — original simple roster-by-rank list.
  - `generateAttendanceText` — richer: 👑/☀️/🎖️ flags (Rally Lead / any Helios
    troop / R4+), furnace level, Full-vs-Partial (troops matching each other),
    which troop type(s) are Helios. **Grouped by RSVP/attendance category**
    (Unsure → ... → Confirmed), not rank. Status is *not* repeated per-line
    since the subheading already says it.
  - `generateHeliosAttendanceText` — "☀️ Copy Helios attendees", grouped by
    **troop type** (a player with Helios on 2 troops appears under both).
  - `exportEventParticipants` (in `exportXlsx.js`) — real `.xlsx` per event:
    troops, Rally Leader Heroes (needs `plans`, see §5 gap), category-grouped
    (same priority order as the copy-text versions, kept in sync deliberately).
    **Only tick/cross column left in the whole sheet is joiner heroes** — RSVP/
    attendance is 100% conveyed by category subheadings now, including
    Present-Whole-Time/Voice-Chat, which got folded into compound category
    labels ("Attended + Voice") rather than separate columns.
  - **Gating**: for *upcoming* events, only ONE of "Copy participants" /
    "Copy attendance" shows — attendance/RSVP-categorized for SvS Castle
    Battle & Internal Sunfire Castle (`SHOWS_RSVP_TYPES`), simple participant
    list for everything else (Foundry, Canyon Clash, etc.), since detailed
    RSVP categories aren't meaningful there. **Completed events always show
    both**, regardless of type — post-event attendance tracking is universal.
    "Copy Helios attendees" only shows for `SHOWS_RSVP_TYPES` events.
- **Verify Roster** (`VerifyRosterPanel.jsx`): the in-game Combatants screen for
  Foundry/Canyon Clash **cannot be copied as text** — confirmed via screenshots,
  it's a native scrollable list. So the "📋 Paste to check" mode is NOT the fix
  for that specific workflow; "👆 Tap through" mode is. Added a `💪 {power}`
  chip per row (from `getCurrentTroopPower`), tap to edit inline — writes to
  that event's own snapshot, same as the existing Foundry/Canyon Clash inline
  troop-power field. Needed a new `onUpdateEvent` prop threaded through.
- **Sticky context bar** + **swipe-between-events polish** (rubber-band drag,
  directional chevrons, haptic on commit) — top offset assumes app header is
  ~60px (per `CONSTITUTION.md`), unverified against actual `App.jsx`.
- **Squad Balancer** (`squadBalancerService.js` + `SquadBalancerPanel.jsx`, new
  files) — Foundry/Canyon Clash only (`TROOP_POWER_EVENTS`). Greedy
  strongest-to-weakest-bucket algorithm, pick team count + optional anchors,
  auto-balance, then tap any player to manually move between teams. Deliberately
  **separate system from Battle Plans/rally slots** — these events don't use
  rallies at all (confirmed via web search on current player guides).

### Battle Plans
- **Behavioral reversal, flagged explicitly**: auto-suggest (both
  `FormationPicker.jsx`'s formation-select and `PlanDetail.jsx`'s
  "⚡ Auto-Fill by Power") used to pre-assign a *specific person* to each
  priority-joiner hero slot. Per an explicit new UX brief, **this now only
  fills the required HERO**, never the person — the officer always picks the
  person from the eligible-attendees list in `JoinerSlotRow.jsx`. Auto-Fill
  still ranks *rally leaders* by power (that's a different kind of
  assignment, not prohibited).
- **Real mis-tap bug found and fixed**: `RallyLeaderProfileSheet.jsx`'s
  lead-hero rows used to conditionally mount skill/widget inputs on selection,
  which shifted the row height/wrapping on a phone screen — pushing the next
  hero's dropdown out from under a fast tap-through. Fixed by permanently
  reserving that layout space (grayed out until relevant) instead of
  mount/unmount. **This bug class (conditional content shifting layout
  mid-gesture) is real and may exist elsewhere** — only this one instance was
  found and fixed; it was found because Caroline reported it, not via a full
  audit.
- Added: `marchTime` (profile-level — belongs to the player's city, not a
  specific team) and per-hero `heroSkillLevels` (★1-5, alongside the existing
  widget count) to the Rally Leader Profile schema/UI.
- `RosterTab.jsx`'s troop-tier-required picker on rally slots collapses to a
  read-only summary once set (same "reserve space, don't reflow" principle),
  matching the pattern `FormationPicker` already used for selected formations.

### Members / Roster
- **Helios troop tier split**: single `'T11/Helios'` → `'Helios FC5'` through
  `'Helios FC8'` (4 distinct stages). Touched `constants.js` (`TIER_OPTIONS`),
  `battleConstants.js` (`FC_ORDER`), `RallySlotCard.jsx`'s two inline pickers,
  `RosterTab.jsx`'s Helios filter chips (now `.startsWith('Helios')`, not exact
  match), `exportXlsx.js`'s tiered ☀️ emoji (1-4 suns by stage) and
  `TIER_RANK_ORDER`. **"Full FC6" filter also counts Helios FC6** (not FC7/8).
- ⚠️ **Important asymmetry to know about**: `TIER_OPTIONS`/`FC_OPTIONS` in
  `constants.js` are **descending** (highest-first) — a deliberate *display*
  convention. `FC_ORDER` in `battleConstants.js` stays **ascending** — it's
  used for `indexOf`-based "does this troop meet the minimum" comparisons,
  and would silently break if reversed. These are two separate arrays on
  purpose. Don't "fix" one to match the other.
- **Furnace badge images**: real artwork for FC1 through FC8 now exists
  (`public/furnace-badges/fc1.png`–`fc8.png`, `FC_BADGE_IMAGES` in
  `constants.js`). **Verified each image against its actual number
  programmatically before saving** — upload order did NOT match the numbers
  in at least one batch.
- **Tabler Icons webfont** added via CDN in `index.html` (pinned version
  `3.17.0`, not `@latest`). `PlayerCard.jsx`'s crown/shield/sword/target-arrow/
  alert-triangle/dots-vertical/trash are now real CSS-tintable icons, not
  emoji. **Confirmed each icon name actually exists** via web search before
  using it — also discovered Tabler's "filled" icon variants need a *separate*
  stylesheet this CDN link doesn't load, so avoid any `-filled` suffixed class.
- **Member card color system** (multiple iterations, read carefully):
  - Troop-type colors on the card are **red/green/blue** (infantry/lancer/
    marksman) — a **local override scoped to `PlayerCard.jsx` only**, NOT the
    same as the shared `C.inf`/`C.lan`/`C.mar` tokens still used elsewhere
    (Battle Plans, Profile view). This is a known, flagged inconsistency —
    never resolved whether it should propagate everywhere.
  - Helios status = small filled **red square badge** on the troop icon
    itself, colors the icon never changes for. Gold/amber is **reserved for
    the mismatch state only** — but "mismatch" was redefined mid-session: it
    compares a troop's tier against the player's *other two troops*, NOT
    against furnace level (furnace and troop tier are different progression
    tracks that differ constantly even when nothing's wrong — that was the
    original, wrong version, caught and fixed). The mismatch algorithm
    flags the actual minority/outlier, not just "anyone whenever any
    difference exists anywhere" — traced through 5 real cases before shipping,
    worth re-checking that logic (`PlayerCard.jsx`, search "maxFreq") if it's
    ever touched again.
  - Gold-reservation was only applied to troop chips and the joiner-hero
    indicator, **not** extended to Rally Lead pills, the crown button, or
    reliability score coloring — flagged as an open question, never resolved
    either way.
  - Joiner hero indicator moved from a row of gold pills to a small gray
    icon badge on the avatar corner, tap/click to reveal which heroes
    (stops propagation so it doesn't trigger the card's own tap-to-open).
- **Priority tier + sort**: `getPriorityTier`/`comparePriority` exported from
  `PlayerCard.jsx` (single source of truth, imported by `RosterTab.jsx` for
  the new "⭐ Priority" sort option). Tier 1 = all 3 troops Helios AND all the
  same stage; Tier 2 = some Helios, not fully matched; Tier 3 = no Helios.
  Within a tier, sorts by furnace level then "fully upgraded" (troops match
  each other) before "partial."
- **Roster simplification, iterated twice**: role pills and the alliance-rank
  badge were added to the card, then explicitly **removed again** later in the
  session once Caroline confirmed the profile (tap-in) view was sufficient —
  don't re-add them without asking, that request was deliberate, not an
  oversight.
- **Inline editing added to `ProfileView.jsx`** (previously read-only): "+ Add
  Joiner Hero" (name + ★1-5 skill, replaces same-name entries rather than
  duplicating) and an "Alliance Rank" section (R1-R5 buttons, tap selected to
  clear). Needed a new `onSave` prop threaded from `RosterTab.jsx`, same
  pattern already used for `RallyLeaderProfileSheet`'s save.
- Search fixed to check `username` AND `alias` independently (was
  `username||alias`, silently dropping alias search whenever a username also
  existed). Player ID (`fid`) surfaced directly on the card, plus mentioned in
  the `[?]` help sheet, specifically to support finding someone across a
  username change.
- "Missing info" flag narrowed to just troop tiers + alliance name (furnace
  level and joiner heroes no longer count against it).

### Intel Tab
- Joiner Registry entry point **removed** per explicit request. **This makes
  the Coverage/Meta cross-roster views (hero coverage across the whole
  alliance) unreachable from anywhere in the app** — flagged clearly, no
  replacement entry point was requested or built. `ProfileView`'s inline
  editing is per-player only, it doesn't replace that.
- English-speaker + Discord stat added to the summary row, clickable → full
  list. Likely-fix (unconfirmed) for a width-mismatch bug: the three
  full-screen library overlays (Joiner Registry before removal, Notice
  Library, ASCII Art Library) were `position:fixed` with no `maxWidth`, while
  every normal tab gets 480px centering from a parent Caroline never
  uploaded (`App.jsx`) — added the same `maxWidth:480, margin:'0 auto'`
  directly to the overlay wrapper as the most likely fix.

### ASCII Art Library
- Fixed a real data-entry bug: a 7-line kaomoji+border piece had been split
  across 4 separate library entries in an earlier session (one connector
  line saved once instead of the 4 times it actually repeats) — merged back
  into the single piece it always was.
- Added a heavy-line divider (built from its Unicode codepoint × count,
  not hand-typed — "verify, don't eyeball" per Caroline's own established
  practice) and 6 new pieces (SvS banners, mass-message templates). One
  piece (an SvS Prep Guide checklist) arrived with no row/column structure —
  **stored verbatim, flagged, not reconstructed** — needs re-pasting from
  its original source if it's ever going to be usable as a real checklist.
- ⚠️ **Seed data changes never reach live app data** until Caroline taps
  "Reset library to defaults" (established one-time-seed pattern) — she was
  asked whether that's acceptable multiple times and never confirmed either
  way. Don't assume the merge/new pieces are visible in her actual library.

---

## 3. Architecture & Conventions (new/changed this session)

- **Two-step inline confirm** for anything destructive or bulk — tap once to
  arm (visibly changes, e.g. "✕" → "Remove?"), tap again within ~2.5s to
  commit, auto-reverts otherwise. Established pattern now, used in ~6 places.
  Never use `window.confirm`/`window.alert` (pre-existing rule, still holds).
- **44×44px minimum touch targets**, audited and fixed repeatedly this
  session after real "hard to tap" / "wrong button selected" reports. If you
  add a new tappable element, check its size against this explicitly.
- **Conditionally-mounted content that shifts layout is a confirmed real bug
  class on this app** (mobile touch + reflow mid-gesture). Prefer reserving
  space (disabled/grayed placeholder) over mount/unmount for anything that
  appears based on a selection the user might make quickly in sequence.
- **Category/subheading grouping over flat lists + tick columns** — established
  across the roster export (alliance-grouped), event export and both copy-text
  features (RSVP/attendance-category-grouped). If a column's value is fully
  determined by which subheading a row sits under, drop the column.
- **Verify logic against constructed test cases before presenting as done** —
  used a Python/Node one-liner to trace functions through realistic inputs
  probably a dozen times this session, caught real bugs each time (a naive
  mismatch-detection algorithm that would've flagged the majority instead of
  the outlier; a category-label typo that would have silently dropped an
  entire group from output with no error). Keep doing this for anything
  classification/sorting-related.
- **Copy-to-clipboard output is always plain text**, never wrapped in
  `` ``` `` code-fence — established early, re-confirmed multiple times.
  `PlanDetail.jsx` and `NoticeLibrary.jsx` were flagged as still having this
  bug (an old handoff claimed it was already fixed everywhere; it wasn't) —
  **never actually fixed**, still open.
- **Shared logic lives in one place**: `getCurrentTroopPower` was duplicated
  in `RosterTab.jsx`, consolidated into `metrics.js` and re-exported.
  `getPriorityTier`/`comparePriority` live in `PlayerCard.jsx` specifically so
  the card's own badge and `RosterTab`'s sort option can never drift apart.
- **zsh vs bash**: Caroline's terminal is zsh (Mac default) — inline `#`
  comments in a multi-line pasted command block break it ("missing end of
  string" / literal `#` treated as a filename). **Never include inline shell
  comments in terminal instructions given to her** — list expected outputs
  in prose above/below the command block instead.

---

## 4. localStorage / Data Model Registry (additions this session)

| Key/Field | Location | Contents |
|---|---|---|
| `event.allianceTags` | Event | Array, replaces singular `allianceTag`. Old events auto-migrate on open via `EventSheet.jsx`'s `withMigratedAlliance`. |
| `event.squads` | Event | `[{ id, name, leaderId, memberIds[] }]` — Squad Balancer output, Foundry/Canyon Clash only. |
| `snapshot.rsvp.intermittent` / `.unsure` | Snapshot | New RSVP states. `.onTime` **removed** — do not reference. |
| `snapshot.attendance.excused` | Snapshot | Already existed, now surfaced in UI/exports (paired with `noShow`). |
| `player.leaderProfile.marchTime` | Player | Seconds, profile-level (not per-team). Same "last 2 digits = seconds" input convention as Live Rally Room, parsed locally in `RallyLeaderProfileSheet.jsx` (no shared parser file was available). |
| `leaderTeam.heroSkillLevels` | Player | `{ [heroName]: 1-5 }`, alongside existing `widgets`. |
| `asciiArt.copyCount` / `.sortOrder` | ASCII art | Schema-level prep for a future "most copied" sort / manual reorder — **no UI built**, `AsciiArtLibrary.jsx` was never uploaded. |

---

## 5. Real Gaps — Files Never Obtained, Work Genuinely Blocked On Them

- **`App.jsx`** (or whatever the true top-level component is) — never seen
  all session. Two concrete consequences:
  1. `EventsTab.jsx` doesn't receive a `plans` prop from its actual parent —
     added `plans = []` as a safe default so nothing breaks, but **Rally
     Leader Heroes will show blank in every export until someone finds
     wherever `<EventsTab>` is rendered and adds `plans={plans}`** (almost
     certainly sitting right next to an existing `<BattleTab plans={...}>`
     call).
  2. Sticky-bar/overlay `top`/`maxWidth` offsets in `EventsTab.jsx` and
     `IntelTab.jsx` are best-guesses based on `CONSTITUTION.md`'s documented
     ~60px header, never verified against the real value.
- **`nameList.js`** — `parseNames`/`matchNamesToPlayers`/`findCloseMatches`
  used throughout (`AddParticipantPanel.jsx`, `VerifyRosterPanel.jsx`,
  `BulkNameAdd.jsx`) but the actual implementation has never been seen. Its
  behavior is inferred entirely from call sites.
- **`fieldRegistryService.js`**, **`DeleteConfirmModal.jsx`**,
  **`roles.js`** (`roleColor`/`roleIcon`), **`vibe.js`**, **`dates.js`** — all
  imported and relied upon (e.g. `DeleteConfirmModal`'s prop contract
  `{ message, onConfirm, onCancel }` was inferred from a single usage site in
  `RallyLeaderProfileSheet.jsx`, never verified against the actual file).
- **`AsciiArtLibrary.jsx`** — the `copyCount`/`sortOrder` schema fields exist
  for a future sort-by-most-copied / manual reorder feature that was
  requested but never built, since this file was never uploaded.
- **`JoinerSlotRow.jsx`, `FormationPicker.jsx`, `Primitives.jsx`,
  `BulkNameAdd.jsx`** — all *were* eventually obtained and reviewed; no
  changes were needed in `Primitives.jsx` or `BulkNameAdd.jsx` specifically
  (existing behavior already satisfied what was asked).

---

## 6. Open Questions / Explicitly Unresolved

Things that were flagged to Caroline during the session and never got a
follow-up answer either way — don't assume a direction on these, ask:

1. Should the red/green/blue troop-color scheme extend beyond the member
   card to Battle Plans / Profile view (currently inconsistent)?
2. Should the gold-reserved-for-mismatch rule extend to Rally Lead pills,
   the crown button, and reliability-score coloring?
3. Does Joiner Registry's Coverage/Meta view need a new home now that it's
   unreachable from Intel?
4. Is the ASCII Art Library's "Reset to defaults" tap acceptable to lose any
   art Caroline's added since, or does she need a non-destructive migration
   instead?
5. `PlanDetail.jsx`/`NoticeLibrary.jsx` still code-fence their copy output —
   flagged twice, never fixed, low priority but real.
6. A one-off "stray empty rounded element below the last member card" bug
   report — never located (no code-level cause found, screenshot was
   requested, never received). May or may not still exist.

---

## 7. Process Notes For Whoever Picks This Up

- **Always verify the terminal command output, don't just trust a `cp` ran**.
  Several rounds this session were "it's not showing up" → eventually traced
  to: wrong folder (`src/public/` instead of root `public/`), stale
  downloads with `(1)` suffixes, or — the big one — **local commits that were
  never pushed to `origin`** (`git status` showed "ahead of origin by N
  commits" for an unknown-but-nontrivial stretch, meaning Vercel never saw
  several rounds of fixes). Ask for `git status` output if something "isn't
  working" after a build succeeds cleanly.
- **Balance-check every JSX/JS edit** (parens/braces count, `node --check`
  where the file has no JSX) before presenting it — this was done
  consistently and caught real mistakes (a duplicated closing bracket, a
  stray leftover line) before they shipped.
- Caroline's org has a plugin/skill catalog available but it was never
  surfaced/used this session — hasn't come up as relevant.
