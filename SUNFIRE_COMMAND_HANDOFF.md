# Sunfire Command — Project Handoff Document

> Generated for conversation migration. Contains the complete state of the project as of this session.

---

## 1. Project Overview

### Purpose
Sunfire Command is a mobile-first Progressive Web App (PWA) for Whiteout Survival alliance officers. It helps officers plan and coordinate SvS (Server vs Server) battles, manage roster members, track joiner hero assignments, and run live rally timing during active fights.

### Target Users
- **Primary:** Alliance officers (R4/R5) coordinating SvS battles — typically 1–3 people per alliance
- **Secondary:** Rally leaders who need countdown timers during live gameplay
- **Context:** Used on mobile during 5-hour SvS events, often shared via Discord screen share

### Core Goals
1. Replace spreadsheets for roster and battle planning
2. Provide real-time rally countdown timers for rally leaders
3. Surface joiner hero meta suggestions based on community data
4. Enable pre-battle assignment of leaders, joiners, and heroes
5. Track member availability and performance across events

### Repository
- **GitHub:** `caroline3543/sunfire-castle-planner`
- **Branch:** `main`
- **Local path:** `/Users/caroline/Desktop/sunfire-castle-planner/`
- **Deployment:** Vercel

---

## 2. Current Architecture

### Technologies
| Layer | Technology |
|---|---|
| Framework | React 18 (Vite) |
| Language | JavaScript (JSX) |
| Styling | Inline styles only — no CSS files, no Tailwind |
| State | `useState` + `useEffect` + custom hook (`useAppState`) |
| Persistence | `localStorage` (JSON) — auto-saves on every data change |
| Export | SheetJS (`xlsx`) for `.xlsx`, native JSON for backup |
| Mobile haptics | `vibe.js` wrapper around `navigator.vibrate` |
| Routing | None — single page, tab-based navigation |
| PWA | `vite-plugin-pwa` with basic manifest |

### Folder Structure
```
src/
  App.jsx                          — thin coordinator, 5-tab nav, global modals
  main.jsx                         — React root mount

  hooks/
    useAppState.js                 — ALL shared state, auto-save, CRUD operations

  components/
    common/
      Primitives.jsx               — Field, Inp, Sel, TierPill, ToggleRow, Toast, SheetHandle
      PlayerPicker.jsx             — reusable member selector
      DeleteConfirmModal.jsx       — confirmation modal (replaces window.confirm)
      TabErrorBoundary.jsx         — wraps each tab, catches crashes gracefully
      AlliancePicker.jsx           — alliance tag chip + text input

    players/
      PlayerCard.jsx               — compact member card in roster list
      ProfileView.jsx              — read-only member profile
      PlayerSheet.jsx              — 3-step add/edit wizard (Identity / Combat / Availability)
      BatchAddSheet.jsx            — bulk add multiple members
      RosterTab.jsx                — Members tab coordinator

    svs/
      BattleTab.jsx                — Battle Plans + assignment sheet + formation picker
      LiveRallyRoom.jsx            — Live rally timers, calculator, march registry

    events/
      EventsTab.jsx                — Event management + attendance tracking

    stats/
      IntelTab.jsx                 — Summary stats + Joiner Registry card
      ScoresTab.jsx                — Prep scores tracker

    tutorial/
      TutorialOverlay.jsx          — Onboarding tutorial overlay

    LandingPage.jsx                — First-launch welcome screen
    DataPanel.jsx                  — JSON + .xlsx export/import
    SettingsPanel.jsx              — Alliance settings + Hero Generation selector
    JoinerRegistry.jsx             — Hero registry, coverage, stacking, meta views

  data/
    dataManager.js                 — Storage helpers
    playerSchema.js                — All schema constructors (newPlayer, newSvsPlan, etc.)
    metrics.js                     — Scoring and metric calculations
    joinerMeta.js                  — JOINER_META Gen 1–6, hero meta tables from spreadsheet
    defaultData.json               — 8 demo players pre-loaded for new installs

  services/
    exportImportService.js         — JSON export/import, localStorage load/save
    exportXlsx.js                  — SheetJS .xlsx export (multi-sheet workbook)
    joinerRegistryService.js       — Hero coverage and stacking logic
    batchAddService.js             — Bulk player add parsing
    svsTimingService.js            — March timing calculations
    playerMatching.js              — Player search and match logic
    playerAutosuggest.js           — Auto-suggest for player pickers
    rallyTimingParser.js           — Fast input parsing for march/impact times

  tutorial/
    TutorialRegistry.js            — Tutorial step definitions

  utils/
    constants.js                   — C (colours), ROLES, EVENT_TYPES, HEROES_BY_GEN, etc.
    normalize.js                   — Data normalisation helpers
    dates.js                       — Date utilities + uid() generator
    vibe.js                        — Haptic feedback wrapper
```

