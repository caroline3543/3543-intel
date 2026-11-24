-- Approval is audit-only. No Google write capability is granted.
create table if not exists public.spreadsheet_export_approvals (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.spreadsheet_export_reviews(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  state_id text not null check (state_id ~ '^[1-9][0-9]{0,4}$'),
  review_hash text not null check (review_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'approved_not_executed' check (status = 'approved_not_executed'),
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  unique(review_id)
);
create index if not exists spreadsheet_export_approvals_owner_state_idx
 on public.spreadsheet_export_approvals(owner_user_id,state_id,approved_at desc);
alter table public.spreadsheet_export_approvals enable row level security;
revoke all on public.spreadsheet_export_approvals from anon,authenticated;
grant select on public.spreadsheet_export_approvals to authenticated;
create policy "owner can view export approvals" on public.spreadsheet_export_approvals
 for select to authenticated using ((select auth.uid()) = owner_user_id);
