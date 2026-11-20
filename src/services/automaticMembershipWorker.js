import {availableBudget,estimatedCredits,refreshClass,nextRefreshAt,classifyLocation,classifyRosterDiscovery,upsertTransferEvent} from './automaticMembershipPolicy.js';

/** Testable coordinator. Storage and API adapters must be durable and authenticated. */
export function createMembershipWorker({store,api,clock=()=>Date.now(),reserve=1000}) {
  if(!store||!api)throw Error('Storage and API adapters required');
  const iso=()=>new Date(clock()).toISOString();
  async function seed(players,secondaryTags=[]) {
    let created=0;
    for(const player of players) {
      const cls=refreshClass(player,clock(),secondaryTags);
      if(!cls||!player?.fid)continue;
      const dueAt=new Date(nextRefreshAt(player,clock(),secondaryTags)).toISOString();
      await store.enqueue({jobKey:`player:${player.fid}`,jobKind:'player_verify',fid:String(player.fid),priority:cls==='recentDeparture'?10:cls==='primary'?20:cls==='noAlliance'?40:80,dueAt});
      created++;
    }
    for(const tag of ['ARC','RKG','HOT','LUN',...secondaryTags]) {
      await store.enqueue({jobKey:`roster:${tag}`,jobKind:'alliance_roster',allianceTag:tag,priority:['ARC','RKG','HOT','LUN'].includes(tag)?5:70,dueAt:iso()});
    }
    return created;
  }
  async function tick() {
    if(await store.isEnabled()!==true)return {status:'disabled'};
    const usage=await api.usage();
    if(!usage||!Number.isFinite(usage.used)||!Number.isFinite(usage.minuteUsed))return {status:'usage_unavailable'};
    const budget=availableBudget({used:usage.used,reserved:reserve});
    if(budget<=0)return {status:'budget_exhausted'};
    const job=await store.leaseNext({now:iso(),leaseSeconds:600});
    if(!job)return {status:'idle'};
    const credits=job.jobKind==='alliance_roster'?1:estimatedCredits({kind:'player'});
    let nextIntervalHours=24;
    if(credits>budget||usage.minuteUsed+credits>60){
      await store.retry(job,{dueAt:new Date(clock()+60000).toISOString(),reason:'budget_or_rate_limit'});
      return {status:'rate_limited'};
    }
    try{
      if(job.jobKind==='player_verify') {
        const previous=await store.getPlayer(job.fid);
        const group=refreshClass(previous,clock(),await store.getSecondaryTags?.()||[]);
        nextIntervalHours=group==='primary'||group==='recentDeparture'?12:group==='secondary'?168:24;
        if(!previous)throw Error('Unknown player');
        const observation=await api.verifyPlayer(job.fid);
        // The API adapter must reject cached, incomplete, stale or mismatched responses.
        if(!observation||observation.status!=='verified')throw Error('Unverified player response');
        const decision=classifyLocation(previous,observation,iso());
        await store.commitPlayerObservation({job,previous,observation,decision,detectedAt:iso()});
      } else if(job.jobKind==='alliance_roster') {
        nextIntervalHours=['ARC','RKG','HOT','LUN'].includes(job.allianceTag)?12:168;
        const roster=await api.roster('3573',job.allianceTag);
        if(!roster?.complete||!roster?.fresh||!Array.isArray(roster.members))throw Error('Incomplete roster response');
        const discoveries=[];
        for(const member of roster.members) {
          const prior=await store.getPlayer(String(member.fid));
          const discovery=classifyRosterDiscovery(prior,{...member,allianceTag:job.allianceTag},iso());
          if(discovery?.kind==='new_discovery')discoveries.push(discovery);
        }
        // Atomic snapshot + discoveries: disappearance never proves transfer.
        await store.commitRosterSnapshot({job,roster,discoveries,detectedAt:iso()});
      } else throw Error('Unsupported job kind');
      await store.complete(job,{completedAt:iso(),nextDueAt:new Date(clock()+nextIntervalHours*60*60*1000).toISOString()});
      return {status:'completed',jobKind:job.jobKind};
    }catch(error){
      const attempts=(job.attempts||0)+1;
      const delay=Math.min(3600000,60000*2**Math.min(6,attempts-1));
      await store.retry(job,{dueAt:new Date(clock()+delay).toISOString(),reason:String(error?.message||error).slice(0,200),attempts});
      return {status:'retry_scheduled',attempts};
    }
  }
  return {seed,tick};
}