### Data Flow
```
localStorage
    ↓ on mount
useAppState (hook)
    ↓ derived arrays: players, events, svsPlans, prepScores, settings
App.jsx (coordinator)
    ↓ props to each tab
Tab components
    ↓ mutations call ops: savePlayer, saveSvsPlans, etc.
useAppState
    ↓ updates localStorage on every change (useEffect)
```

**Live Rally Room state is separate:** Stored under `svs_live_rally_room_v2` in localStorage, managed entirely within `LiveRallyRoom.jsx`. Not part of the global state.

---

## 3. Design System

### Colour Palette
```js
C.bg      = '#0A1628'  // Deep navy — page background
C.card    = '#1E3A52'  // Lighter navy — card backgrounds
C.section = '#152236'  // Mid navy — section backgrounds
C.gold    = '#F5A623'  // Gold — primary accent, CTAs, active states
C.white   = '#FFFFFF'  // White — primary text
C.icy     = '#A8C4D8'  // Ice blue — secondary text
C.muted   = '#5A7A94'  // Muted blue — placeholder, disabled text
C.border  = '#2A4A64'  // Border colour
C.red     = '#FF453A'  // Red — danger, alerts, OPEN RALLY NOW
C.green   = '#30D158'  // Green — success, ✓ Rally Open
C.inf     = '#6B8CAE'  // Infantry blue
C.lan     = '#7BAE8C'  // Lancer green
C.mar     = '#B8859A'  // Marksman pink
```

### Rally Type Colours
```
Main Rally:       #F5A623  (gold)
Counter Rally:    #FF453A  (red)
Counter-Counter:  #FF8C00  (orange)
Switch Fight:     #30D158  (green)
Garrison Entry:   #6B8CAE  (blue)
Reinforcement:    #7BAE8C  (teal)
Custom:           #A8C4D8  (ice)
```

### Typography
- **Font:** `system-ui, -apple-system, sans-serif` — native system font
- **No web fonts loaded** — intentional for performance
- **Scale:** 9px (micro labels) → 11px (metadata) → 12px (secondary) → 13–14px (body) → 15–16px (primary) → 18–22px (headings) → 48–80px (countdown timer)
- **Weights:** 400 (normal), 600 (semi-bold), 700 (bold), 800–900 (timer display)

### Layout & Mobile-First Rules
- **Max width:** 480px, centred on desktop (`maxWidth:480, margin:'0 auto'`)
- **Bottom nav:** Fixed, 60px height, 5 tabs
- **Sticky header:** 60px approximately
- **Page padding:** `16px 20px` standard
- **Bottom content padding:** 80px (clears nav) + extra when sticky bars are present
- **Touch targets:** Minimum 44px height on all interactive elements
- **No hover states** — mobile-first, tap only

### UX Principles
1. **Speed during live gameplay** — tap count matters; no duplicate data entry
2. **Compact information density** — officers scan, not read
3. **Bottom sheets** for all forms (slide up from bottom)
4. **Prose not bullets** in instruction text
5. **Inline edit** preferred over separate edit screens where possible
6. **Haptic feedback** (`vibe.js`) on all significant actions
7. **Toast notifications** for confirmations — not alerts
8. **Progressive disclosure** — show complexity only when needed
9. **Colour signals phase** — stage colours change automatically as time approaches

---

## 4. Features Implemented

### 4.1 Roster (Members Tab)
**Purpose:** Manage the alliance member roster.

**Status:** ✅ Complete

**Files:** `RosterTab.jsx`, `PlayerCard.jsx`, `PlayerSheet.jsx`, `ProfileView.jsx`, `BatchAddSheet.jsx`

**Capabilities:**
- View all members in card grid
- Toggle between all members and By Role view
- SvS summary bar: Available / On Discord / Unconfirmed counts
- Add member (3-step wizard): Identity → Combat → Availability
- Edit member profile
- Delete member (with confirmation)
- Batch add multiple members
- Search/filter roster
- Role assignment: Rally Lead, Attack Team, Joiner, Garrison, Flexible, Reserve

**Player data model:**
```
id, fid, username, alias, allianceTag
country, timezone, languages[]
furnaceLevel (string: "FC1"–"FC5")
troops: { infantry, lancer, marksman }  — stored as FC tier strings
infantryCampLevel, lancerCampLevel, marksmanCampLevel
joinerHeroes: [{ hero, skillLevel, verified, updatedAt }]
roles[]
availability: { present, timing, lateBy, earlyBy, discord }
eventAvailability: { "EventName": { present, timing, discord } }
teamAssignment, notes, profileLastUpdated, createdAt, eventHistory[]
```

