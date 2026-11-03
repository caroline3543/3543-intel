-- Applied to Supabase as migration 20261103053759.
-- Read-only review history. Deliberately does NOT grant approval or Google write access.
create table if not exists public.spreadsheet_export_reviews (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 state_id text not null check (state_id ~ '^[1-9][0-9]{0,4}$'),
 spreadsheet_id text not null,
 worksheet_title text not null,
 review_hash text not null check (review_hash ~ '^[a-f0-9]{64}$'),
 payload jsonb not null,
 status text not null default 'reviewed_read_only' check (status='reviewed_read_only'),
 checked_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(owner_user_id,review_hash)
);
create index if not exists spreadsheet_export_reviews_state_idx
 on public.spreadsheet_export_reviews(owner_user_id,state_id,created_at desc);
alter table public.spreadsheet_export_reviews enable row level security;
revoke all on public.spreadsheet_export_reviews from anon,authenticated;
grant select on public.spreadsheet_export_reviews to authenticated;
create policy "owner can view recorded export reviews"
 on public.spreadsheet_export_reviews for select to authenticated
 using ((select auth.uid())=owner_user_id);
