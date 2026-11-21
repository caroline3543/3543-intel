-- STAGED ONLY. Service-role read-only transfer feed for the authenticated 3573 site.
-- Exposed via a trusted Edge Function, never directly to browser credentials.
create or replace function public.caroline_3573_transfer_feed(p_limit integer default 500,p_before_id bigint default null)
returns table (
 id bigint, event_key text, fid text, username text, direction text,
 from_state text, to_state text, from_alliance text, to_alliance text,
 first_detected_at timestamptz, last_verified_at timestamptz,
 provider_observed_at timestamptz, source text, confidence text
)
language sql security invoker set search_path=''
as $$
 select e.id,e.event_key,e.fid,e.username,e.direction,e.from_state,e.to_state,
        e.from_alliance,e.to_alliance,e.first_detected_at,e.last_verified_at,
        e.provider_observed_at,e.source,e.confidence
 from membership_3573.transfer_events e
 where e.confidence='confirmed' and (p_before_id is null or e.id<p_before_id)
 order by e.id desc
 limit least(greatest(coalesce(p_limit,500),1),2000)
$$;
revoke all on function public.caroline_3573_transfer_feed(integer,bigint) from public,anon,authenticated;
grant execute on function public.caroline_3573_transfer_feed(integer,bigint) to service_role;
