# 3573 Caroline

Standalone Members site for State 3573. Uses the shared roster/profile components, with a shared leader workspace and no access to the original app's cloud records.

## Hosting

Vercel project: `3573-caroline`; root directory: `roster-site`; include source files outside the root directory. Install with `npm ci --prefix ..`, build with `npm run build`, publish `dist`.

Server-only environment variables:

- `ACCESS_PASSWORD_HASH`: `salt:scrypt(password, salt, 32)` as hexadecimal.
- `SESSION_SECRET`: at least 32 random bytes; changing it signs everyone out.
- `GAME_API_URL`: existing Supabase project URL.
- `GAME_API_PUBLIC_KEY`: existing public client key, used only by the server here.
- `GAME_SITE_TOKEN`: random server token matching the SHA-256 digest in the dedicated `caroline3573` Edge Function.

No password, session signing key, server token, or private provider key belongs in Vite variables or source files. The provider key remains in Supabase project secrets. The Edge Function checks the server token, restricts requests to State 3573, and uses the existing database-backed lookup limiter. Existing `whiteoutstats` officer access is unchanged.

Sessions last eight hours and use Secure, HttpOnly, SameSite=Strict cookies. API calls require the session and a matching request Origin. Password changes invalidate existing sessions because the password hash participates in session signatures.

The login attempt counter is per function instance; the generated high-entropy password is the primary brute-force protection. All game lookups additionally use durable server-side limits. Every current password holder has leader access to the same roster and TAL plan. Edits sync through the server; IndexedDB keeps pending edits and device backups.

First-run setup offers ARC, RKG and LUN individually or together; no game API requests happen automatically on page open. The three-step tour can be replayed from Help. Preferences are stored per device under `caroline3573_preferences_v1`. Button vibration uses the supported Vibration API with a visual pressed state on all devices; unsupported vibration calls do not block actions.

The header download icon exports the roster using the existing Excel exporter. The `.xlsx` file opens in Excel, Numbers, or Google Sheets; the export includes readable roster sheets and the existing structured data sheets.

## TAL planner

The second tab is a guided state-legion planner: Setup, Times, Legions, Review. It uses the loaded roster without changing game alliance records. `talPlan` syncs with the shared roster and is also cached on each device.

- Choose up to three hosts for this plan and explicitly confirm a host’s second legion is unlocked in game.
- Record each player’s status, season-wide times, notes and optional event troop power. Paste replies by unique name or ID.
- Choose three times per legion. Confirm the available time options against the current in-game event; published sources disagree on one of the five options.
- Two-of-three availability and minimum combatants per time are adjustable planning preferences, not claimed game eligibility rules.
- Suggested teams use confirmed availability and preserve existing assignments. Preview, per-time coverage, unassigned-player lists and conflict messages remain visible; suggestions are heuristics.
- Move, swap, change roles, enter troop powers and choose captains. Missing roster players can be unassigned.
- Review home-to-host transfers, manually confirm actual game registration, copy the plan, or export an Excel workbook with Assignments, Legions, Availability and Alliance moves.
- Roster refreshes preserve the separate plan. Home alliance is captured when planning information is first entered; last known game alliance remains visible separately.

See `TAL_DESIGN_REVIEW.md` for concept selection, research and review evidence.

Legions support per-legion player entry: one-player suggestions or bulk pasted usernames/IDs with explicit match review. Duplicate names require selection; repeated entries are skipped. Cross-legion bulk moves require an explicit option. Manual entries with unconfirmed times require an explicit override and remain flagged in Review. Direct removal keeps the member profile and availability. The Members Help button is removed, and the alliance setup card hides once all four default alliances are present.

### UI change review

For future requested UI changes, compare three concepts, have an independent AI reviewer score ease of use, functionality, accessibility, copy and accuracy, then refine the chosen design to at least 90/100 before publishing. Validate the implemented flows; do not describe this score as Apple approval or a real-device test.

TAL suggestions prioritize availability, then saved State 3573 Labyrinth rank (lower is better) and score. The first preview fetches the Labyrinth leaderboard if no ranks are saved; manual refresh updates only returned player IDs. Discord move/stay blocks group original home alliance by TAL host and legion, with alphabetized names and primary UTC times. Top-20 markers always use recorded TAL troop power, independently of the chosen list order.

## Shared leader workspace

The current password grants full leader access to the fixed `3573-leaders` workspace. Existing signed sessions remain valid. Browser-supplied roles, workspace IDs and actors are never trusted. Password rotation invalidates signed sessions. Player access is not enabled: future credentials must bind an independently verified player identity to a stable FID and enforce field-level permissions on the server. Typing a FID alone is not proof of ownership.

On the first device holding the real roster, use **Start sharing this roster**. Creation is atomic at revision 0. Other devices open the shared roster. If they already hold a local roster, **Use shared roster** keeps that old copy as a downloadable JSON backup instead of uploading it over existing cloud data.

Visible pages check for updates every five seconds and on focus/reconnection. Edits are durably queued in a separate IndexedDB cache before network writes; roster, TAL plan, custom roles and events sync, while tutorial/haptic preferences and credentials stay local. Shared data uses canonical JSON equality, optimistic revision checks and keyed three-way merging. Same-field, deletion-versus-edit and conflicting cross-legion moves require an explicit choice. Recent revisions retain five previous snapshots for recovery. This is polling, not a WebSocket service. Offline device edits remain pending; a cloud save is acknowledged only after the server returns the stored data and revision.

`api/workspace.js` authenticates the leader session and same-origin writes, validates the State 3573 payload, and uses the existing server-only bridge token to reach `caroline3573-workspace`. The server-only Supabase tables have RLS and no anon/authenticated grants or policies; only the service role can reach their CAS RPC. No new provider key or service role key is exposed to the browser. Compressed transfer supports full profile snapshots while respecting Vercel payload limits; uncompressed workspace data is capped at 24 MiB and oversized saves stay on the device with an explicit error.

Schema source: `supabase/schema/caroline_shared_workspace.sql`. It is applied as the `caroline_shared_workspace` migration through the connected database tool. The local CLI was unavailable in this environment. Keep the Edge Function copy of `shared/workspace.js` identical to the site version.
