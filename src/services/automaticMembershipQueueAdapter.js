/**
 * SQL transport adapter for the private membership_3573 schema.
 * transport.query(sql,params) must execute with a server-side service credential.
 * Never instantiate in a browser or with anon credentials.
 * Profile and event writes intentionally remain unimplemented until a
 * transaction-safe workspace merge is available.
 */
export function createMembershipQueueAdapter({query,enabled=async()=>false}) {
  if(typeof query!=='function')throw Error('Private SQL query transport required');
  return {
    isEnabled:enabled,
    async enqueue(job){
      if(!job?.jobKey||!job?.jobKind||!job?.dueAt)throw Error('Invalid job');
      const rows=await query(`
        insert into membership_3573.refresh_jobs(job_key,job_kind,fid,alliance_tag,priority,due_at)
        values($1,$2,$3,$4,$5,$6)
        on conflict(job_key) do update set
          priority=excluded.priority,
          due_at=least(membership_3573.refresh_jobs.due_at,excluded.due_at),
          updated_at=now()
        where membership_3573.refresh_jobs.status='pending'
        returning id`,
        [job.jobKey,job.jobKind,job.fid||null,job.allianceTag||null,job.priority||100,job.dueAt]);
      return rows?.[0]||null;
    },
    async leaseNext({now,leaseSeconds=600}){
      const rows=await query('select * from membership_3573.lease_next_job($1,$2)',[now,leaseSeconds]);
      return rows?.[0]?.id?rows[0]:null;
    },
    async complete(job,{completedAt,nextDueAt}){
      if(!job?.lease_token||!nextDueAt)throw Error('Lease token and next due date required');
      const rows=await query('select membership_3573.finish_job($1,$2,$3,$4) as ok',[job.id,job.lease_token,completedAt,nextDueAt]);
      if(rows?.[0]?.ok!==true)throw Error('Expired or lost lease');
    },
    async retry(job,{dueAt,reason,attempts}){
      if(!job?.lease_token)throw Error('Lease token required');
      const rows=await query('select membership_3573.retry_job($1,$2,$3,$4,$5,$6) as ok',[job.id,job.lease_token,new Date().toISOString(),dueAt,reason,attempts||0]);
      if(rows?.[0]?.ok!==true)throw Error('Expired or lost lease');
    },
    async commitPlayerObservation(){throw Error('Atomic workspace membership merge not configured')},
    async commitRosterSnapshot(){throw Error('Atomic roster snapshot transaction not configured')},
  };
}
