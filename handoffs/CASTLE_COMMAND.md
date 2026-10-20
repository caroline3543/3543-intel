# Unified Battle Command

The separate Castle Command module has been merged into existing Battle planning and Live Rally Room. Existing plan formations, priority joiners, eligibility/attendance checks, checklist, copy summaries and test-rally logs remain intact.

## Workflow
- Battle plan: optional commander/deputy/garrison/backup/reinforcement assignments use existing member IDs.
- Go Live: existing leaders, ratio and joiners are copied with stable slot/member IDs. March times are prefilled from the existing registry or leader profiles.
- Leaders: reuse/save marches with existing quick input (412 = 4m12s, 4:12 also accepted), availability, capacity and notes. Backup/restore and standalone draft import are here.
- Timing: existing arrive-at or first-open countdown modes, explicit UTC date, independent rally durations, explicit earlier/later offsets, switching calculator, reusable timing presets.
- Live: next action, unlimited chronological timers, reported/confirmed statuses, actual timestamps, capture confirmation and failure holds, dependency controls, live switching margins, callouts, pause, foreground alerts, audit history.

A clock reaching zero never confirms an opening or capture. Unconfirmed timers are not auto-archived. Archive is explicit after a terminal status; linked parent events must remain until descendants are archived. Enemy timestamps are fixed unless explicitly edited. Changed enemy timing puts that sequence on review hold.

## Persistence
Existing svs_live_rally_room_v2 data is retained and extended. Old offsets in the calculator migrate once to a consistent later-positive convention without shifting already scheduled timers. Scheduled times persist as UTC epoch seconds. Standalone command draft milliseconds convert explicitly on import; its original key is retained untouched. Invalid saved JSON is preserved and blocks writes until a valid backup is restored. Other-tab edits block writes pending reload.

## Validation
- node --test tests/*.test.js: 20 passing tests.
- Vite build passes; existing large bundle warning remains.
- DOM integration with React StrictMode: six simultaneous timers, capture confirmation, failed capture hold, fixed enemy, pause, view navigation, UTC date and persisted state; no runtime errors.
- DOM verification does not verify visual layout. Real browser/mobile and actual iPhone verification are still required before merging to production.

## Limits
Local-device operations only. Shared rooms require authenticated membership and atomic revisions/server time in Supabase. No game API is assumed. Device clock confidence is shown as unverified. Foreground notifications cannot run while the app is suspended. Actual results still require commander reporting. Live timers remain separate from global player/plan storage; plans continue using the existing persistence/cloud sync.
