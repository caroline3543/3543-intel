-- Isolated CI-only test: explicit verified empty alliance is not a state transfer.
begin;
insert into public.caroline_workspaces(id,revision,data)
values ('3573-leaders',0,'{"players":[{"fid":"34567890","username":"No Alliance Test","allianceTag":"RKG","manualNotes":"Keep this note"}]}'::jsonb);
insert into membership_3573.refresh_jobs(job_key,job_kind,fid,priority,due_at)
values ('player:34567890','player_verify','34567890',10,now()-interval '1 minute');
do $$
declare
 j membership_3573.refresh_jobs;
 result record;
 p jsonb;
begin
 select * into j from membership_3573.lease_next_job(now(),600);
 if j.fid <> '34567890' then raise exception 'Expected player verification lease'; end if;
 select * into result from membership_3573.commit_verified_location(
   '34567890','3573','',now()-interval '2 minutes',now(),
   'whiteoutstats-player',0,j.id,j.lease_token);
 if result.applied is distinct from true or result.outcome <> 'alliance_change' then
   raise exception 'Verified empty alliance not applied as alliance change';
 end if;
 select data->'players'->0 into p from public.caroline_workspaces where id='3573-leaders';
 if p->>'allianceTag' <> '' or p->>'membershipStatus' <> 'active'
   or p->>'manualNotes' <> 'Keep this note' then
   raise exception 'No Alliance state incorrect or manual data overwritten';
 end if;
 if (select count(*) from membership_3573.transfer_events) <> 0 then
   raise exception 'No Alliance incorrectly counted as interstate transfer';
 end if;
 if membership_3573.finish_job(j.id,j.lease_token,now(),now()+interval '24 hours') is distinct from true then
   raise exception 'No Alliance verification job completion failed';
 end if;
end $$;
rollback;