**Key decisions:**
- `furnaceLevel` stored as string `"FC3"` not number (display directly, no prefix)
- Joiner heroes stored with skill level — only Skill 5 heroes are shown in pickers
- 3-step wizard with completion indicators (⚠ missing / ✓ complete per step)

---

### 4.2 Battle Plans (Battle Tab)
**Purpose:** Pre-battle rally assignment sheet — plan who leads, who joins, what heroes.

**Status:** ⚠️ Under Development (dev banner shown)

**Files:** `BattleTab.jsx`, `playerSchema.js` (newSvsPlan, newRallySlot, newJoinerSlot)

**Capabilities:**
- Create/edit/delete/duplicate battle plans
- Each plan has multiple rally slots
- Rally slot assignment: type, leader, duration, ratio, troop requirements, formation, 4 priority joiners
- Formation picker: guided (meta table) or custom
- Offense/Defense filter for formations
- Generation-filtered formations (respects Settings generation)
- Hero suggestions auto-populate from meta table based on leader's rally heroes
- Coverage check: shows how many roster members can fill each joiner hero slot
- Troop tier requirements per rally (Infantry/Lancer/Marksman minimum FC)
- Joiner picker filters out members below troop tier (shown greyed with reason)
- Slot reordering (↑↓ buttons)
- Slot delete with confirmation (shows joiner count)
- "Go to Members →" shortcut when no Rally Leads assigned
- Sticky "Go Live" bar at bottom when plan has leaders
- Duplicate plan

**Battle plan schema:**
```
SvsPlan: { id, name, allianceTag, date, status, notes, rallySlots[], createdAt }
RallySlot: {
  id, type, leaderId, leaderName, rallyDuration (1/3/5 min),
  ratio, troopReqs: { infantry, lancer, marksman },
  leaderRallyHeroes[], requestedHeroes[],
  formationMode ('guided'|'custom'), formationFilter,
  selectedFormation: { gen, leaders[], type },
  joiners: [JoinerSlot × 4], notes
}
JoinerSlot: { id, playerId, playerName, heroName, confirmed, replacedBy }
```

**Key decisions:**
- Old rally timing section retired — timing lives in Live Room only
- 4 priority joiners per slot (must join first with specific hero)
- `Jessie*` = Jessie/Jasser/Jeronimo substitution rule encoded
- `Sergey**` = Bahiti/Lumak Bokan/Sergey substitution rule encoded
- Players without required FC tier are shown greyed and unselectable in joiner picker
- "Custom" formation mode allows any hero/ratio combination

**Known gaps:**
- Replacement auto-suggestion during live battle not fully tested
- Formation picker scoring algorithm is heuristic, not exhaustive

---

### 4.3 Live Rally Room
**Purpose:** Real-time rally countdown timers for rally leaders during live SvS.

**Status:** ✅ Functional (core complete)

**Files:** `LiveRallyRoom.jsx`, `rallyTimingParser.js`

**Storage key:** `svs_live_rally_room_v2` (separate from global state)

**Three tabs:**
1. **💾 March Times** — save march times for rally leaders; links to roster Rally Leads
2. **🧮 Calculator** — set impact time + rally duration, add leaders from saved chips, see open/march/send times
3. **⏱ Live Timers** — active countdown cards, full-screen leader mode, archive

**Timer phase system (Leader-only, no Joiner Timer):**
```
Phase 1: Stand By       (>120s before open time)      — grey
Phase 2: Get Ready      (30–120s before open time)     — ice blue
Phase 3: Prepare To Open Rally (5–30s)                 — orange
Phase 4: ⚠ OPEN RALLY NOW (0s)                         — RED + strong vibration
Phase 5: ✓ Rally Open — Joiners Joining (counting to impact) — green
Phase 6: ✓ Impact                                       — green
```

**March time input format (last 2 digits = seconds):**
```
9    → 0:09
45   → 0:45
118  → 1:18
412  → 4:12
1030 → 10:30
1:18 → 1:18 (colon also accepted)
475  → INVALID (75s not valid)
```

**Impact time input:**
```
2200    → 22:00 UTC
22:00   → 22:00 UTC
220030  → 22:00:30 UTC
```

