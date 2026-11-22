#!/usr/bin/env bash
set -euo pipefail

export DATABASE_URL='postgresql://supabase_admin:fixture-postgres-password@127.0.0.1:55444/postgres'
export MEMBERSHIP_3573_CRON_SECRET='synthetic-cron-secret-for-the-isolated-fixture'
export WHITEOUTSTATS_API_KEY='wos_fixture_only'
export MEMBERSHIP_3573_ENABLED=true
psql_fixture() { psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 "$@"; }

docker run -d --name membership-fixture-db --network host \
  -e POSTGRES_PASSWORD=fixture-postgres-password \
  supabase/postgres:17.6.1.136 \
  -p 55444 -c config_file=/etc/postgresql/postgresql.conf -c listen_addresses=127.0.0.1 \
  -c cron.use_background_workers=on -c cron.database_name=postgres
for _ in {1..90}; do
  if psql_fixture -Atqc 'select 1' 2>/dev/null; then break; fi
  sleep 1
done
psql_fixture -Atqc 'select version()'

psql_fixture <<'SQL'
create table public.caroline_workspaces (
  id text primary key, data jsonb not null, revision bigint not null default 0,
  updated_at timestamptz, updated_by text
);
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;
SQL
for migration in 3573_automatic_membership_schema 3573_automatic_membership_worker_functions \
  3573_membership_roster_snapshot 3573_membership_atomic_commit 3573_membership_transfer_feed \
  3573_membership_shared_budget 3573_membership_manual_refresh; do
  psql_fixture -f "database/$migration.sql"
done
psql_fixture -v fixture_secret="$MEMBERSHIP_3573_CRON_SECRET" <<'SQL'
select vault.create_secret('https://cronfixture.supabase.co','membership_3573_worker_origin');
select vault.create_secret(:'fixture_secret','membership_3573_cron_secret');
insert into public.caroline_workspaces (id,data) values ('3573-leaders','{"players":[
  {"fid":"900000001","username":"One","allianceTag":"ARC"},
  {"fid":"900000002","username":"Two","allianceTag":"ARC"}]}');
insert into membership_3573.refresh_jobs (job_key,job_kind,alliance_tag,due_at)
select 'roster:'||tag,'alliance_roster',tag,now()+interval '1 day'
from unnest(array['ARC','HOT','LUN','RKG','FARM']) tag;
insert into membership_3573.refresh_jobs (job_key,job_kind,fid,due_at)
select 'player:'||fid,'player_verify',fid,now()+interval '1 day'
from unnest(array['900000001','900000002']) fid;
SQL

deno run -A --config supabase/functions/caroline3573-membership-worker/deno.json tests/3573-cron-worker-fixture.ts &
worker=$!
trap 'kill "$worker" 2>/dev/null || true' EXIT
for _ in {1..60}; do
  if curl -fsS -H "Authorization: Bearer $MEMBERSHIP_3573_CRON_SECRET" \
    -H 'Content-Type: application/json' -d '{"mode":"readiness"}' \
    http://127.0.0.1:8000/functions/v1/caroline3573-membership-worker; then break; fi
  sleep 1
done
test "$(curl -sS -o /dev/null -w '%{http_code}' -d '{"mode":"tick"}' http://127.0.0.1:8000/functions/v1/caroline3573-membership-worker)" = 401

# The sole substitution sends the real pg_net HTTP request to the isolated worker.
sed "s@url=>v_origin||'/functions/@url=>'http://127.0.0.1:8000/functions/@" \
  database/3573_membership_scheduler.sql | psql_fixture
psql_fixture -c "select cron.alter_job(jobid, schedule=>'5 seconds')
  from cron.job where jobname='state-3573-membership-worker'"

await_condition() {
  for _ in {1..40}; do
    if [[ $(psql_fixture -Atqc "$1") == "t" ]]; then return; fi
    sleep 1
  done
  psql_fixture -c 'select status,return_message from cron.job_run_details order by runid desc limit 5'
  psql_fixture -c 'select status_code,error_msg,content from net._http_response order by id desc limit 5'
  return 1
}
await_condition "select exists(select 1 from net._http_response where status_code=200 and content::jsonb->>'manual'='idle')"
test "$(psql_fixture -Atqc 'select coalesce(sum(estimated_credits),0) from membership_3573.refresh_usage')" = 0
echo 'Idle scheduled tick spent zero credits.'
psql_fixture -c 'select public.caroline_3573_manual_refresh(true)'
await_condition "select (public.caroline_3573_manual_refresh(false)->>'persisted')::integer=2"
test "$(psql_fixture -Atqc 'select sum(estimated_credits) from membership_3573.refresh_usage')" = 2
test "$(psql_fixture -Atqc "select count(*) from public.caroline_workspaces, jsonb_array_elements(data->'players') p where p->>'allianceTag'='FARM' and p ? 'membershipObservedAt'")" = 2
echo 'Cron called the authenticated worker and committed both memberships using two credits.'
psql_fixture -c "select cron.unschedule('state-3573-membership-worker')"
