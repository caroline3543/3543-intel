# MightPulse integration: secured foundation

Status: **Not deployed and not connected to live data**. This branch adds an Edge
Function and read-only frontend service; no existing player records are changed.

## Preconditions
1. Store `MIGHTPULSE_API_KEY` in Supabase Edge Function secrets (user reports done).
2. Configure `MIGHTPULSE_ALLOWED_ORIGINS` with exact production site origin(s)
   e.g. `https://your-site.example`; no wildcard.
3. Configure `MIGHTPULSE_ALLOWED_USER_IDS` with comma-separated Supabase Auth
   user UUIDs permitted to use the provider. The current app does not yet have
   a sign-in UI, so implement/enable officer authentication before use.
4. Ensure Supabase database RLS prohibits unauthorized reading/writing of notes,
   players, and internal plans. Do not rely on a public anon key for access control.
5. Deploy `supabase/functions/mightpulse` with JWT verification enabled.

## Routes
All calls are POST to the `mightpulse` Edge Function using a signed-in Supabase
access token; response has `{source,retrieved_at,data}`.
- `{ "action": "usage" }`
- `{ "action": "alliance", "state": 3573, "tag": "LUN" }`
- `{ "action": "kingdom", "state": 3573 }`
- `{ "action": "player", "fid": "596099868" }`

The provider's documented auth header is `Authorization: Bearer <key>`.
Read: https://api.mightpulse.com/

## Import safeguards
The current `players[].id` is an internal identifier used by event and battle
relationships; `players[].fid` is the actual game ID. Do not overwrite internal
IDs. Imported values should remain separate from user-maintained data, with
provider timestamps and manual review before applying changes. Do not overwrite:
`joinerHeroes`, `eventHistory`, `notes`, `roles`, `leaderProfile`,
`availableTroops`, `marchCapacity` or any existing event/battle relationships.
Never infer live player activity from MightPulse `online` or `last_active_at`.

## Next steps
- Add officer sign-in and Supabase RLS audit.
- Deploy function, perform authenticated usage test.
- Fetch State 3573 / LUN and show a non-destructive preview.
- Add approval-based merge by FID and separate history tables.
- Cache results server-side and throttle calls to remain below provider quotas.

The function is intentionally gated until officers are configured.
