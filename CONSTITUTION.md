# 3543 INTEL — Project Constitution

> Read this before making any architectural decision, especially at midnight.

---

## What this app is

A mobile-first PWA for Whiteout Survival alliance officers in State 3543.
Used on phones during live 5-hour SvS events. Officers are under pressure.
The app must be fast, reliable, and obvious to use with one hand.

---

## Hard rules — never break these

### UI
- **No `window.confirm` or `window.alert`** — use `DeleteConfirmModal` or inline two-step confirmation
- **No CSS files** — all styling is inline `style={{}}` using `C.` colour tokens from `utils/constants.js`
- **No router** — navigation is tab-based via `setTab()` or local view state
- **No hover states** — mobile-first, tap only
- **Minimum 44px touch targets** on all interactive elements
- **Max width 480px** centred on desktop — never break the mobile layout for desktop

### Data
- **Furnace level is always a string** `"FC1"`–`"FC5"` — never a number, never re-prefix with "FC"
- **All times are UTC** — no timezone conversion anywhere, display raw UTC
- **Only Skill 5 joiner heroes count** for coverage checks and joiner picker
- **`joinerMeta.js` is the source of truth** for joiner hero recommendations — never hardcode formations elsewhere

### Game mechanics — accuracy is non-negotiable
- **Rally leaders open the rally** — the game auto-marches. Leaders do NOT manually send
- **No joiner countdown timers** — only leader timers exist, ever
- **March time format:** last 2 digits = seconds, rest = minutes (`412` = 4m 12s)
- **Open rally time = Impact − March − Rally duration**
- **Rally durations:** 1 min, 3 min, or 5 min only

### Architecture
- **Live Room state is completely separate** from global app state — stored under `svs_live_rally_room_v2` in localStorage, never connected to `useAppState`
- **No TypeScript yet** — plain JS, but schemas live in `playerSchema.js` — add new fields there, not ad-hoc
- **No external UI libraries** — no MUI, no Radix, no Tailwind — inline styles only
- **No new routers, no new global state libraries** without a documented decision

---

## Colour tokens — always use `C.` never hardcode hex

```js
C.bg      = '#0A1628'  // page background
C.card    = '#1E3A52'  // card backgrounds
C.section = '#152236'  // section backgrounds
C.gold    = '#F5A623'  // primary accent, CTAs
C.white   = '#FFFFFF'  // primary text
C.icy     = '#A8C4D8'  // secondary text
C.muted   = '#5A7A94'  // placeholder, disabled
C.border  = '#2A4A64'  // borders
C.red     = '#FF453A'  // danger, OPEN RALLY NOW
C.green   = '#30D158'  // success, Rally Open
C.inf     = '#6B8CAE'  // infantry blue
C.lan     = '#7BAE8C'  // lancer green
C.mar     = '#B8859A'  // marksman pink
```

---

## File structure rules

```
src/components/svs/           — SvS-specific components
src/components/svs/battle/    — BattleTab sub-components
src/components/svs/rally/     — LiveRallyRoom sub-components
src/components/common/        — shared primitives
src/hooks/                    — shared hooks
src/data/                     — schemas, meta tables, static data
src/services/                 — pure functions, no React
src/utils/                    — constants, helpers
```

- **Sub-components live next to their coordinator**, not in a flat `/components` soup
- **Services are pure functions** — no React imports, no side effects
- **Hooks own state** — components own layout

---

## Component size limits

| File | Max lines | Action if exceeded |
|------|-----------|--------------------|
| Any component | 300 | Split into sub-components |
| Any hook | 150 | Extract pure helpers to services |
| Any service | 200 | Split by responsibility |

BattleTab and LiveRallyRoom both hit ~1000 lines before being split. Don't let it happen again.

---

## localStorage keys — complete registry

| Key | Owner | Contents |
|-----|-------|----------|
| `svs_live_rally_room_v2` | `LiveRallyRoom.jsx` | Timers, calculator, march registry |
| `svs_voice_settings` | `useVoiceCountdown.js` | Voice on/off, cues, voiceURI, rate, pitch |
| `svs_onboarded` | `LandingPage.jsx` | Onboarding complete flag |
| (global app data) | `exportImportService.js` | Players, plans, events, scores, settings |

**Never write to localStorage directly in a component** — go through the relevant service or hook.

---

## Decisions already made — don't revisit without cause

| Decision | Outcome | Reason |
|----------|---------|--------|
| Joiner countdown timer | ❌ No | Joiners manage their own march |
| Timer identity system (emoji/number/border) | ❌ Reverted | Visual noise, not useful under pressure |
| Per-leader message template | ✅ Optional override | Alliance default + per-leader override |
| CSS files | ❌ No | Inline styles keep everything co-located |
| Router | ❌ No | Tab-based nav is sufficient and simpler |
| TypeScript | ⏳ Not yet | Future migration path, not now |

---

## Before shipping any feature

- [ ] Tested on actual iPhone (not just browser DevTools)
- [ ] Touch targets all ≥ 44px
- [ ] No `window.confirm` introduced
- [ ] No hardcoded hex colours
- [ ] No hardcoded formations outside `joinerMeta.js`
- [ ] UTC times only
- [ ] localStorage key registered above if new
- [ ] `npm run build` passes

---

## Branch strategy

- `main` — always deployable, auto-deploys to production on Vercel
- `staging` — stable preview, test here on your phone before merging to main
- Feature branches — short-lived, named `feat/description` or `fix/description`
- Never push directly to `main`

---

*Last updated: July 2026*