**Key calculator features:**
- Rally duration (1/3/5 min) applied to all leaders; per-leader override in expand
- Leader chips from March Times registry — tap to add instantly
- Compact table: Leader / March / Send at / Offset columns
- "Open at" and "Send at" both shown (open = when leader opens rally)
- "Start Timers" disabled until at least one leader has march time entered
- Per-leader message template override (expand row → Custom message toggle)
- Copy message button generates Discord-ready text with joiners + heroes
- Clear all active timers button

**Message template variables:**
`{type}` `{name}` `{impact}` `{open}` `{joiners}` `{ratio}`

**Auto-archive:** 30s after impact, timers move to "✓ Completed" section (checked every 10s via `setInterval`). Collapsed by default; tap to expand full record.

**Full-screen Leader Mode:**
- 80px countdown (counts to "Open Rally" time, switches to impact countdown after rally opens)
- Strip at top shows other active timers with their type/name and countdown
- Vibration at each phase transition
- Shows: ratio, open time, march time, impact time, priority joiners with heroes

**Go Live integration:**
- From Battle Plan → tap "Go Live" → Live Room opens
- Calculator pre-populated with all rally slot leaders (marchSecs=null, filled on the day)
- Joiner assignments carry through to timer cards
- On "Start Timers" → timers created instantly, switch to Live Timers tab

---

### 4.4 Events Tab
**Purpose:** Track events and member attendance.

**Status:** ⚠️ Under Development (dev banner shown)

**Files:** `EventsTab.jsx`

**Capabilities:**
- Create events (type: SvS, SvS Castle Battle, Internal Sunfire Castle, Foundry, Canyon Clash, Bear Trap, Transfer Season, Custom)
- Event detail with participant list
- Snapshot editor (record attendance per member)
- Attendance tracking: registered, attended, late, left early, no-show
- Voice tracking, combat tracking
- Performance tags: ⭐ Strong, ✓ Reliable, ↑ Improving, ⚠ Issue, ✗ No-show
- Post-event final summary card

---

### 4.5 Intel Tab
**Purpose:** Alliance statistics and joiner hero management.

**Status:** ✅ Functional

**Files:** `IntelTab.jsx`, `JoinerRegistry.jsx`

**Capabilities:**
- Summary line (player count, FC levels)
- Leaderboard of members
- Joiner Registry card (opens full-screen)
  - **Registry view:** Each player's Skill 5 heroes
  - **Coverage view:** For each hero, how many members have it at Skill 5
  - **Stacking view:** Potential stacking conflicts (same hero multiple members)
  - **Meta view:** Community meta formations (from joinerMeta.js)

---

### 4.6 Scores Tab
**Purpose:** Track prep scores for upcoming SvS.

**Status:** ✅ Functional

**Files:** `ScoresTab.jsx`

**Capabilities:**
- Add/edit prep scores per member
- Target score vs actual score
- Score history per member

---

### 4.7 Settings
**Purpose:** Alliance-wide configuration.

**Status:** ✅ Complete

**Files:** `SettingsPanel.jsx`

**Fields:**
- Alliance Name (shown in header)
- Alliance Tag (e.g. R3K)
- State ID (e.g. 3543)
- **Hero Generation** (Gen 1–6) — filters formation suggestions in Battle Planning

---

### 4.8 Data Panel (Export/Import)
**Purpose:** Backup and restore all data.

**Status:** ✅ Complete

**Files:** `DataPanel.jsx`, `exportImportService.js`, `exportXlsx.js`

**Capabilities:**
- Export JSON (full backup)
- Import JSON (replace or merge)
- Export .xlsx (SheetJS, multi-sheet: Overview, Roster, Joiner Coverage, Prep Scores, one sheet per event)
- Events with type in `JOINER_COVERAGE_EVENTS` auto-include joiner coverage columns

---

### 4.9 Landing Page & Tutorial
**Status:** ✅ Complete

**Files:** `LandingPage.jsx`, `TutorialOverlay.jsx`, `TutorialRegistry.js`

**Capabilities:**
- First-launch welcome screen (shown until `svs_onboarded` set in localStorage)
- Import existing data on first launch
- Tutorial mode (Beginner / Officer)
- Tutorial picker accessible from header (📖 button)

---

### 4.10 Joiner Meta System
**Purpose:** Community-sourced hero formation data from the WOS spreadsheet.

**Status:** ✅ Data complete Gen 1–6, ⚠️ integration in Battle Plan is heuristic

**Files:** `joinerMeta.js`, `JoinerRegistry.jsx`

**Data covers:** Gen 1–6 formations, each with:
- Generation number and label
- Formation type (Defense/Offense/NEW META)
- Leader hero requirements
- 4 joiner hero slots (j1–j4)
- Alternative heroes (alt1, alt2)
- Comments/warnings
- Ratio requirements

