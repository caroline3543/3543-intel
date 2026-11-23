-- Per-organiser profile layout. This is deliberately separate from shared roster data.
-- Apply through reviewed Supabase migration before enabling account sync.
create table if not exists public.organiser_profile_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  section_order jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint profile_section_order_is_array check (jsonb_typeof(section_order) = 'array')
);
alter table public.organiser_profile_preferences enable row level security;
revoke all on public.organiser_profile_preferences from anon;
grant select, insert, update, delete on public.organiser_profile_preferences to authenticated;
drop policy if exists organiser_profile_preferences_select on public.organiser_profile_preferences;
create policy organiser_profile_preferences_select on public.organiser_profile_preferences
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists organiser_profile_preferences_insert on public.organiser_profile_preferences;
create policy organiser_profile_preferences_insert on public.organiser_profile_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists organiser_profile_preferences_update on public.organiser_profile_preferences;
create policy organiser_profile_preferences_update on public.organiser_profile_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists organiser_profile_preferences_delete on public.organiser_profile_preferences;
create policy organiser_profile_preferences_delete on public.organiser_profile_preferences
  for delete to authenticated using (user_id = (select auth.uid()));
