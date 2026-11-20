-- Isolated CI-only roster transaction tests. Never runs on production.
begin;
insert into membership_3573.refresh_jobs(job_key,job_kind,alliance_tag,priority,due_at)
values ('roster:ARC','alliance_roster','ARC',5,now()-interval '1 minute');
do $$
declare
 j membership_3573.refresh_jobs;
 n integer;
 ids jsonb;
begin
 select * into j from membership_3573.lease_next_job(now(),600);
 if j.job_kind <> 'alliance_roster' or j.alliance_tag <> 'ARC' then
   raise exception 'Roster lease missing';
 end if;
 select membership_3573.commit_roster_snapshot(
  j.id,j.lease_token,'ARC',
  '[{"fid":"12345678"},{"fid":"23456789"}]'::jsonb,
  now()-interval '2 minutes',now()) into n;
 if n<>2 then raise exception 'Expected two roster members'; end if;
 select member_ids into ids from membership_3573.roster_snapshots where alliance_tag='ARC';
 if ids <> '["12345678","23456789"]'::jsonb then
   raise exception 'Roster snapshot members mismatch';
 end if;
 begin
  perform membership_3573.commit_roster_snapshot(
   j.id,j.lease_token,'ARC','[{"fid":"12345678"},{"fid":"12345678"}]'::jsonb,
   now(),now());
  raise exception 'Duplicate roster unexpectedly accepted';
 exception when others then
  if sqlerrm='Duplicate roster unexpectedly accepted' then raise; end if;
 end;
 begin
  perform membership_3573.commit_roster_snapshot(
   j.id,j.lease_token,'ARC','[{"fid":"not-a-fid"}]'::jsonb,
   now(),now());
  raise exception 'Invalid FID unexpectedly accepted';
 exception when others then
  if sqlerrm='Invalid FID unexpectedly accepted' then raise; end if;
 end;
 begin
  perform membership_3573.commit_roster_snapshot(
   j.id,j.lease_token,'HOT','[]'::jsonb,now(),now());
  raise exception 'Mismatched alliance lease unexpectedly accepted';
 exception when others then
  if sqlerrm='Mismatched alliance lease unexpectedly accepted' then raise; end if;
 end;
 if (select count(*) from membership_3573.transfer_events)<>0 then
   raise exception 'Roster snapshot incorrectly created transfer event';
 end if;
 if membership_3573.finish_job(j.id,j.lease_token,now(),now()+interval '12 hours') is distinct from true then
   raise exception 'Roster job completion failed';
 end if;
end $$;
rollback;
