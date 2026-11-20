/**
 * SQL transport adapter for the private membership_3573 schema.
 * transport.query(sql,params) must execute with a server-side service credential.
 * Never instantiate in a browser or with anon credentials.
 * Membership writes use the staged transaction-safe database functions.
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
        -- Seeding must not pull an existing scheduled refresh forward.
        -- Otherwise every seed run makes all primary rosters immediately due.
        on conflict(job_key) do nothing
        returning id`,
        [job.jobKey,job.jobKind,job.fid||null,job.allianceTag||null,job.priority||100,job.dueAt]);
      return rows?.[0]||null;
    },
    async leaseNext({now,leaseSeconds=600}){
      const rows=await query('select * from membership_3573.lease_next_job($1,$2)',[now,leaseSeconds]);
      const row=rows?.[0];
      return row?.id?{...row,jobKind:row.job_kind,jobKey:row.job_key,allianceTag:row.alliance_tag,lease_token:row.lease_token}:null;
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
    async reserveCredits({credits,providerUsed,now}){
      if(!Number.isSafeInteger(credits)||credits<1||credits>60||
         !Number.isSafeInteger(providerUsed)||providerUsed<0||
         !Number.isFinite(Date.parse(now||'')))return false;
      const rows=await query(
        'select membership_3573.reserve_request_credits($1,$2,$3) as allowed',
        [now,credits,providerUsed]
      );
      return rows?.[0]?.allowed===true;
    },
    async estimateRosterCredits(){
      // Whiteout Stats include=info,roster is one counted request.
      // members_base/members_full are intentionally not used here.
      return 1;
    },
    async getPlayer(fid){
      const rows=await query("select player from public.caroline_workspaces w cross join lateral jsonb_array_elements(w.data->'players') player where w.id='3573-leaders' and player->>'fid'=$1 limit 1",[String(fid)]);
      return rows?.[0]?.player||null;
    },
    async commitPlayerObservation({job,observation,detectedAt}){
      if(!job?.lease_token||observation?.status!=='verified'||observation.fresh!==true||String(observation.fid)!==String(job.fid)||!/^[1-9][0-9]*$/.test(String(observation.state??''))||typeof observation.tag!=='string'||!/^[A-Za-z0-9_]{0,20}$/.test(observation.tag)||!Number.isFinite(Date.parse(observation.at||''))||!observation.source)
        throw Error('Verified source and active lease required');
      for(let i=0;i<3;i++){
        const current=await query("select revision from public.caroline_workspaces where id='3573-leaders'",[]);
        const revision=current?.[0]?.revision;
        if(revision==null)throw Error('Workspace unavailable');
        const rows=await query('select * from membership_3573.commit_verified_location($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [String(job.fid),String(observation.state),observation.tag,observation.at,detectedAt,observation.source,revision,job.id,job.lease_token]);
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
