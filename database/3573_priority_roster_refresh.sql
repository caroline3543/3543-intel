begin;

create or replace function public.caroline_3573_commit_priority_refresh(
  p_revision bigint,p_workspace jsonb,p_missing text[],p_actor text
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_commit jsonb;
  v_run uuid;
  v_queued integer:=0;
begin
  -- Serialize creation of verification runs with the existing manual refresh.
  perform pg_advisory_xact_lock(3573,71);
  v_commit:=public.caroline_workspace_commit(p_revision,p_workspace,p_actor);
  if coalesce((v_commit->>'conflict')::boolean,false) then return v_commit; end if;

  if cardinality(p_missing)>0 then
    select id into v_run from membership_3573.manual_refresh_runs where completed_at is null for update;
    if v_run is null then
      insert into membership_3573.manual_refresh_runs(invalid_fids,duplicate_profiles)
      values(0,0) returning id into v_run;
    end if;
    insert into membership_3573.refresh_jobs(job_key,job_kind,fid,priority,due_at,manual_run_id)
    select 'manual:'||v_run::text||':'||candidate.fid,'player_verify',candidate.fid,15,now(),v_run
    from (select distinct fid from unnest(p_missing) fid where fid ~ '^[1-9][0-9]{3,14}$') candidate
    where not exists (
      select 1 from membership_3573.refresh_jobs j where j.manual_run_id=v_run and j.fid=candidate.fid
    );
    get diagnostics v_queued=row_count;
  end if;
  return jsonb_build_object('queued',v_queued);
end $$;

revoke all on function public.caroline_3573_commit_priority_refresh(bigint,jsonb,text[],text) from public,anon,authenticated;
grant execute on function public.caroline_3573_commit_priority_refresh(bigint,jsonb,text[],text) to service_role;

commit;
