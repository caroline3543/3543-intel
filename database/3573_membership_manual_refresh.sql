-- Apply after the private queue functions and verified membership writer.
begin;
create table if not exists membership_3573.manual_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  last_worker_at timestamptz,
  invalid_fids integer not null,
  duplicate_profiles integer not null
);
alter table membership_3573.manual_refresh_runs add column if not exists last_worker_at timestamptz;
create unique index if not exists manual_refresh_one_active
  on membership_3573.manual_refresh_runs ((true)) where completed_at is null;
alter table membership_3573.manual_refresh_runs enable row level security;

alter table membership_3573.refresh_jobs
  add column if not exists manual_run_id uuid references membership_3573.manual_refresh_runs on delete cascade,
  add column if not exists manual_outcome text,
  add column if not exists manual_valid_player boolean not null default false,
  add column if not exists manual_valid_membership boolean not null default false,
  add column if not exists manual_persisted boolean not null default false;
create unique index if not exists manual_refresh_unique_fid
  on membership_3573.refresh_jobs(manual_run_id,fid) where manual_run_id is not null;

create table if not exists membership_3573.manual_refresh_requests (
  id uuid primary key,
  run_id uuid not null references membership_3573.manual_refresh_runs on delete cascade,
  started_at timestamptz not null default now(),
  player_attempts integer not null check (player_attempts between 1 and 20),
  http_status integer check (http_status between 100 and 599),
  transport_failed boolean not null default false
);
create index if not exists manual_refresh_requests_run on membership_3573.manual_refresh_requests(run_id);
alter table membership_3573.manual_refresh_requests enable row level security;
revoke all on membership_3573.manual_refresh_runs,membership_3573.manual_refresh_requests from public,anon,authenticated;
grant select,insert,update,delete on membership_3573.manual_refresh_runs,membership_3573.manual_refresh_requests to service_role;