**Hero substitution rules (encoded in BattleTab.jsx):**
```
Jessie*  = Jessie | Jasser | Jeronimo
Sergey** = Sergey | Bahiti | Lumak Bokan
Seeyoon  = Seo-Yoon | Seeyoon
```

**Generation setting** in Settings filters formations to ≤ selected generation.

---

## 5. Business Rules

### Rally Rules
1. **Rally leader opens the rally** — the game auto-marches when rally timer expires. Leaders do NOT manually send.
2. **Rally duration options:** 1 min, 3 min, or 5 min — set per rally slot and per session in calculator.
3. **4 priority joiners per rally** — must join first before other alliance members, each with a specific hero.
4. **No joiner timer** — only leader timers exist. Joiners are responsible for sending their own march.
5. **Max 5 simultaneous timers** in Live Room.
6. **Timers auto-archive 30s after impact** — moved to Completed section.

### March Time Rules
1. **Last 2 digits = seconds, rest = minutes** (e.g. `412` = 4m 12s, `45` = 0m 45s)
2. **Seconds must be 00–59** — `475` is invalid.
3. **Impact time is UTC** — all times displayed in UTC.
4. **Open rally time = Impact time − March time − Rally duration**
5. **Send time (march auto-sends) = Impact time − March time**

### Hero Rules
1. **Only Skill 5 joiner heroes count** for coverage checks and joiner picker.
2. **Jessie\*** means any of: Jessie, Jasser, Jeronimo — interchangeable for coverage.
3. **Sergey\*\*** means any of: Sergey, Bahiti, Lumak Bokan.
4. **Hero generation** setting in Settings limits which formations are suggested.
5. **Leader rally heroes** (the heroes used to lead the rally) determine the formation match.
6. **Do not stack the same hero** across multiple joiners in one rally.

### Troop Requirements
1. **FC tier is per troop type** (Infantry, Lancer, Marksman) — not a single overall tier.
2. **Members below the required FC tier are excluded** from joiner picker (shown greyed with reason).
3. **Tier ordering:** FC1 < FC2 < FC3 < FC4 < FC5 < T10/T11/T12.

### Joiner Coverage
1. **Coverage check** runs against the roster — shows how many members can fill each hero slot.
2. **Eligible with heroes** shown first (gold section), **eligible without heroes** below, **below troop tier** greyed at bottom.
3. **Replacement suggestions** appear when a joiner is marked unavailable mid-battle; suggestions must: have the required hero, not already be assigned, be available.

### Member Management
1. **Furnace level stored as string** `"FC3"` — never prepend "FC" again in display.
2. **Roles** are array — a member can have multiple roles.
3. **Rally Lead** role = primary filter for leader picker and march time quick-add from roster.
4. **Event availability is per-event** — `eventAvailability["SvS Week 3"]` separate from general `availability`.

### Battle Plan Rules
1. **One plan = one complete battle** (multiple rally slots for Main, Counter, Switch Fight etc.)
2. **Plans have status:** draft → live → completed.
3. **Deleting a rally slot with assigned joiners** requires confirmation showing joiner count.
4. **Custom formation mode** always available — no generation restriction.

---

## 6. Known Bugs

### B1 — `window.confirm` still used in Live Room "Clear all" button
**Symptom:** Breaks dark theme on iOS (native browser dialog).
**File:** `LiveRallyRoom.jsx` (handleStartTimers area)
**Fix:** Replace with `DeleteConfirmModal` or inline confirmation.

### B2 — Auto-archive timing may drift
**Symptom:** Timers may persist slightly longer than 30s after impact before archiving.
**Cause:** `setInterval(10000)` checks every 10s, so max delay is ~40s.
**File:** `LiveRallyRoom.jsx`
**Severity:** Low — cosmetic.

### B3 — Plan pre-population from Go Live fires showToast before it's initialised
**Symptom:** Occasional silent failure on first Go Live tap.
**Cause:** `showToast` called inside `useEffect` that runs before state is ready.
**File:** `LiveRallyRoom.jsx` (planLoadedRef useEffect)
**Fix:** Ensure `showToast` is defined before the effect runs (it is now, but worth verifying).

### B4 — Joiner Registry accessible from Intel tab but not from Battle Plan
**Symptom:** Officers must leave Battle Plan to check hero registry.
**Not a crash** — UX gap only.

### B5 — Formation picker scoring is heuristic
**Symptom:** May not always select the best formation when leader heroes partially match multiple gens.
**Cause:** Simple string-match scoring, not exhaustive.
**File:** `BattleTab.jsx` (`suggestJoinerHeroes`)

