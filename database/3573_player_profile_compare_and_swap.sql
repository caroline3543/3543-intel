-- REVIEW ONLY. Do not apply without an approved deployment and RLS verification.
-- Atomic compare-and-swap for existing player rows. Uses caller's RLS permissions.
-- Expected timestamp MUST come from the server, not a client-generated edit time.
create or replace function public.update_player_if_unchanged(
  p_state_id text,
  p_id text,
  p_expected_updated_at timestamptz,
  p_alliance_tag text,
  p_data jsonb
)
returns table(status text, server_updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated_at timestamptz;
begin
  if p_state_id !~ '^[1-9][0-9]{0,4}$' or p_id is null or length(p_id)=0
     or p_expected_updated_at is null or p_data is null or jsonb_typeof(p_data)<>'object' then
    raise exception 'Invalid player update arguments' using errcode='22023';
  end if;

  update public.players
     set data=p_data, alliance_tag=p_alliance_tag, updated_at=clock_timestamp()
   where state_id=p_state_id and id=p_id
     and updated_at=p_expected_updated_at
  returning updated_at into v_updated_at;

  if found then
    return query select 'saved'::text,v_updated_at;
  else
    -- Deliberately does not distinguish missing, forbidden, and conflicting rows.
    return query select 'not_saved'::text,null::timestamptz;
  end if;
end;
$$;

revoke all on function public.update_player_if_unchanged(text,text,timestamptz,text,jsonb) from public;
revoke all on function public.update_player_if_unchanged(text,text,timestamptz,text,jsonb) from anon;
grant execute on function public.update_player_if_unchanged(text,text,timestamptz,text,jsonb) to authenticated;
