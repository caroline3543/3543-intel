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
    async cancel(job,reason){
      if(!job?.lease_token)throw Error('Lease token required');
      const rows=await query('select membership_3573.cancel_job($1,$2,$3) as ok',[job.id,job.lease_token,reason]);
      if(rows?.[0]?.ok!==true)throw Error('Expired or lost lease');
    },
    async estimateRosterCredits(tag){
      const rows=await query('select jsonb_array_length(member_ids) as n from membership_3573.roster_snapshots where alliance_tag=$1',[tag]);
      return Math.max(100,Number(rows?.[0]?.n||0));
    },
    async getPlayer(fid){
      const rows=await query("select player from public.caroline_workspaces w cross join lateral jsonb_array_elements(w.data->'players') player where w.id='3573-leaders' and player->>'fid'=$1 limit 1",[String(fid)]);
      return rows?.[0]?.player||null;
    },
    async commitPlayerObservation({job,observation,detectedAt}){
      if(!job?.lease_token||observation?.status!=='verified'||!observation.at||!observation.source)
        throw Error('Verified source and active lease required');
      for(let i=0;i<3;i++){
        const current=await query("select revision from public.caroline_workspaces where id='3573-leaders'",[]);
        const revision=current?.[0]?.revision;
        if(revision==null)throw Error('Workspace unavailable');
        const rows=await query('select * from membership_3573.commit_verified_location($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [String(job.fid),String(observation.state),String(observation.tag??''),observation.at,detectedAt,observation.source,revision,job.id,job.lease_token]);
        if(rows?.[0]?.outcome==='revision_conflict')continue;
        if(rows?.[0]?.outcome==='older_observation')return;
        if(rows?.[0]?.applied===true)return;
        throw Error('Membership commit rejected');
      }
      throw Error('Concurrent workspace updates; defer job');
    },
    async commitRosterSnapshot({job,roster,detectedAt}){
      if(!job?.lease_token||job.jobKind!=='alliance_roster'||!roster?.complete||!roster?.fresh||!Array.isArray(roster.members))
        throw Error('Complete fresh roster and active lease required');
      if(!Number.isFinite(Date.parse(roster.observedAt||'')))throw Error('Provider observation timestamp required');
      const rows=await query(
        'select membership_3573.commit_roster_snapshot($1,$2,$3,$4::jsonb,$5,$6) as count',
        [job.id,job.lease_token,job.allianceTag,JSON.stringify(roster.members),roster.observedAt,detectedAt]
      );
      if(!Number.isInteger(Number(rows?.[0]?.count)))throw Error('Roster snapshot commit rejected');
      return Number(rows[0].count);
    },
  };
}
