-- Isolated integration fixture for the workspace compare-and-swap contract.
begin;
create function public.caroline_workspace_commit(expected_revision bigint,new_data jsonb,writer text)
returns jsonb language plpgsql as $$
begin
  update public.caroline_workspaces set data=new_data,revision=revision+1,updated_by=writer
  where id='3573-leaders' and revision=expected_revision;
  return jsonb_build_object('conflict',not found);
end $$;
insert into public.caroline_workspaces(id, data) values('3573-leaders','{"players":[]}');
do $$
declare
  saved jsonb;
begin
  saved:=public.caroline_3573_commit_priority_refresh(0,'{"players":[{"fid":"1001"}]}',array['1001','1001'],'test');
  if saved->>'queued' is distinct from '1' or (select revision from public.caroline_workspaces where id='3573-leaders')<>1 then
    raise exception 'Roster save and targeted queue must commit together';
  end if;
  saved:=public.caroline_3573_commit_priority_refresh(0,'{"players":[]}',array['1002'],'test');
  if saved->>'conflict' is distinct from 'true' or exists(select 1 from membership_3573.refresh_jobs where fid='1002') then
    raise exception 'A stale roster write must not queue anything';
  end if;
  saved:=public.caroline_3573_commit_priority_refresh(1,'{"players":[{"fid":"1001"},{"fid":"1002"}]}',array['1001','1002'],'test');
  if saved->>'queued' is distinct from '1' or (select count(*) from membership_3573.manual_refresh_runs)<>1 then
    raise exception 'An active verification run must be reused without duplicating players';
  end if;
  if has_function_privilege('anon','public.caroline_3573_commit_priority_refresh(bigint,jsonb,text[],text)','EXECUTE') then
    raise exception 'Rollup writes must be private';
  end if;
end $$;
rollback;
