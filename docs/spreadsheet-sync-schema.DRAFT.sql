-- DRAFT ONLY: never applied automatically. Requires auth and RLS policy review.
-- Additive schema for the Sheets sync worker. Existing players remains untouched.
create table if not exists public.spreadsheet_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  state_id text not null,
  spreadsheet_id text not null,
  title text not null default '',
  status text not null default 'pending' check (status in ('pending','active','paused','error')),
  google_credential_reference text, -- reference to separately encrypted server-side secret, never an OAuth token
  last_polled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_user_id, spreadsheet_id, state_id)
);
create table if not exists public.spreadsheet_mappings (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.spreadsheet_connections(id) on delete cascade,
  worksheet_id bigint not null,
  worksheet_title text not null,
  header_row integer not null default 1 check (header_row > 0),
  key_column text not null default 'record_id',
  field_mapping jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  unique(connection_id, worksheet_id)
);
create table if not exists public.spreadsheet_cell_snapshots (
  mapping_id uuid not null references public.spreadsheet_mappings(id) on delete cascade,
  record_id text not null,
  field_key text not null,
  last_synced_value jsonb,
  updated_at timestamptz not null default now(),
  primary key(mapping_id, record_id, field_key)
);
create table if not exists public.spreadsheet_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.spreadsheet_connections(id) on delete cascade,
  mapping_id uuid references public.spreadsheet_mappings(id) on delete cascade,
  idempotency_key text not null unique,
  direction text not null check (direction in ('sheet_to_db','db_to_sheet','reconcile')),
  status text not null default 'pending' check (status in ('pending','running','completed','failed','conflict')),
  attempts integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists spreadsheet_sync_jobs_pending_idx
  on public.spreadsheet_sync_jobs (created_at) where status in ('pending','failed');
create table if not exists public.spreadsheet_sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  mapping_id uuid not null references public.spreadsheet_mappings(id) on delete cascade,
  record_id text not null,
  field_key text not null,
  baseline_value jsonb,
  database_value jsonb,
  sheet_value jsonb,
  status text not null default 'open' check(status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.spreadsheet_connections enable row level security;
alter table public.spreadsheet_mappings enable row level security;
alter table public.spreadsheet_cell_snapshots enable row level security;
alter table public.spreadsheet_sync_jobs enable row level security;
alter table public.spreadsheet_sync_conflicts enable row level security;
-- Deliberately no client RLS policies: service-only until auth permissions are designed and tested.
-- Before applying: confirm whether an auth scheme for app users already exists,
-- investigate existing public.players policy, implement audited read/write operations,
-- encrypt Google OAuth refresh tokens in a dedicated server-only secret store.