---

## 7. Technical Debt

### TD1 — BattleTab.jsx is 988 lines
Should be split into: `FormationPicker.jsx`, `RallySlotCard.jsx`, `JoinerSlotRow.jsx`, `PlanDetail.jsx`, `PlanList.jsx`.

### TD2 — LiveRallyRoom.jsx is 1006 lines
Has been rewritten multiple times due to incremental patches. Should be split into: `TimerCard.jsx`, `LeaderMode.jsx`, `Calculator.jsx`, `MarchRegistry.jsx`, `ArchivedSection.jsx`.

### TD3 — Inline styles everywhere
Every component uses inline `style={{}}` objects. Switching to CSS modules or a design-token approach would reduce bundle size and improve maintainability. Low priority given mobile-first requirements.

### TD4 — `window.confirm` in Live Room clear button
Should use `DeleteConfirmModal`.

### TD5 — Legacy schema functions in playerSchema.js
`newRally`, `newReinforcement`, `newAssignment`, `newMarchEntry` are all legacy and unused in current UI. Safe to remove.

### TD6 — `JoinerRegistry` opened from IntelTab but also has a `setJoinerRegistryOpen` in App.jsx that is never triggered
Dead code — the `joinerRegistryOpen` state in App.jsx can be removed; `JoinerRegistry` is mounted inside `IntelTab` now.

### TD7 — No TypeScript
All schemas are plain JS objects with no runtime validation. A future migration to TypeScript or Zod would catch schema drift early.

### TD8 — `suggestJoinerHeroes` in BattleTab not imported from joinerMeta.js
The function duplicates logic that exists in `joinerMeta.js` (`getMetaSuggestion`). Should consolidate.

### TD9 — localStorage size not monitored per-save
The storage-full warning fires on a custom event but only if `saveToStorage` throws. No proactive size checking.

### TD10 — EventsTab under-developed relative to other tabs
Attendance tracking, snapshot editor, and post-battle review exist but are not well-integrated with the rest of the app (e.g. event availability not shown in roster).

---

## 8. Open Decisions

### OD1 — Joiner timer (decided: NO)
Decided against a separate joiner countdown. Only leader timers exist.

### OD2 — Per-leader message template (decided: YES, optional override)
Alliance-wide template + optional per-leader override in row expand.

### OD3 — Timer identity system (decided: REVERTED)
Emoji/number/coloured border system was built and reverted per user request. May revisit.

### OD4 — Formation picker — substitution rule enforcement depth
Option B (check all acceptable alternatives when assigning joiners) was chosen but not fully tested at scale. May need refinement for edge cases.

### OD5 — Battle Plan → sync march times from March Registry
Currently march times in the calculator must be entered manually even if a leader has a saved march time in the March Registry. Auto-population from registry to calculator rows when a plan is loaded via Go Live has not been implemented.

### OD6 — Events tab full rebuild
Events tab has a dev banner. The scope of what it should do (beyond current attendance tracking) is not fully defined.

### OD7 — Prep scores integration
Prep scores (Scores tab) are tracked separately. No integration with events or battle plans.

### OD8 — "Clear session" button for Live Room
Suggested but not built — would clear all timers, archive, and calculator state back to blank between SvS rounds.

### OD9 — Hero generation beyond Gen 6
The `HEROES_BY_GEN` constant in `constants.js` includes Gen 7–11 heroes. The `joinerMeta.js` only covers Gen 1–6. The UI generation selector only shows Gen 1–6 from `JOINER_META`. Gen 7+ heroes exist in constants but have no meta formations yet.

---

## 9. Complete Feature Inventory

All features discussed or built in this conversation:

