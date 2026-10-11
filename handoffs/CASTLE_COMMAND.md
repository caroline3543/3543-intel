# Castle Command Centre

Open Battle → Castle Command Centre. Existing Battle plans and Live Rally Room are preserved.

Implemented: four views, isolated local persistence, UTC rally planning in both directions, linked fixed/relative events, switching margins and risk checks, editable actuals, reported/confirmed distinction, capture failure holds, roster profiles, conflicts, presets, templates, audit history, and foreground notification fallback. Quick clock input is HHMM or HHMMSS; duration input is raw seconds or m:ss. All dates are explicitly UTC.

Run `node --test tests/castleTiming.test.js` and `npm run build`.

Limits: local device mode only. Shared rooms require an authenticated room/membership model, server clock endpoint and atomic revision updates in Supabase. The existing host exposes anonymous optional roster sync but no room identity or auth UI. No command data is written to its unrelated tables. No game API assumed. Notifications cannot execute while suspended. Device clock is unverified and shown as such. Presets load paused with review holds because their dates are historical. Actual iPhone verification is still required before merging to main.
