-- STAGED ONLY. Atomic snapshot persistence, no membership inference from absence.
-- All roster members must be verified independently before a state transfer.
create or replace function membership_3573.commit_roster_snapshot(
 p_job_id bigint,p_lease_token uuid,p_alliance_tag text,
 p_members jsonb,p_observed_at timestamptz,p_detected_at timestamptz
) returns integer language plpgsql security invoker set search_path=''
as $$
declare
 v_member jsonb;
 v_ids jsonb;
 v_count integer;
begin
 if p_alliance_tag is null or p_alliance_tag !~ '^[A-Za-z0-9_]{2,12}$'
    or p_members is null or jsonb_typeof(p_members)<>'array'
    or p_observed_at is null or p_detected_at is null
    or p_observed_at > p_detected_at+interval '5 minutes'
    or p_observed_at < p_detected_at-interval '72 hours'
 then raise exception 'Incomplete or stale roster'; end if;
 if not exists(
   select 1 from membership_3573.refresh_jobs
   where id=p_job_id and lease_token=p_lease_token
     and status='leased' and lease_until>=p_detected_at
     and job_kind='alliance_roster' and alliance_tag=p_alliance_tag
   for update
 ) then raise exception 'Missing or expired roster lease'; end if;
 if exists(
   select 1 from jsonb_array_elements(p_members) m
   where jsonb_typeof(m)<>'object'
      or coalesce(m->>'fid','') !~ '^[1-9][0-9]{3,14}$'
 ) then raise exception 'Invalid roster member FID'; end if;
 select count(*),jsonb_agg(fid order by fid)
 into v_count,v_ids
 from (select distinct m->>'fid' fid from jsonb_array_elements(p_members) m) ids;
 if v_count<>jsonb_array_length(p_members) then
   raise exception 'Duplicate roster FID';
 end if;
 insert into membership_3573.roster_snapshots
   (alliance_tag,member_ids,provider_observed_at,fetched_at,is_complete,updated_at)
 values(p_alliance_tag,coalesce(v_ids,'[]'::jsonb),p_observed_at,p_detected_at,true,p_detected_at)
 on conflict(alliance_tag) do update
 set member_ids=excluded.member_ids,
     provider_observed_at=excluded.provider_observed_at,
     fetched_at=excluded.fetched_at,is_complete=true,updated_at=excluded.updated_at
 where membership_3573.roster_snapshots.provider_observed_at is null
    or membership_3573.roster_snapshots.provider_observed_at<=excluded.provider_observed_at;
 -- New roster discoveries are handled by a separate verification queue.
 -- A roster alone is not evidence of prior state or transfer direction.
 return v_count;
end $$;
revoke all on function membership_3573.commit_roster_snapshot(bigint,uuid,text,jsonb,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function membership_3573.commit_roster_snapshot(bigint,uuid,text,jsonb,timestamptz,timestamptz) to service_role;
