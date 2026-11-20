-- Isolated CI only: confirm service-role feed works and is not publicly executable.
begin;
insert into membership_3573.transfer_events
 (event_key,fid,username,direction,from_state,to_state,
  from_alliance,to_alliance,first_detected_at,last_verified_at,source,confidence)
values
 ('test:transfer-feed:out','12345678','Test','out','3573','3599',
  'HOT','ABC','2026-11-20T12:00:00Z','2026-11-20T12:00:00Z','test','confirmed')
on conflict(event_key) do nothing;
do $$
begin
 if has_function_privilege('anon','public.caroline_3573_transfer_feed(integer)','execute')
 or has_function_privilege('authenticated','public.caroline_3573_transfer_feed(integer)','execute')
 then raise exception 'Transfer feed leaked public execute permission'; end if;
 if not has_function_privilege('service_role','public.caroline_3573_transfer_feed(integer)','execute')
 then raise exception 'Service role cannot execute transfer feed'; end if;
end $$;
set local role service_role;
do $$
begin
 if not exists(
  select 1 from public.caroline_3573_transfer_feed(500)
  where event_key='test:transfer-feed:out' and direction='out'
 ) then raise exception 'Confirmed transfer missing from feed'; end if;
end $$;
rollback;
