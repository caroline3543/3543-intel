-- Runs only in the ephemeral CI PostgreSQL database.
begin;
insert into public.caroline_workspaces(id,revision,data)
values ('3573-leaders',0,'{"players":[{"fid":"12345678","username":"Test Player","allianceTag":"ARC","alias":"Preserve this","manualNotes":"Do not erase"}]}'::jsonb);
insert into membership_3573.refresh_jobs(job_key,job_kind,fid,priority,due_at)
values ('player:12345678','player_verify','12345678',10,now()-interval '1 minute');
do $$
declare
 j membership_3573.refresh_jobs;
 result record;
 p jsonb;
begin
 select * into j from membership_3573.lease_next_job(now(),600);
 if j.id is null or j.fid <> '12345678' or j.lease_token is null then
   raise exception 'Player job not leased';
 end if;
 select * into result from membership_3573.commit_verified_location(
   '12345678','3600','XYZ',now()-interval '5 minutes',now(),
   'whiteoutstats-player',0,j.id,j.lease_token);
 if result.applied is distinct from true or result.outcome <> 'state_transfer' then
   raise exception 'Verified transfer-out not applied';
 end if;
 select data->'players'->0 into p from public.caroline_workspaces where id='3573-leaders';
 if p->>'membershipStatus' <> 'transferred_out'
    or p->>'lastKnownAlliance' <> 'ARC'
    or p->>'manualNotes' <> 'Do not erase'
    or p->>'alias' <> 'Preserve this' then
   raise exception 'Transfer-out did not preserve manual fields or alliance';
 end if;
 if (select count(*) from membership_3573.transfer_events) <> 1 then
   raise exception 'Transfer ledger should contain one outbound event';
 end if;
 select * into result from membership_3573.commit_verified_location(
   '12345678','3600','XYZ',now()-interval '5 minutes',now(),
   'whiteoutstats-player',0,j.id,j.lease_token);
 if result.outcome <> 'revision_conflict' then
   raise exception 'Stale revision should be rejected';
 end if;
 if membership_3573.finish_job(j.id,j.lease_token,now(),now()+interval '12 hours') is distinct from true then
   raise exception 'Job completion failed';
 end if;
 if (select count(*) from membership_3573.transfer_events) <> 1 then
   raise exception 'Revision conflict duplicated ledger event';
 end if;
end $$;
rollback;
