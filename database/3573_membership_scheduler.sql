-- Opt-in deployment step. Run only on the intended Supabase project after
-- the migrated worker passes readiness and the matching Vault values exist.
-- There is no provider key or bearer secret in the scheduled job text.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function membership_3573.kick_worker()
returns bigint language plpgsql security invoker set search_path='' as $$
declare
  v_origin text;
  v_secret text;
begin
  select decrypted_secret into v_origin from vault.decrypted_secrets where name='membership_3573_worker_origin';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='membership_3573_cron_secret';
  if v_origin is null or v_origin !~ '^https://[a-z0-9]+[.]supabase[.]co$'
    or coalesce(length(v_secret),0)<32 then
    raise exception 'State 3573 scheduler Vault configuration is incomplete';
  end if;
  return net.http_post(
    url=>v_origin||'/functions/v1/caroline3573-membership-worker',
    headers=>jsonb_build_object('Authorization','Bearer '||v_secret,'Content-Type','application/json'),
    body=>'{"mode":"tick"}'::jsonb,timeout_milliseconds=>90000
  );
end $$;
revoke all on function membership_3573.kick_worker() from public,anon,authenticated,service_role;

do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name='membership_3573_worker_origin'
    and decrypted_secret ~ '^https://[a-z0-9]+[.]supabase[.]co$')
    or not exists(select 1 from vault.decrypted_secrets where name='membership_3573_cron_secret'
    and length(decrypted_secret)>=32) then
    raise exception 'State 3573 scheduler Vault configuration is incomplete';
  end if;
end $$;

select cron.schedule('state-3573-membership-worker','2-57/5 * * * *','select membership_3573.kick_worker()');
commit;
