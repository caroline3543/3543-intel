\set ON_ERROR_STOP on
create role authenticated nologin;
create role anon nologin;
create table public.players (
 state_id text not null,
 id text not null,
 alliance_tag text,
 data jsonb not null,
 updated_at timestamptz not null,
 primary key (state_id,id)
);
alter table public.players enable row level security;
grant usage on schema public to authenticated,anon;
grant select,update on public.players to authenticated;
create policy player_select on public.players for select to authenticated
 using (current_setting('app.organiser',true)='allowed' and state_id='3573');
create policy player_update on public.players for update to authenticated
 using (current_setting('app.organiser',true)='allowed' and state_id='3573')
 with check (current_setting('app.organiser',true)='allowed' and state_id='3573');
insert into public.players values
 ('3573','123','HOT','{"id":"123","allianceTag":"HOT","notes":"original","cityPower":100}', '2026-11-23T10:00:00Z'),
 ('3543','456','HOT','{"id":"456","allianceTag":"HOT","notes":"original"}', '2026-11-23T10:00:00Z');
\ir ../../database/3573_player_profile_compare_and_swap.sql
do $$
begin
 if has_function_privilege('anon','public.update_player_if_unchanged(text,text,timestamptz,text,jsonb)','EXECUTE') then
  raise exception 'Anonymous role must not execute guarded save';
 end if;
end $$;
set role authenticated;
select set_config('app.organiser','allowed',false);
do $$
declare
 v_initial timestamptz;
 v_saved text;
 v_version timestamptz;
 v_stale text;
 v_tamper text;
 v_other text;
begin
 select updated_at into v_initial from public.players where state_id='3573' and id='123';
 select status,server_updated_at into v_saved,v_version from public.update_player_if_unchanged(
  '3573','123',v_initial,'HOT',
  '{"id":"123","allianceTag":"HOT","notes":"first editor","cityPower":100}'::jsonb
 );
 if v_saved <> 'saved' or v_version <= v_initial then raise exception 'First save did not commit';end if;
 select status into v_stale from public.update_player_if_unchanged(
  '3573','123',v_initial,'HOT',
  '{"id":"123","allianceTag":"HOT","notes":"stale editor","cityPower":100}'::jsonb
 );
 if v_stale <> 'not_saved' then raise exception 'Stale editor overwrote saved notes';end if;
 select status into v_tamper from public.update_player_if_unchanged(
  '3573','123',v_version,'HOT',
  '{"id":"123","allianceTag":"HOT","notes":"tampered","cityPower":999}'::jsonb
 );
 if v_tamper <> 'not_saved' then raise exception 'Non-allowlisted field changed';end if;
 if (select data->>'notes' from public.players where state_id='3573' and id='123') <> 'first editor'
 then raise exception 'Saved notes were overwritten';end if;
end $$;
select set_config('app.organiser','denied',false);
do $$
declare v_status text;
begin
 select status into v_status from public.update_player_if_unchanged(
  '3573','123',(select '2026-11-23T10:00:00Z'::timestamptz),'HOT',
  '{"id":"123","allianceTag":"HOT","notes":"unauthorised","cityPower":100}'::jsonb
 );
 if v_status <> 'not_saved' then raise exception 'RLS denied edit succeeded';end if;
end $$;
-- The function must reject every state other than 3573, even with an otherwise valid row.
do $
declare v_rejected boolean := false;
begin
 begin
  perform public.update_player_if_unchanged(
   '3543','456','2026-11-23T10:00:00Z'::timestamptz,'HOT',
   '{"id":"456","allianceTag":"HOT","notes":"cross-state"}'::jsonb
  );
 exception when sqlstate '22023' then v_rejected := true;
 end;
 if not v_rejected then raise exception 'Other-state update was not rejected';end if;
end $;
reset role;
do $
begin
 if (select data->>'notes' from public.players where state_id='3543' and id='456') <> 'original'
 then raise exception 'Other state modified';end if;
end $$;
