-- Isolated CI only: atomic reservations and safety thresholds.
begin;
do $$
declare
 i integer;
begin
 if not membership_3573.reserve_request_credits('2026-11-20T12:00:00Z',1,100)
 then raise exception 'First reservation rejected'; end if;
 if membership_3573.reserve_request_credits('2026-11-20T12:00:00Z',61,100)
 then raise exception 'Oversized reservation accepted'; end if;
 if membership_3573.reserve_request_credits('2026-11-20T12:00:00Z',1,-1)
 then raise exception 'Invalid provider usage accepted'; end if;
 for i in 1..59 loop
  if not membership_3573.reserve_request_credits('2026-11-20T12:00:00Z',1,100)
  then raise exception 'Reservation % rejected unexpectedly',i; end if;
 end loop;
 if membership_3573.reserve_request_credits('2026-11-20T12:00:00Z',1,100)
 then raise exception 'Minute limit bypassed'; end if;
 if not membership_3573.reserve_request_credits('2026-11-20T12:01:00Z',1,100)
 then raise exception 'New minute reservation rejected'; end if;
 if membership_3573.reserve_request_credits('2026-11-20T12:02:00Z',2,3999)
 then raise exception 'Daily reserve bypassed'; end if;
 if not public.caroline_3573_reserve_proxy_credit() then
  raise exception 'Proxy cannot reserve shared API credit'; end if;
 if has_function_privilege('anon','public.caroline_3573_reserve_proxy_credit()','execute')
 then raise exception 'Proxy reservation callable by anonymous role'; end if;
 if not has_function_privilege('service_role','public.caroline_3573_reserve_proxy_credit()','execute')
 then raise exception 'Service role cannot reserve proxy credits'; end if;
 if has_function_privilege('anon','membership_3573.reserve_request_credits(timestamptz,integer,integer)','execute')
 then raise exception 'Budget reservation exposed to anon'; end if;
end $$;
rollback;
