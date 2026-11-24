-- DRAFT: apply only after auth review. Existing tables are untouched.
-- OAuth start requests use the authenticated user's JWT, but state/token operations
-- are performed exclusively from a privileged Edge Function.
create table if not exists public.spreadsheet_oauth_states (
  state_hash text primary key check (length(state_hash)=64),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists spreadsheet_oauth_states_expires_idx on public.spreadsheet_oauth_states(expires_at);
create table if not exists public.spreadsheet_google_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_encrypted text not null,
  updated_at timestamptz not null default now()
);
alter table public.spreadsheet_oauth_states enable row level security;
alter table public.spreadsheet_google_credentials enable row level security;
-- No user-facing SELECT/INSERT/UPDATE/DELETE policy. The service role is the
-- only intended accessor; never grant an anonymous browser role access.
revoke all on public.spreadsheet_oauth_states from anon, authenticated;
revoke all on public.spreadsheet_google_credentials from anon, authenticated;
-- Periodic cleanup (server-only): DELETE FROM public.spreadsheet_oauth_states WHERE expires_at < now();
-- Token rotation, key versioning, decryption and disconnection must be implemented
-- before turning on scheduled spreadsheet sync.
