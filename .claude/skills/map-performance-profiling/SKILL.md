---
name: map-performance-profiling
description: Measure and improve rendering performance of the Hive planner map and the alliance location map — drag, pan, pinch-zoom, template application and large rosters. Use when the map feels laggy on a phone or before/after any map rendering change.
---

# Map performance profiling

## Baseline (2026-10-21, headless Chromium, desktop CPU, demo plan: 32 members / 120 slots)
- City drag: **1 full `renderMap()` per pointermove** (21 renders for 20 moves), ~4–5 ms each on desktop. `updateDrag()` in `public/hive/map-interactions.js` calls `renderMap()` synchronously; pan is already rAF-coalesced via `paintPan()`. On a phone (4–6× slower CPU, 120 Hz touch events on ProMotion iPhones) that's the most likely source of drag lag.
- `renderMap()` rebuilds the SVG; `world-data.js` is ~450 KB of fixed world features parsed at load.

## How to measure
1. **Render counter (automated):** `tests/hiveCityDragBrowser.cjs` wraps `renderMap` and prints `N renders for M moves, avg X ms`. Budgets via env `HIVE_MAX_RENDERS_PER_MOVE` (default 2) and `HIVE_MAX_AVG_RENDER_MS` (default 40). Tighten them as you improve things.
2. **CPU throttle:** in Playwright, `const cdp=await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate',{rate:6})` to approximate a phone. Record before/after.
3. **Trace:** Chrome DevTools MCP / `page.tracing` — look for long tasks >50 ms during drag, layout thrash (forced reflow from `getBoundingClientRect` inside loops — `mapXY()` calls it per event).
4. **Real device:** Safari Web Inspector on Caroline's iPhone (Timelines → JavaScript & Events) — the only proof that matters for iOS.

## Fix patterns (in order of payoff/risk)
1. Coalesce drag renders: set `mapDrag` coordinates on pointermove, schedule one `requestAnimationFrame` (mirror `paintPan`), render once per frame; flush on pointerup.
2. Cache `viewport.getBoundingClientRect()` at gesture start; refresh on resize only.
3. Update only the dragged item's draft polygon during drag instead of rebuilding the full SVG; full render on drop.
4. Split static layers (world features, terrain) from dynamic (cities, selection) so pans/drags don't re-emit static nodes.
5. Lazy-load/segment `world-data.js` by viewport tile if load time matters.

Always: keep behaviour identical (drop legality, edge-pan, momentum, undo), record vendored changes in `docs/HIVE_INTEGRATION.md`, and report before/after numbers at 1× and 6× throttle.
