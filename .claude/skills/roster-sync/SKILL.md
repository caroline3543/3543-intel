---
name: roster-sync
description: Change how roster (player) data flows between localStorage, Supabase cloud sync, provider imports (MightPulse/WhiteoutStats), state workspaces, the Hive planner bridge, Foundry/Events participants and XLSX/JSON import-export. Use for any data-ownership, merge or sync bug.
---

# Roster synchronisation

## Data ownership (single writer per field)
| Data | Owner | Persisted in |
|---|---|---|
| Roster, events, plans, settings, notices, ASCII art | `useAppState` → `exportImportService.saveToStorage` | `svs_rally_data:state:<id>` (per state workspace) |
| State workspace registry | `stateWorkspaceService` | `svs_state_workspaces_v1` |
| Cloud copy of players + svs_plans | `cloudSyncService` → `scopedCloudService` | Supabase `players`, `svs_plans` (PK state_id,id) |
| Provider stats / profile / location observation | `playerDetailsService`, `providerProfileService`, `hiveLocationFetchService` | `player.providerDetails`, `player.providerStats.locationObservation` |
| Hive plan (slots, locks, attendance, notes) | Hive planner `commit()` | `bear-hive-intel:state:<s>:alliance:<tag>` |
| Live Rally Room | `useLiveBattleRoom` / `rallyRoomHelpers` | `svs_live_rally_room_v2` (never in `useAppState`) |
| Battle pool, field registry options, arena results | their hooks/services | `svs_battle_pool_v1`, `svs_field_registry_*`, arena results key |

## Merge rules already enforced by tests — keep them
- Match by chief ID (`fid`); exact names; reject UID-only, wrong-state or conflicting IDs atomically (`playerDetails.test.js`).
- Provider updates change supplied stats only; identity and manual setups are preserved.
- Location observations replace only with equal/newer dated, paired, in-bounds coordinates.
- Hive bridge: additive; never deletes missing members; preserves slots/locks/notes/attendance; duplicate/unknown chief IDs excluded.
- Cloud: every read/write/delete scoped to the captured `state_id`; colliding IDs across states never mix.
- Alliance imports into the same state never replace other alliances.

## Before changing sync
1. Write down: source of truth, conflict rule, what happens offline, what happens on partial failure, how the user recovers (backup/export).
2. Add a `node:test` with synthetic players and a fake Supabase client covering the above.
3. Never silently drop data. If something can't be merged, surface it (toast + list) and keep the original.
4. Storage-key changes need a migration in `stateWorkspaceService`/`exportImportService` that preserves existing data, plus a registry update in `CLAUDE.md`.

## Known gaps (roadmap)
- Pull merges per player by `profileLastUpdated` (`mergeImportedData` → `mergePlayer`), but **push** upserts the whole JSON blob unconditionally, so the cloud row is last-writer-wins: an officer with a stale copy who saves overwrites a newer cloud row.
- Push is fire-and-forget with no retry/outbox; offline edits don't reach the cloud until re-saved.
- Events, notices and Hive plans aren't cloud-synced at all — a second officer's phone won't see them.
