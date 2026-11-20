-- Proposed State 3573 automatic-membership storage.
-- NOT APPLIED TO PRODUCTION. Apply only after worker integration tests and review.
-- Tables are private to service-role workers; no client-side direct writes.
create schema if not exists membership_3573;
revoke all on schema membership_3573 from public, anon, authenticated;
create table if not exists membership_3573.refresh_jobs (
  id bigint generated always as identity primary key,
  job_key text not null unique,
  fid text,
  alliance_tag text,
  job_kind text not null check (job_kind in ('alliance_roster','player_verify','usage_check')),
  priority integer not null default 100,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','leased','completed','cancelled')),
  lease_until timestamptz,
  attempts integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now(),
  check (fid is not null or alliance_tag is not null or job_kind='usage_check')
);
create index if not exists refresh_jobs_due on membership_3573.refresh_jobs (due_at,priority) where status='pending';
create table if not exists membership_3573.transfer_events (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  fid text not null,
  username text,
  direction text not null check(direction in ('in','out')),
  from_state text,
  to_state text not null,
  from_alliance text,
  to_alliance text,
  first_detected_at timestamptz not null,
  last_verified_at timestamptz not null,
  provider_observed_at timestamptz,
  source text not null,
  confidence text not null check(confidence='confirmed'),
  actual_transfer_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists transfer_events_month on membership_3573.transfer_events (first_detected_at desc);
create index if not exists transfer_events_fid on membership_3573.transfer_events (fid,first_detected_at desc);
create table if not exists membership_3573.refresh_usage (
  usage_day date primary key,
  estimated_credits integer not null default 0 check(estimated_credits>=0),
  provider_reported_credits integer,
  reserve_credits integer not null default 1000 check(reserve_credits>=0),
  updated_at timestamptz not null default now()
);
create table if not exists membership_3573.roster_snapshots (
  alliance_tag text primary key,
  member_ids jsonb not null default '[]'::jsonb,
  provider_observed_at timestamptz,
  fetched_at timestamptz not null,
  is_complete boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table membership_3573.refresh_jobs enable row level security;
alter table membership_3573.transfer_events enable row level security;
alter table membership_3573.refresh_usage enable row level security;
alter table membership_3573.roster_snapshots enable row level security;
revoke all on all tables in schema membership_3573 from public,anon,authenticated;
-- Service-role worker must use a private server-side credential. Never expose it to browsers.

-- The private schema is accessible to trusted service-role workers only.
grant usage on schema membership_3573 to service_role;
grant select,insert,update,delete on all tables in schema membership_3573 to service_role;
grant usage,select on all sequences in schema membership_3573 to service_role;
alter default privileges in schema membership_3573 grant select,insert,update,delete on tables to service_role;
alter default privileges in schema membership_3573 grant usage,select on sequences to service_role;
