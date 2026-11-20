-- Staged extension for 3573 worker. Apply with base schema only after review.
-- Atomic leasing, retry and completion. Private schema, service-role only.
alter table membership_3573.refresh_jobs add column if not exists lease_token uuid;
alter table membership_3573.refresh_jobs add column if not exists completed_at timestamptz;
alter table membership_3573.refresh_jobs add column if not exists last_successful_at timestamptz;
create extension if not exists pgcrypto;

create or replace function membership_3573.lease_next_job(p_now timestamptz, p_lease_seconds integer default 600)
returns membership_3573.refresh_jobs
language plpgsql security invoker set search_path = ''
as $$
declare v_job membership_3573.refresh_jobs;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 3600 then raise exception 'Invalid lease duration'; end if;
  with candidate as (
    select id from membership_3573.refresh_jobs
    where (status='pending' and due_at <= p_now)
       or (status='leased' and lease_until < p_now)
    order by priority asc, due_at asc, id asc
    for update skip locked limit 1
  )
  update membership_3573.refresh_jobs j
     set status='leased', lease_until=p_now+make_interval(secs=>p_lease_seconds),
         lease_token=extensions.gen_random_uuid(), updated_at=p_now
    from candidate c where j.id=c.id
    returning j.* into v_job;
  return v_job;
end $$;

create or replace function membership_3573.finish_job(p_id bigint,p_token uuid,p_completed_at timestamptz,p_next_due_at timestamptz)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_count integer;
begin
 update membership_3573.refresh_jobs
    set status='pending',due_at=p_next_due_at,completed_at=p_completed_at,
        last_successful_at=p_completed_at,attempts=0,last_error=null,
        lease_until=null,lease_token=null,updated_at=p_completed_at
  where id=p_id and status='leased' and lease_token=p_token and lease_until>=p_completed_at;
 get diagnostics v_count=row_count;
 return v_count=1;
end $$;

create or replace function membership_3573.retry_job(p_id bigint,p_token uuid,p_now timestamptz,p_next_due_at timestamptz,p_error text,p_attempts integer)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_count integer;
begin
 update membership_3573.refresh_jobs
    set status=case when p_attempts>=5 then 'cancelled' else 'pending' end,
        due_at=p_next_due_at, attempts=p_attempts,last_error=left(p_error,200),
        lease_until=null,lease_token=null,updated_at=p_now
  where id=p_id and status='leased' and lease_token=p_token;
 get diagnostics v_count=row_count;
 return v_count=1;
end $$;

revoke all on function membership_3573.lease_next_job(timestamptz,integer) from public,anon,authenticated;
revoke all on function membership_3573.finish_job(bigint,uuid,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function membership_3573.retry_job(bigint,uuid,timestamptz,timestamptz,text,integer) from public,anon,authenticated;
grant usage on schema membership_3573 to service_role;
grant select,insert,update on all tables in schema membership_3573 to service_role;
grant usage,select on all sequences in schema membership_3573 to service_role;
grant execute on function membership_3573.lease_next_job(timestamptz,integer) to service_role;
grant execute on function membership_3573.finish_job(bigint,uuid,timestamptz,timestamptz) to service_role;
grant execute on function membership_3573.retry_job(bigint,uuid,timestamptz,timestamptz,text,integer) to service_role;
