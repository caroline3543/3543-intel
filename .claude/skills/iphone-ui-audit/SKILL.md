---
name: iphone-ui-audit
description: Audit a screen or change for iPhone usability — touch targets, safe areas, keyboard, gestures, viewport, contrast and design-system compliance. Use before shipping any UI change and when Caroline reports something "feels off" on her phone.
---

# iPhone interface audit

## Automated pass (Playwright, Chromium mobile emulation)
Use the Playwright MCP / plugin or a script based on `tests/*Browser.cjs`:
- Contexts: 390×844 (iPhone 14/15), 375×667 (SE), 430×932 (Pro Max), `isMobile:true, hasTouch:true`, plus one landscape pass.
- Seed synthetic data only (see `tests/hiveBrowser.cjs` addInitScript pattern). Set `svs_onboarded=1` to skip the landing page.
- For each view check and report:
  1. **Targets** — every `button, a, [role=button], input, select` ≥ 44×44 CSS px (`getBoundingClientRect`). List offenders with selector + size.
  2. **No horizontal scroll** — `document.documentElement.scrollWidth <= innerWidth`.
  3. **Fixed/sticky overlap** — sticky bars (e.g. Go Live) must not cover the 60px bottom nav or the last list item (bottom padding ≥ bar height + 80).
  4. **Text** — nothing under 11px except micro labels; no truncated critical values (timers, names).
  5. **Contrast** — text vs `C.bg/C.card/C.section` ≥ 4.5:1 (3:1 for ≥18px bold). `C.muted` on `C.card` is borderline — flag it on critical text.
  6. **Design system** — `npm run check:rules` (no hex, no window.confirm, no CSS imports).
  7. **Console** — zero page errors.
- Save screenshots to `/tmp/<view>-<width>.png` and include paths.

## What emulation can't prove — list as manual checks for Caroline
- Safari safe areas (notch/home indicator): `env(safe-area-inset-*)`, `100dvh` vs `100vh` on the Hive tab.
- iOS keyboard pushing sticky inputs; `maximum-scale=1, user-scalable=no` in `index.html` blocks pinch-zoom (accessibility trade-off — flag, don't change without asking).
- `navigator.vibrate` is not supported on iOS Safari — haptics are a no-op there; never rely on vibration as the only signal.
- Home-screen PWA behaviour (standalone mode, status bar `black-translucent`).
- Real one-handed reach: primary actions in the bottom half.

## Report format
Table: view | width | issue | severity (blocker / fix soon / nit) | evidence. Then the manual checklist above, unticked.
