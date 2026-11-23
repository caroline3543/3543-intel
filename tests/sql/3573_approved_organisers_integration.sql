\set ON_ERROR_STOP on
-- Disposable PostgreSQL fixture; simulates Supabase auth.uid() using session GUC.
-- PostgreSQL roles are cluster-wide and already created by the preceding fixture.
-- The organiser fixture runs in a separate database in the same CI service.
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table public.players (
 state_id text not null,id text not null,alliance_tag text,
 data jsonb not null,updated_at timestamptz not null,
 primary key(state_id,id)
);
alter table public.players enable row level security;
grant usage on schema public to authenticated,anon;
-- Deliberately no direct player read or write privileges for organiser role.
insert into auth.users values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003');
insert into public.players values
 ('3573','123','HOT','{"id":"123","notes":"original","cityPower":100}', '2026-11-23T10:00:00Z'),
 ('3543','456','HOT','{"id":"456","notes":"other state"}','2026-11-23T10:00:00Z');
\ir ../../database/3573_approved_organisers_review_only.sql
\ir ../../database/3573_approved_profile_rpc_review_only.sql
insert into app_private.state3573_profile_editors(user_id,approved_by)
 values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
do $$
begin
 if has_function_privilege('anon','public.read_3573_profile_for_edit(text)','EXECUTE')
 or has_function_privilege('anon','public.update_3573_profile_fields(text,timestamptz,text,jsonb)','EXECUTE')
 then raise exception 'Anonymous RPC access granted';end if;
 if has_table_privilege('authenticated','public.players','UPDATE')
 or has_table_privilege('authenticated','public.players','SELECT')
 then raise exception 'Organiser must not bypass guarded RPC with direct table access';end if;
 if has_table_privilege('authenticated','app_private.state3573_profile_editors','SELECT')
 then raise exception 'Private allowlist exposed';end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$
declare v_before timestamptz;v_after timestamptz;v_status text;v_note text;
begin
 select updated_at into v_before from public.read_3573_profile_for_edit('123');
 if v_before is null then raise exception 'Approved organiser cannot read';end if;
 select status,server_updated_at into v_status,v_after from public.update_3573_profile_fields(
 '123',v_before,'HOT','{"notes":"approved"}'::jsonb);
 if v_status<>'saved' or v_after<=v_before then raise exception 'Approved organiser save failed';end if;
 select status into v_status from public.update_3573_profile_fields(
 '123',v_before,'HOT','{"notes":"stale"}'::jsonb);
 if v_status<>'not_saved' then raise exception 'Stale save succeeded';end if;
 select status into v_status from public.update_3573_profile_fields(
 '123',v_after,'WRONG','{"notes":"wrong alliance"}'::jsonb);
 if v_status<>'not_saved' then raise exception 'Wrong alliance save succeeded';end if;
 begin
  perform public.update_3573_profile_fields('123',v_after,'HOT','{"cityPower":999}'::jsonb);
  raise exception 'Forbidden field was accepted';
 exception when sqlstate '22023' then null;end;
 begin
  perform public.update_3573_profile_fields('123',v_after,'HOT','{}'::jsonb);
  raise exception 'Empty patch was accepted';
 exception when sqlstate '22023' then null;end;
 if exists(select 1 from public.read_3573_profile_for_edit('456'))
 then raise exception 'Cross-state read succeeded';end if;
 select status into v_status from public.update_3573_profile_fields(
 '456',v_before,'HOT','{"notes":"tamper"}'::jsonb);
 if v_status<>'not_saved' then raise exception 'Cross-state update succeeded';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$
declare denied boolean:=false;
begin
 begin perform public.read_3573_profile_for_edit('123');
 exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Unapproved organiser could read';end if;
 denied:=false;
 begin perform public.update_3573_profile_fields(
 '123','2026-11-23T10:00:00Z'::timestamptz,'HOT','{"notes":"denied"}'::jsonb);
 exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Unapproved organiser could save';end if;
end $$;
reset role;
update app_private.state3573_profile_editors
set revoked_at=clock_timestamp()
where user_id='00000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$
declare denied boolean:=false;
begin
 begin perform public.read_3573_profile_for_edit('123');
 exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Revoked organiser could read';end if;
 denied:=false;
 begin perform public.update_3573_profile_fields(
 '123','2026-11-23T10:00:00Z'::timestamptz,'HOT','{"notes":"revoked"}'::jsonb);
 exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Revoked organiser could save';end if;
end $$;
reset role;
do $$
begin
 if (select data->>'notes' from public.players where state_id='3573' and id='123')<>'approved'
 or (select (data->>'cityPower')::integer from public.players where state_id='3573' and id='123')<>100
 or (select data->>'notes' from public.players where state_id='3543' and id='456')<>'other state'
 then raise exception 'Protected player data changed unexpectedly';end if;
end $$;
