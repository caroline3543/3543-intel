-- Run only against an isolated database. All fixtures roll back.
begin;
insert into public.caroline_workspaces(id,revision,data)
values ('3573-leaders',0,jsonb_build_object('players',jsonb_build_array(
  jsonb_build_object('fid','410001','allianceTag','ARC','notes','keep',
    'membershipLastSuccessfulAt',extract(epoch from now()-interval '8 days'),'allianceHistory',null),
  '{"fid":"410002","allianceTag":""}'::jsonb,
  '{"fid":"410003","allianceTag":"HOT"}'::jsonb,
  '{"fid":"410004","allianceTag":"RKG"}'::jsonb,
  '{"fid":"410005","allianceTag":"FARM","membershipStatus":"transferred_out","transferDestinationState":"3556","transferDestinationAlliance":"FBR"}'::jsonb,
  '{"fid":"410006","allianceTag":"LUN"}'::jsonb,
  '{"fid":"410006","allianceTag":"WAR"}'::jsonb,
  '{"fid":"bad","allianceTag":"HOT"}'::jsonb
)));
do $$
declare
  first_run jsonb;
  report jsonb;
  jobs membership_3573.refresh_jobs[];
  job membership_3573.refresh_jobs;
  old_job membership_3573.refresh_jobs;
  request_id uuid;
  result text;
  roster jsonb;
  observed timestamptz:=now()-interval '1 minute';
begin
  if has_function_privilege('anon','public.caroline_3573_manual_refresh(boolean)','EXECUTE')
    or has_function_privilege('authenticated','public.caroline_3573_manual_refresh(boolean)','EXECUTE')
    or not has_function_privilege('service_role','public.caroline_3573_manual_refresh(boolean)','EXECUTE') then
    raise exception 'Manual controls grant mismatch';
  end if;
  first_run:=public.caroline_3573_manual_refresh(true);
  if first_run->>'queued'<>'5' or first_run->>'invalidFids'<>'1' or first_run->>'duplicateProfiles'<>'2' then
    raise exception 'Queue must cover unique valid FIDs and expose skipped rows: %',first_run;
  end if;
  if public.caroline_3573_manual_refresh(true)->>'id'<>first_run->>'id' then raise exception 'Concurrent start must reuse the run'; end if;
  if (select count(id) from membership_3573.lease_next_job(now(),600))<>0 then raise exception 'Scheduled worker stole a manual job'; end if;
  select array_agg(j order by fid) into jobs from membership_3573.lease_manual_refresh(20) j;
  if cardinality(jobs)<>5 or exists(select 1 from membership_3573.lease_manual_refresh(20)) then
    raise exception 'Manual leases must be exclusive';
  end if;
  request_id:=membership_3573.begin_manual_request(jobs[1].manual_run_id,array(select j.lease_token from unnest(jobs) j));
  update membership_3573.manual_refresh_requests set http_status=200 where id=request_id;
  result:=membership_3573.end_manual_item(jobs[1].id,jobs[1].lease_token,'verified',true,true,null,'3573','FARM',observed);
  if result<>'alliance_change' then raise exception 'Unix timestamp or membership commit failed: %',result; end if;
  result:=membership_3573.end_manual_item(jobs[2].id,jobs[2].lease_token,'verified',true,true,null,'3573','',observed);
  if result<>'verified_unchanged' then raise exception 'Explicit No Alliance must be verified'; end if;
  perform membership_3573.end_manual_item(jobs[3].id,jobs[3].lease_token,'missing_membership',true,false,null,null,null,null);
  perform membership_3573.end_manual_item(jobs[4].id,jobs[4].lease_token,'verified',true,true,null,'3556','FBR',observed);
  old_job:=jobs[5];
  update membership_3573.refresh_jobs set lease_until=now()-interval '1 second' where id=old_job.id;
  select * into job from membership_3573.lease_manual_refresh(20);
  if job.id<>old_job.id or job.lease_token=old_job.lease_token then raise exception 'Interrupted job must be reclaimed'; end if;
  if membership_3573.end_manual_item(old_job.id,old_job.lease_token,'verified',true,true,null,'3573','WAR',observed)<>'lease_lost' then
    raise exception 'Expired worker wrote after lease was reclaimed';
  end if;
  request_id:=membership_3573.begin_manual_request(job.manual_run_id,array[job.lease_token]);
  update membership_3573.manual_refresh_requests set http_status=200 where id=request_id;
  perform membership_3573.end_manual_item(job.id,job.lease_token,'verified',true,true,null,'3573','WAR',observed);
  report:=public.caroline_3573_manual_refresh(false);
  if report->>'finished'<>'5' or report->>'persisted'<>'4' or report->>'updated'<>'3' or report->>'unchanged'<>'1'
    or report->>'missing'<>'1' or report->>'failed'<>'0' or report->>'requestsAttempted'<>'2'
    or report->>'playerAttempts'<>'6' or report->>'validPlayers'<>'5' or report->>'validMembership'<>'4'
    or report->>'completedAt' is null then raise exception 'Unexpected refresh evidence: %',report; end if;
  if public.caroline_3573_manual_refresh(true)->>'id'<>first_run->>'id' then raise exception 'Cooldown rejected'; end if;
  select data->'players' into roster from public.caroline_workspaces where id='3573-leaders';
  if roster->0->>'allianceTag'<>'FARM' or roster->0->>'notes'<>'keep'
    or roster->0->'allianceHistory'->0->>'from'<>'ARC'
    or roster->0->>'membershipPersistedAt' is null
    or roster->1->>'allianceTag'<>''
    or roster->2->>'allianceTag'<>'HOT' or (roster->2 ? 'membershipLastSuccessfulAt')
    or roster->3->>'membershipStatus'<>'transferred_out' or roster->4->>'allianceTag'<>'WAR' then
    raise exception 'Unexpected persisted roster';
  end if;
  if (select count(*) from membership_3573.transfer_events)<>2
    or not exists(select 1 from membership_3573.transfer_events where direction='in' and from_alliance='FBR') then
    raise exception 'Transfer events lost or incorrect';
  end if;
