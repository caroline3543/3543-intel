-- STAGED ONLY. Atomic worker reservation; do not enable until provider usage
-- accounting includes all consumers of the same free-tier API key.
create table if not exists membership_3573.minute_reservations(
 minute_start timestamptz primary key,
 credits integer not null default 0 check(credits>=0),
 provider_credits integer not null default 0 check(provider_credits between 0 and 60)
);
alter table membership_3573.minute_reservations enable row level security;
revoke all on membership_3573.minute_reservations from public,anon,authenticated;
grant select,insert,update on membership_3573.minute_reservations to service_role;

create or replace function membership_3573.reserve_request_credits(
 p_now timestamptz,p_credits integer,p_provider_used integer,p_provider_minute_used integer
) returns boolean language plpgsql security invoker set search_path=''
as $$
declare
 v_day date;
 v_minute timestamptz;
 v_daily integer;
 v_minute_credits integer;
 v_last_provider integer;
 v_minute_provider integer;
begin
 if p_now is null or p_credits is null or p_credits<1 or p_credits>60
    or p_provider_used is null or p_provider_used not between 0 and 5000
    or p_provider_minute_used is null or p_provider_minute_used not between 0 and 60
 then return false; end if;
 v_day=(p_now at time zone 'UTC')::date;
 v_minute=date_trunc('minute',p_now);
 -- Serialize concurrent reservations across worker instances.
 perform pg_catalog.pg_advisory_xact_lock(3573,202611);
 insert into membership_3573.refresh_usage(usage_day,estimated_credits,provider_reported_credits,reserve_credits)
 values(v_day,0,p_provider_used,1000)
 on conflict(usage_day) do update
 set provider_reported_credits=greatest(coalesce(membership_3573.refresh_usage.provider_reported_credits,0),excluded.provider_reported_credits);
 insert into membership_3573.minute_reservations(minute_start,credits,provider_credits)
 values(v_minute,0,p_provider_minute_used)
 on conflict(minute_start) do update
 set provider_credits=greatest(membership_3573.minute_reservations.provider_credits,excluded.provider_credits);
 select estimated_credits,provider_reported_credits into v_daily,v_last_provider from membership_3573.refresh_usage where usage_day=v_day for update;
 select credits,provider_credits into v_minute_credits,v_minute_provider from membership_3573.minute_reservations where minute_start=v_minute for update;
 -- Conservatively account for provider usage already reported and locally
 -- reserved credits. Never allow more than 4,000 planned worker credits/day.
 -- Deliberately conservative: provider totals may lag, and other site calls
 -- can spend credits between snapshots. This may count some usage twice,
 -- but must not undercount the free-tier account allowance.
 if greatest(p_provider_used,v_last_provider)+v_daily+p_credits>4000
    or v_minute_provider+v_minute_credits+p_credits>60 then return false; end if;
 update membership_3573.refresh_usage
 set estimated_credits=estimated_credits+p_credits,updated_at=p_now where usage_day=v_day;
 update membership_3573.minute_reservations
 set credits=credits+p_credits where minute_start=v_minute;
 return true;
end $$;
revoke all on function membership_3573.reserve_request_credits(timestamptz,integer,integer,integer) from public,anon,authenticated;
grant execute on function membership_3573.reserve_request_credits(timestamptz,integer,integer,integer) to service_role;

-- Public-schema RPC bridge for trusted Supabase Edge Functions only.
-- Both the existing proxy and the private worker reserve from the same ledger.
create or replace function public.caroline_3573_reserve_proxy_credit(p_provider_used integer,p_provider_minute_used integer)
returns boolean language sql security invoker set search_path=''
as $$
 select membership_3573.reserve_request_credits(now(),1,p_provider_used,p_provider_minute_used)
$$;
revoke all on function public.caroline_3573_reserve_proxy_credit(integer,integer) from public,anon,authenticated;
grant execute on function public.caroline_3573_reserve_proxy_credit(integer,integer) to service_role;
