# Alliance watch

Open Intel → Alliance watch. Add a case-sensitive alliance tag for the current state, then refresh to save its starting roster. Refresh again later to compare every returned member by immutable player ID.

- Furnace changes, power gains and drops, kills, names, and alliance ranks.
- Configurable power-spike threshold (default 5% between consecutive observations).
- Newly returned and missing members are roster-response differences, not confirmed joins or departures.
- Summary power change compares only members with power reported in both snapshots. Total returned power and field coverage are shown separately.
- Search by name or FID; filter by change type and date range; inspect latest members and furnace distribution.
- Refresh one alliance or all watched alliances. Optional 30-minute refresh runs only while the watch screen is mounted and visible. It resets off when the screen closes. No background job or closed-app notification exists.
- Officer sign-in and the existing `whiteoutstats` alliance action are required. Provider caches and incomplete/missing fields limit what can be observed; retrieval time is not upgrade time.
- Watch profiles are separate from the app's managed roster. No player imports, roster removals, or cloud writes occur.
- State-scoped local persistence and JSON backup export/merge; latest 30 snapshots per alliance, up to 5 watched alliances per state. Removing a watch removes its local watch history after confirmation.
- Empty and cross-state responses are rejected. Older/equal-timestamp responses do not rewrite history. Permission and rate-limit errors stop the current refresh batch.

Validation: seven service tests; existing test suite; production build; mobile browser fixture covering add, baseline, refresh, comparisons, filters, persistence, refresh all, empty roster isolation and removal. Browser fixtures exercise the client through a simulated alliance transport. Live officer-authenticated provider requests were not executed.
