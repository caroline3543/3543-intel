create table public.caroline_workspaces (
 id text primary key check(id = '3573-leaders'),
 data jsonb,
 revision bigint not null default 0 check(revision >= 0),
 updated_at timestamptz not null default now(),
 updated_by text not null default 'setup',
 check(data is null or jsonb_typeof(data) = 'object')
);
create table public.caroline_workspace_revisions (
 workspace_id text not null references public.caroline_workspaces(id),
 revision bigint not null,
 data jsonb,
 updated_at timestamptz not null,
 updated_by text not null,
 primary key(workspace_id, revision)
);
alter table public.caroline_workspaces enable row level security;
alter table public.caroline_workspace_revisions enable row level security;
revoke all on public.caroline_workspaces, public.caroline_workspace_revisions from public, anon, authenticated;
grant select, insert, update, delete on public.caroline_workspaces, public.caroline_workspace_revisions to service_role;
insert into public.caroline_workspaces(id) values ('3573-leaders');
create function public.caroline_workspace_commit(expected_revision bigint, new_data jsonb, writer text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_row public.caroline_workspaces; output jsonb;
begin
 select * into current_row from public.caroline_workspaces where id = '3573-leaders' for update;
 if current_row.revision <> expected_revision then
  return jsonb_build_object('conflict', true, 'revision',current_row.revision,'data',current_row.data,'updatedAt',current_row.updated_at);
 end if;
 if jsonb_typeof(new_data) <> 'object' or new_data#>>'{settings,stateId}' is distinct from '3573' or octet_length(new_data::text) > 25165824 then raise exception 'Invalid workspace'; end if;
 if current_row.data is not distinct from new_data then
  return jsonb_build_object('revision',current_row.revision,'data',current_row.data,'updatedAt',current_row.updated_at);
 end if;
 insert into public.caroline_workspace_revisions values(current_row.id,current_row.revision,current_row.data,current_row.updated_at,current_row.updated_by);
 update public.caroline_workspaces set data = new_data, revision = revision + 1, updated_at = now(), updated_by = left(writer,64) where id = current_row.id returning * into current_row;
 delete from public.caroline_workspace_revisions where workspace_id=current_row.id and revision < current_row.revision - 5;
 return jsonb_build_object('revision',current_row.revision,'data',current_row.data,'updatedAt',current_row.updated_at);
end $$;
revoke execute on function public.caroline_workspace_commit(bigint,jsonb,text) from public, anon, authenticated;
grant execute on function public.caroline_workspace_commit(bigint,jsonb,text) to service_role;