create or replace function membership_3573.close_manual_refresh(p_run uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from membership_3573.manual_refresh_runs where id=p_run and completed_at is null for update;
  if found and not exists(select 1 from membership_3573.refresh_jobs where manual_run_id=p_run and status in ('pending','leased')) then
    update membership_3573.manual_refresh_runs set completed_at=clock_timestamp() where id=p_run;
  end if;
end $$;

create or replace function public.caroline_3573_manual_refresh(p_start boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_run membership_3573.manual_refresh_runs;
  v_players jsonb;
  v_invalid integer;
  v_duplicates integer;
  v_jobs jsonb;
  v_requests jsonb;
begin
  if p_start then
    perform pg_advisory_xact_lock(3573, 71);
  end if;
  select * into v_run from membership_3573.manual_refresh_runs order by created_at desc limit 1;
  if p_start and (v_run.id is null or v_run.completed_at < now()-interval '15 minutes') then
    select data->'players' into v_players from public.caroline_workspaces where id='3573-leaders';
    if jsonb_typeof(v_players) is distinct from 'array' then raise exception 'Roster unavailable'; end if;
    select count(*) filter (where coalesce(btrim(player->>'fid'),'') !~ '^[1-9][0-9]{3,14}$')
      into v_invalid from jsonb_array_elements(v_players) player;
    select coalesce(sum(n),0) into v_duplicates from (
      select count(*) n from jsonb_array_elements(v_players) player
      where btrim(player->>'fid') ~ '^[1-9][0-9]{3,14}$'
      group by btrim(player->>'fid') having count(*)>1
    ) duplicates;
    insert into membership_3573.manual_refresh_runs(invalid_fids,duplicate_profiles)
      values(v_invalid,v_duplicates) returning * into v_run;
    insert into membership_3573.refresh_jobs(job_key,job_kind,fid,priority,due_at,manual_run_id)
    select 'manual:'||v_run.id::text||':'||fid,'player_verify',fid,15,now(),v_run.id
    from (
      select btrim(player->>'fid') fid from jsonb_array_elements(v_players) player
      where btrim(player->>'fid') ~ '^[1-9][0-9]{3,14}$'
      group by 1 having count(*)=1
    ) unique_players;
    perform membership_3573.close_manual_refresh(v_run.id);
    select * into v_run from membership_3573.manual_refresh_runs where id=v_run.id;
    delete from membership_3573.manual_refresh_runs where completed_at<now()-interval '30 days';
  end if;
  if v_run.id is null then return null; end if;
  select jsonb_build_object(
    'queued',count(*),
    'finished',count(*) filter(where status in ('completed','cancelled')),
    'validPlayers',count(*) filter(where manual_valid_player),
    'validMembership',count(*) filter(where manual_valid_membership),
    'persisted',count(*) filter(where manual_persisted),
    'updated',count(*) filter(where manual_outcome in ('alliance_change','state_transfer')),
    'unchanged',count(*) filter(where manual_outcome in ('verified_unchanged','already_verified')),
    'superseded',count(*) filter(where manual_outcome='older_observation'),
    'missing',count(*) filter(where status='cancelled' and manual_outcome='missing_membership'),
    'failed',count(*) filter(where status='cancelled' and manual_outcome is distinct from 'missing_membership'),
    'waiting',count(*) filter(where status='pending' and due_at>now()),
    'workspaceRevision', (select revision from public.caroline_workspaces where id='3573-leaders')
  ) into v_jobs from membership_3573.refresh_jobs where manual_run_id=v_run.id;
  select jsonb_build_object(
    'requestsAttempted',count(*),
    'httpSucceeded',count(*) filter(where http_status between 200 and 299),
    'playerAttempts',coalesce(sum(player_attempts),0),
    'rateLimited',count(*) filter(where http_status=429),
    'transportFailed',count(*) filter(where transport_failed),
    'requestsUnconfirmed',count(*) filter(where http_status is null and not transport_failed)
  ) into v_requests from membership_3573.manual_refresh_requests where run_id=v_run.id;
  return v_jobs||v_requests||jsonb_build_object(
    'id',v_run.id,'startedAt',v_run.created_at,'completedAt',v_run.completed_at,
    'lastWorkerAt',v_run.last_worker_at,
    'lastCompletedAt',(select max(completed_at) from membership_3573.manual_refresh_runs),
    'invalidFids',v_run.invalid_fids,'duplicateProfiles',v_run.duplicate_profiles
  );
end $$;

create or replace function membership_3573.lease_manual_refresh(p_limit integer)
returns setof membership_3573.refresh_jobs language plpgsql security invoker set search_path='' as $$
declare
  v_run uuid;
begin
  select id into v_run from membership_3573.manual_refresh_runs where completed_at is null
    for update skip locked;
  if v_run is null then return; end if;
  if exists(select 1 from membership_3573.refresh_jobs where manual_run_id=v_run and status='leased' and lease_until>=now()) then
    return;
  end if;
  -- A killed worker is recoverable. A payload with five interrupted attempts
  -- is terminal and can be checked in the next refresh.
  update membership_3573.refresh_jobs set status='cancelled',manual_outcome='interrupted',lease_token=null,lease_until=null
    where id in (select id from membership_3573.refresh_jobs
      where manual_run_id=v_run and status='leased' and lease_until<now() and attempts>=5 for update skip locked);
  return query
  with candidates as (
    select id from membership_3573.refresh_jobs
    where manual_run_id=v_run and ((status='pending' and due_at<=now()) or (status='leased' and lease_until<now()))
    order by due_at,id for update skip locked limit greatest(0,least(p_limit,20))
  )
  update membership_3573.refresh_jobs j
  set status='leased',lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes',updated_at=now()
  from candidates c where c.id=j.id returning j.*;
  if not found then perform membership_3573.close_manual_refresh(v_run); end if;
end $$;

create or replace function membership_3573.begin_manual_request(p_run uuid,p_leases uuid[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare
 v_id uuid:=gen_random_uuid();
 v_count integer;
begin
 update membership_3573.refresh_jobs
 set attempts=attempts+1,updated_at=clock_timestamp()
 where manual_run_id=p_run and status='leased' and lease_until>=clock_timestamp() and lease_token=any(p_leases);
 get diagnostics v_count=row_count;
 if v_count<>cardinality(p_leases) or v_count<1 or v_count>20 then raise exception 'Invalid manual request leases'; end if;
 insert into membership_3573.manual_refresh_requests(id,run_id,player_attempts) values(v_id,p_run,v_count);
 return v_id;
end $$;

create or replace function membership_3573.end_manual_item(
 p_id bigint,p_token uuid,p_outcome text,p_player boolean,p_membership boolean,p_retry_seconds integer,
 p_state text,p_tag text,p_observed_at timestamptz
) returns text language plpgsql security invoker set search_path='' as $$
declare
 v_job membership_3573.refresh_jobs;
 v_result record;
 v_revision bigint;
 v_persisted boolean:=false;
 v_end timestamptz:=clock_timestamp();
begin
 select * into v_job from membership_3573.refresh_jobs
  where id=p_id and manual_run_id is not null and status='leased' and lease_token=p_token and lease_until>=v_end for update;
 if not found then return 'lease_lost'; end if;
 if p_outcome='verified' then
   if not (p_player and p_membership) then raise exception 'Invalid verification result'; end if;
   for attempt in 1..3 loop
     select revision into strict v_revision from public.caroline_workspaces where id='3573-leaders';
     select * into strict v_result from membership_3573.commit_verified_location(
       v_job.fid,p_state,p_tag,p_observed_at,v_end,'whiteoutstats-player',v_revision,v_job.id,p_token);
     exit when v_result.outcome<>'revision_conflict';
   end loop;
   if v_result.outcome='revision_conflict' then raise exception 'Concurrent roster update'; end if;
   v_persisted:=v_result.applied;
   p_outcome:=v_result.outcome;
 end if;
 update membership_3573.refresh_jobs
 set status=case when p_retry_seconds is not null and attempts<5 then 'pending'
                 when p_outcome in ('alliance_change','state_transfer','verified_unchanged','already_verified','older_observation') then 'completed'
                 else 'cancelled' end,
     due_at=v_end+make_interval(secs=>greatest(0,least(coalesce(p_retry_seconds,0),3600))),
     manual_outcome=p_outcome,
     manual_valid_player=manual_valid_player or p_player,
     manual_valid_membership=manual_valid_membership or p_membership,
     manual_persisted=v_persisted,
     completed_at=case when p_retry_seconds is null or attempts>=5 then v_end end,
     lease_token=null,lease_until=null,updated_at=v_end
 where id=p_id;
 perform membership_3573.close_manual_refresh(v_job.manual_run_id);
 return p_outcome;
end $$;

revoke all on function public.caroline_3573_manual_refresh(boolean) from public,anon,authenticated;
grant execute on function public.caroline_3573_manual_refresh(boolean) to service_role;
revoke all on function membership_3573.close_manual_refresh(uuid),membership_3573.lease_manual_refresh(integer),
 membership_3573.begin_manual_request(uuid,uuid[]),
 membership_3573.end_manual_item(bigint,uuid,text,boolean,boolean,integer,text,text,timestamptz) from public,anon,authenticated;
grant execute on function membership_3573.close_manual_refresh(uuid),membership_3573.lease_manual_refresh(integer),
 membership_3573.begin_manual_request(uuid,uuid[]),
 membership_3573.end_manual_item(bigint,uuid,text,boolean,boolean,integer,text,text,timestamptz) to service_role;
commit;