| # | Feature | Status |
|---|---|---|
| 1 | 5-tab mobile navigation | ✅ Done |
| 2 | Roster member list with By Role toggle | ✅ Done |
| 3 | 3-step member add/edit wizard | ✅ Done |
| 4 | Batch add members | ✅ Done |
| 5 | Member delete with confirmation | ✅ Done |
| 6 | SvS summary bar (Available/Discord/Unconfirmed) | ✅ Done |
| 7 | Alliance settings (name, tag, state ID) | ✅ Done |
| 8 | Hero generation setting | ✅ Done |
| 9 | JSON export/import | ✅ Done |
| 10 | .xlsx export (SheetJS, multi-sheet) | ✅ Done |
| 11 | Landing page + onboarding | ✅ Done |
| 12 | Tutorial overlay (beginner/officer) | ✅ Done |
| 13 | Tab error boundaries | ✅ Done |
| 14 | localStorage auto-save with storage-full warning | ✅ Done |
| 15 | Haptic feedback (vibe.js) | ✅ Done |
| 16 | Toast notifications | ✅ Done |
| 17 | AlliancePicker shared component | ✅ Done |
| 18 | DeleteConfirmModal (replaces window.confirm) | ✅ Done (partial — Live Room still uses window.confirm once) |
| 19 | Battle plan create/edit/delete/duplicate | ✅ Done |
| 20 | Rally slot assignment (type, leader, duration, ratio) | ✅ Done |
| 21 | Formation picker — guided (meta table) | ✅ Done |
| 22 | Formation picker — custom (free entry) | ✅ Done |
| 23 | Formation offense/defense filter | ✅ Done |
| 24 | Generation-filtered formations | ✅ Done |
| 25 | Leader rally heroes section | ✅ Done |
| 26 | Joiner hero suggestions from meta table | ✅ Done |
| 27 | Coverage check (how many members can fill slot) | ✅ Done |
| 28 | Troop tier requirements per rally slot | ✅ Done |
| 29 | Joiner picker filtered by troop tier | ✅ Done |
| 30 | 4 priority joiner slots per rally | ✅ Done |
| 31 | Joiner hero picker (Skill 5 only from roster) | ✅ Done |
| 32 | Mark joiner unavailable + replacement suggestions | ✅ Done |
| 33 | Rally slot reordering (↑↓) | ✅ Done |
| 34 | Rally slot delete with confirmation | ✅ Done |
| 35 | Sticky Go Live bar | ✅ Done |
| 36 | Go Live → pre-populate calculator | ✅ Done |
| 37 | Joiner assignments carry from plan to timer cards | ✅ Done |
| 38 | March Times registry (save per leader) | ✅ Done |
| 39 | Quick add from roster (Rally Lead role) | ✅ Done |
| 40 | March time smart input (last 2 digits = seconds) | ✅ Done |
| 41 | Impact time smart input (no-colon format) | ✅ Done |
| 42 | Send Calculator compact table | ✅ Done |
| 43 | Open rally time calculated (impact − march − duration) | ✅ Done |
| 44 | Rally duration apply-to-all + per-leader override | ✅ Done |
| 45 | Landing offset per leader row | ✅ Done |
| 46 | Copy message button (Discord text) | ✅ Done |
| 47 | Alliance-wide message template | ✅ Done |
| 48 | Per-leader message template override | ✅ Done |
| 49 | Message variables: {type} {name} {impact} {open} {joiners} {ratio} | ✅ Done |
| 50 | Leader chips (saved march times as tap-to-add chips) | ✅ Done |
| 51 | Start Timers disabled until march time entered | ✅ Done |
| 52 | Start Timers → creates all timers instantly | ✅ Done |
| 53 | Live timer countdown card | ✅ Done |
| 54 | 6-phase timer stage system | ✅ Done |
| 55 | Timer card colour changes per phase | ✅ Done |
| 56 | Progress bar on timer card | ✅ Done |
| 57 | Joiner list on timer card (screen share view) | ✅ Done |
| 58 | Mark joiner In/Out on live timer card | ✅ Done |
| 59 | Full-screen leader mode | ✅ Done |
| 60 | Other timers strip in leader mode | ✅ Done |
| 61 | Vibration at phase transitions | ✅ Done |
| 62 | Auto-archive 30s after impact | ✅ Done |
| 63 | Completed section (collapsed, expandable) | ✅ Done |
| 64 | Full archived record (type, duration, ratio, impact, joiners) | ✅ Done |
| 65 | Clear all active timers button | ✅ Done |
| 66 | UTC clock display | ✅ Done |
| 67 | Tab order: March Times → Calculator → Live Timers | ✅ Done |
| 68 | New timer manually (edge case) | ✅ Done |
| 69 | Edit timer sheet | ✅ Done |
| 70 | Joiner Registry (Registry/Coverage/Stacking/Meta views) | ✅ Done |
| 71 | Hero substitution rules (Jessie*, Sergey**) | ✅ Done |
| 72 | Event create/edit/delete | ✅ Done |
| 73 | Event attendance tracking | ✅ Done (under development) |
| 74 | Post-event summary card | ✅ Done (under development) |
| 75 | Prep scores tracking | ✅ Done |
| 76 | Dev banners on Battle and Events tabs | ✅ Done |
| 77 | "Go to Members" shortcut from Battle Plan | ✅ Done |
| 78 | Plan list shows leader chips preview | ✅ Done |
| 79 | Strategy notes at top of plan | ✅ Done |
| 80 | Timer emoji/number/border identity system | ❌ Built and reverted |
| 81 | "Clear session" button for Live Room | ❌ Not built |
| 82 | March time auto-population from registry on Go Live | ❌ Not built |
| 83 | Events tab rebuild | ❌ Planned |
| 84 | Joiner Registry accessible from Battle Plan | ❌ Not built |
| 85 | Gen 7+ formation meta | ❌ Not built |

