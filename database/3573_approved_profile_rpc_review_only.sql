-- REVIEW ONLY: do not apply to production.
-- Requires database/3573_approved_organisers_review_only.sql.
-- SECURITY DEFINER deliberately bypasses players RLS, but each entrypoint
-- authorises auth.uid() against a private, revocable allowlist first.
-- The function owner must be a trusted administrative role.
-- No direct organiser UPDATE policy on public.players is created.

create or replace function public.read_3573_profile_for_edit(p_id text)
returns table(updated_at timestamptz, alliance_tag text, data jsonb)
language plpgsql security definer set search_path = ''
as $$
begin
 if (select auth.uid()) is null or not exists (
   select 1 from app_private.state3573_profile_editors e
   where e.user_id=(select auth.uid()) and e.revoked_at is null
 ) then
   raise exception 'Profile editing not authorised' using errcode='42501';
 end if;
 if p_id is null or btrim(p_id)='' then
   raise exception 'Invalid player ID' using errcode='22023';
 end if;
 return query
 select p.updated_at,p.alliance_tag,p.data
 from public.players p where p.state_id='3573' and p.id=p_id;
end;
$$;

create or replace function public.update_3573_profile_fields(
 p_id text,
 p_expected_updated_at timestamptz,
 p_expected_alliance_tag text,
 p_changes jsonb
)
returns table(status text,server_updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
 v_updated_at timestamptz;
begin
 if (select auth.uid()) is null or not exists (
   select 1 from app_private.state3573_profile_editors e
   where e.user_id=(select auth.uid()) and e.revoked_at is null
 ) then
   raise exception 'Profile editing not authorised' using errcode='42501';
 end if;
 if p_id is null or btrim(p_id)='' or p_expected_updated_at is null
    or p_changes is null or jsonb_typeof(p_changes)<>'object'
    or p_changes='{}'::jsonb
    or exists (
      select 1 from jsonb_object_keys(p_changes) as k(key)
      where k.key not in ('notes','joinerHeroes','teamworkTraitStates','communicationLanguage')
    ) then
   raise exception 'Invalid profile changes' using errcode='22023';
 end if;

 update public.players p
 set data=(p.data || p_changes || jsonb_build_object('profileLastUpdated',clock_timestamp())),
     updated_at=clock_timestamp()
 where p.state_id='3573' and p.id=p_id
   and p.updated_at=p_expected_updated_at
   and coalesce(p.alliance_tag,'')=coalesce(p_expected_alliance_tag,'')
 returning p.updated_at into v_updated_at;

 if found then
   return query select 'saved'::text,v_updated_at;
 else
   return query select 'not_saved'::text,null::timestamptz;
 end if;
end;
$$;

revoke all on function public.read_3573_profile_for_edit(text) from public,anon;
revoke all on function public.update_3573_profile_fields(text,timestamptz,text,jsonb) from public,anon;
grant execute on function public.read_3573_profile_for_edit(text) to authenticated;
grant execute on function public.update_3573_profile_fields(text,timestamptz,text,jsonb) to authenticated;

-- Do not enable until the isolated authenticated integration tests pass.