end $$;

-- Simulate an actual PostgreSQL failure after the provider has verified a record.
create function pg_temp.reject_membership_write() returns trigger language plpgsql as $$
begin
  raise exception 'Simulated workspace write error';
end $$;
create trigger reject_fixture_write before update on public.caroline_workspaces
for each row execute function pg_temp.reject_membership_write();
do $$
declare
  job membership_3573.refresh_jobs;
  prior_revision bigint;
begin
  update membership_3573.manual_refresh_runs set completed_at=now()-interval '1 hour';
  perform public.caroline_3573_manual_refresh(true);
  select * into job from membership_3573.lease_manual_refresh(1);
  select revision into prior_revision from public.caroline_workspaces where id='3573-leaders';
  begin
    perform membership_3573.end_manual_item(job.id,job.lease_token,'verified',true,true,null,'3573','RKG',now());
    raise exception 'Expected simulated workspace write error';
  exception when raise_exception then
    if sqlerrm<>'Simulated workspace write error' then raise; end if;
  end;
  if (select revision from public.caroline_workspaces where id='3573-leaders')<>prior_revision
    or (select manual_persisted from membership_3573.refresh_jobs where id=job.id)
    or (select status from membership_3573.refresh_jobs where id=job.id)<>'leased' then
    raise exception 'Failed database write was counted as persisted';
  end if;
  perform membership_3573.end_manual_item(job.id,job.lease_token,'persistence_failed',true,true,60,null,null,null);
  if (select status from membership_3573.refresh_jobs where id=job.id)<>'pending' then raise exception 'Failed write not queued for retry'; end if;
end $$;
rollback;