---

## 10. Next Priorities (Ranked)

| # | Task | Why |
|---|---|---|
| 1 | **Split BattleTab.jsx into sub-components** | 988 lines, causes frequent merge conflicts and hard-to-locate bugs |
| 2 | **Split LiveRallyRoom.jsx into sub-components** | 1006 lines, has been rewritten 3× due to accumulation of patches |
| 3 | **Replace `window.confirm` in Live Room "Clear all"** | Inconsistent with the rest of the app; breaks iOS dark theme |
| 4 | **Auto-populate march times on Go Live** | When a plan is loaded into the Live Room, leaders already in the March Times registry should have their march time pre-filled in the calculator rows |
| 5 | **Fix formation picker scoring** | Current heuristic can produce wrong suggestions when leader heroes span multiple gens |
| 6 | **Events tab rebuild** | Core feature with a dev banner — needs full completion |
| 7 | **Joiner Registry shortcut from Battle Plan** | Officers need to check hero coverage without leaving the plan |
| 8 | **"Clear session" button in Live Room** | Needed between SvS rounds during a 5-hour event |
| 9 | **Hero coverage count on formation cards** | Currently shows ×N for each joiner slot — needs to account for substitution rules (Jessie* = 3 heroes) |
| 10 | **March time "last updated" indicator in registry** | March times change between events; officers need to know if a saved time is stale |
| 11 | **Delete `newRally`, `newReinforcement`, `newAssignment`, `newMarchEntry` from schema** | Legacy dead code |
| 12 | **Remove dead `joinerRegistryOpen` state from App.jsx** | Dead code — JoinerRegistry mounted inside IntelTab |
| 13 | **Consolidate `suggestJoinerHeroes` with `getMetaSuggestion` in joinerMeta.js** | Duplicate logic |
| 14 | **Gen 7–11 meta formations** | `HEROES_BY_GEN` has Gen 7–11 but no meta data |
| 15 | **Event availability integration with Roster** | `eventAvailability` data exists on players but isn't surfaced in the roster view during event planning |
| 16 | **Post-battle review workflow** | After SvS: mark outcomes, tag performance, log what worked — currently partial |
| 17 | **Battle plan templates** | Common formations (Main+Counter, Main+Switch) saved as reusable templates |
| 18 | **Export includes Battle Plans** | Current .xlsx export covers roster and events but not battle plan assignments |
| 19 | **Prep score integration with events** | Link prep score targets to specific upcoming events |
| 20 | **TypeScript migration or Zod schema validation** | Prevent data model drift as features expand |

---

## 11. Environment Notes

- **Storage key for global data:** Standard localStorage (key managed by `exportImportService.js`)
- **Storage key for Live Room:** `svs_live_rally_room_v2`
- **Onboarding flag:** `svs_onboarded` in localStorage
- **Demo data:** `defaultData.json` — 8 players including Caroline (NZ, FC3, Patrick/Mia/Jessie/Jasser/Sergey heroes)
- **PWA manifest issue:** `icon-192.png` missing — causes a console warning but not a crash
- **`<meta name="apple-mobile-web-app-capable">` deprecation warning** — minor, non-breaking

---

## 12. Key Constraints for Next Developer

1. **Never use `window.confirm` or `window.alert`** — use `DeleteConfirmModal` or inline confirmation patterns
2. **Never add CSS files** — all styling is inline `style={{}}` using `C.` colour tokens
3. **Never add a router** — navigation is tab-based via `setTab()`
4. **Furnace level is always a string** `"FC1"`–`"FC5"` — never a number, never re-prefix with "FC"
5. **All times are UTC** — no timezone conversion, display raw UTC everywhere
6. **Mobile-first** — minimum 44px touch targets, test on iPhone screen width (390px)
7. **Joiner timers do not exist** — only leader timers. Do not add a joiner countdown.
8. **The live room state is completely separate** from the global app state — `svs_live_rally_room_v2` in localStorage, no connection to `useAppState`
9. **The meta table (`joinerMeta.js`) is the source of truth** for joiner hero recommendations — don't hardcode formations elsewhere
10. **HERO_SUBS map** in `BattleTab.jsx` encodes the substitution rules — must be kept in sync with `joinerMeta.js` footnotes
