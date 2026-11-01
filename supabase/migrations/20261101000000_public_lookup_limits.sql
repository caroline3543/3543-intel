-- Database-backed public lookup budget. All writes happen in a restricted RPC.
create table if not exists public.whiteoutstats_lookup_buckets (
  bucket_key text primary key,
  window_start timestamptz not null,
  requests integer not null check (requests >= 0)
);
alter table public.whiteoutstats_lookup_buckets enable row level security;
revoke all on public.whiteoutstats_lookup_buckets from public, anon, authenticated;

create or replace function public.consume_whiteoutstats_lookup(p_client_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  hour_window timestamptz := date_trunc('hour', now());
  day_window timestamptz := date_trunc('day', now());
  client_count integer;
  global_count integer;
begin
  if p_client_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  -- Serializes concurrent requests so caps cannot be bypassed by bursts.
  perform pg_advisory_xact_lock(46735630);
  insert into public.whiteoutstats_lookup_buckets (bucket_key, window_start, requests)
  values ('client:' || p_client_hash, hour_window, 1)
  on conflict (bucket_key) do update
    set requests = case when public.whiteoutstats_lookup_buckets.window_start = hour_window
      then public.whiteoutstats_lookup_buckets.requests + 1 else 1 end,
        window_start = hour_window
  returning requests into client_count;
  if client_count > 20 then return false; end if;
  insert into public.whiteoutstats_lookup_buckets (bucket_key, window_start, requests)
  values ('global', day_window, 1)
  on conflict (bucket_key) do update
    set requests = case when public.whiteoutstats_lookup_buckets.window_start = day_window
      then public.whiteoutstats_lookup_buckets.requests + 1 else 1 end,
        window_start = day_window
  returning requests into global_count;
  return global_count <= 300;
end;
$$;
revoke all on function public.consume_whiteoutstats_lookup(text) from public, anon, authenticated;
grant execute on function public.consume_whiteoutstats_lookup(text) to service_role;
