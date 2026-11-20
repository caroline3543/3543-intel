-- STAGED ONLY. Not applied to the live database.
-- One transaction updates the existing JSONB player in-place and inserts
-- a confirmed interstate event. Manual fields and other players remain intact.
-- Must be invoked by a trusted backend with service-role access only.
create or replace function membership_3573.commit_verified_location(
 p_fid text, p_state text, p_tag text, p_observed_at timestamptz,
 p_detected_at timestamptz, p_source text, p_expected_revision bigint, p_job_id bigint, p_lease_token uuid
) returns table(applied boolean, new_revision bigint, outcome text)
language plpgsql security invoker set search_path=''
as $$
declare
 v_workspace record;
 v_players jsonb;
 v_player jsonb;
 v_new jsonb;
 v_index integer;
 v_old_state text;
 v_old_tag text;
 v_old_observed timestamptz;
 v_manual timestamptz;
 v_history jsonb;
 v_event_key text;
begin
 if p_fid !~ '^[1-9][0-9]{3,14}$'
   or p_state !~ '^[1-9][0-9]*$'
   or p_tag is null or p_tag !~ '^[A-Za-z0-9_]{0,20}$'
   or p_observed_at is null or p_detected_at is null
   or p_observed_at > p_detected_at + interval '5 minutes'
   or p_observed_at < p_detected_at - interval '72 hours'
   or coalesce(length(p_source),0)<3 then
   raise exception 'Invalid or stale verified location evidence';
 end if;
 if not exists (select 1 from membership_3573.refresh_jobs where id=p_job_id and lease_token=p_lease_token and status='leased' and lease_until>=p_detected_at and job_kind='player_verify' and fid=p_fid for update) then raise exception 'Missing or expired worker lease'; end if;
 select w.data,w.revision into v_workspace
 from public.caroline_workspaces w where w.id='3573-leaders' for update;
 if not found then raise exception '3573 workspace missing'; end if;
 if v_workspace.revision<>p_expected_revision then
   return query select false,v_workspace.revision,'revision_conflict'::text;
   return;
 end if;
 v_players=v_workspace.data->'players';
 select (ordinality-1)::integer, value into v_index,v_player
 from jsonb_array_elements(v_players) with ordinality
 where value->>'fid'=p_fid;
 if not found then raise exception 'Unknown player FID'; end if;
 v_old_observed=nullif(coalesce(v_player->>'membershipLastSuccessfulAt',v_player->>'membershipObservedAt',''),'')::timestamptz;
 v_manual=nullif(coalesce(v_player->>'manualMembershipAt',''),'')::timestamptz;
 if (v_old_observed is not null and p_observed_at < v_old_observed)
    or (v_manual is not null and p_observed_at<=v_manual) then
   return query select false,v_workspace.revision,'older_observation'::text;
   return;
 end if;
 v_old_tag=coalesce(v_player->>'allianceTag','');
 v_old_state=case when v_player->>'membershipStatus'='transferred_out'
   then coalesce(nullif(v_player->>'transferDestinationState',''),'3573')
   else '3573' end;
 v_new=v_player||jsonb_build_object(
   'membershipObservedAt',p_observed_at,
   'membershipLastSuccessfulAt',p_observed_at,
   'membershipCheckedAt',p_observed_at);
 if p_state='3573' then
   v_new=v_new||jsonb_build_object(
     'allianceTag',p_tag,'membershipStatus','active',
     'transferDestinationState',null,'transferDestinationAlliance',null,
     'transferredOutAt',null);
   if v_old_tag<>p_tag then
     v_history=coalesce(v_player->'allianceHistory','[]'::jsonb);
     v_new=jsonb_set(v_new,'{allianceHistory}',
       (select coalesce(jsonb_agg(item order by ord),'[]'::jsonb) from
        (select item,ord from jsonb_array_elements(v_history||
         jsonb_build_array(jsonb_build_object('from',v_old_tag,'to',p_tag,'at',p_observed_at,'source','whiteoutstats'))) with ordinality t(item,ord)
         order by ord desc limit 20) recent));
     v_new=v_new||jsonb_build_object('lastKnownAlliance',v_old_tag);
   end if;
 else
   v_new=v_new||jsonb_build_object(
     'membershipStatus','transferred_out',
     'lastKnownAlliance',case when v_old_state='3573' then v_old_tag else coalesce(v_player->>'lastKnownAlliance',v_old_tag) end,
     'transferDestinationState',p_state,
     'transferDestinationAlliance',p_tag,
     'transferredOutAt',case when v_old_state='3573' then to_jsonb(p_detected_at) else coalesce(v_player->'transferredOutAt',to_jsonb(p_detected_at)) end);
 end if;
 update public.caroline_workspaces
 set data=jsonb_set(data,array['players',v_index::text],v_new),
     revision=revision+1,updated_at=p_detected_at,updated_by='membership-automation'
 where id='3573-leaders';
 if v_old_state<>p_state and (v_old_state='3573' or p_state='3573') then
   -- Only crossings of State 3573 are counted as transfers. Timestamp suffix
   -- distinguishes a later departure after the player returns to 3573.
   v_event_key='state:'||p_fid||':'||v_old_state||':'||p_state||':'||extract(epoch from p_observed_at)::bigint;
   insert into membership_3573.transfer_events
    (event_key,fid,username,direction,from_state,to_state,
     from_alliance,to_alliance,first_detected_at,last_verified_at,
     provider_observed_at,source,confidence)
   values(v_event_key,p_fid,v_player->>'username',
      case when p_state='3573' then 'in' else 'out' end,
      v_old_state,p_state,v_old_tag,p_tag,p_detected_at,p_detected_at,
      p_observed_at,p_source,'confirmed')
   on conflict(event_key) do update set last_verified_at=excluded.last_verified_at;
 end if;
 return query select true,v_workspace.revision+1,
   case when v_old_state<>p_state then 'state_transfer'
        when v_old_tag<>p_tag then 'alliance_change'
        else 'verified_unchanged' end::text;
end $$;
revoke all on function membership_3573.commit_verified_location(text,text,text,timestamptz,timestamptz,text,bigint,bigint,uuid) from public,anon,authenticated;
grant execute on function membership_3573.commit_verified_location(text,text,text,timestamptz,timestamptz,text,bigint,bigint,uuid) to service_role;
