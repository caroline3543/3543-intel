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
    if(!usage||!Number.isSafeInteger(usage.used)||usage.used<0||!Number.isSafeInteger(usage.minuteUsed)||usage.minuteUsed<0||usage.minuteUsed>60)return {status:'usage_unavailable'};
    const budget=availableBudget({used:usage.used,reserved:reserve});
    if(budget<=0)return {status:'budget_exhausted'};
    const job=await store.leaseNext({now:iso(),leaseSeconds:600});
    if(!job)return {status:'idle'};
    let credits;
    try {
      const estimate=job.jobKind==='alliance_roster'
        ? await store.estimateRosterCredits?.(job.allianceTag)
        : estimatedCredits({kind:'player'});
      credits=estimate===undefined ? NaN : Number(estimate);
    } catch {
      credits=NaN;
    }
    let nextIntervalHours=24;
    if(!Number.isSafeInteger(credits)||credits<1||credits>60){
      await store.retry(job,{dueAt:new Date(clock()+3600000).toISOString(),reason:'unverified_or_excessive_request_cost',attempts:job.attempts||0});
      return {status:'cost_unverified'};
    }
    if(credits>budget||usage.minuteUsed+credits>60){
      await store.retry(job,{dueAt:new Date(clock()+60000).toISOString(),reason:'budget_or_rate_limit',attempts:job.attempts||0});
      return {status:'rate_limited'};
    }
    // Eligibility must be checked before consuming a non-refundable reservation.
    // A cancelled or transferred-out player must not spend free-tier credits.
    let verifiedPlayer=null;
    let playerGroup=null;
    if(job.jobKind==='player_verify'){
      try{
        verifiedPlayer=await store.getPlayer(job.fid);
        if(!verifiedPlayer){
          await store.cancel(job,'unknown_player');
          return {status:'not_eligible'};
        }
        playerGroup=refreshClass(verifiedPlayer,clock(),await store.getSecondaryTags?.()||[]);
        if(!playerGroup){
          await store.cancel(job,'not_eligible');
          return {status:'not_eligible'};
        }
      }catch(error){
        await store.retry(job,{dueAt:new Date(clock()+60000).toISOString(),reason:'eligibility_check_unavailable',attempts:job.attempts||0});
        return {status:'eligibility_unavailable'};
      }
    }
    // The provider usage snapshot is advisory. Shared reservations are required
    // to prevent simultaneous workers from spending the same remaining credits.
    // Fail closed until the server adapter supplies an atomic reservation.
    let reserved=false;
    try {
      reserved=await store.reserveCredits?.({credits,providerUsed:usage.used,now:iso()})===true;
    } catch {
      reserved=false;
    }
    if(!reserved){
      await store.retry(job,{dueAt:new Date(clock()+60000).toISOString(),reason:'shared_budget_unavailable',attempts:job.attempts||0});
      return {status:'budget_unavailable'};
    }
    try{
      if(job.jobKind==='player_verify') {
        const previous=await store.getPlayer(job.fid);
        if(!previous)throw Error('Unknown player');
        const group=refreshClass(previous,clock(),await store.getSecondaryTags?.()||[]);
        if(!group){await store.cancel(job,'not_eligible');return {status:'not_eligible'};}
        nextIntervalHours=group==='primary'||group==='recentDeparture'?12:group==='secondary'?168:24;
        const observation=await api.verifyPlayer(job.fid);
        // The API adapter must reject cached, incomplete, stale or mismatched responses.
        if(!observation||observation.status!=='verified'||observation.fresh!==true||String(observation.fid)!==String(job.fid)||!observation.source||!/^[1-9][0-9]*$/.test(String(observation.state??''))||typeof observation.tag!=='string'||!/^[A-Za-z0-9_]{0,20}$/.test(observation.tag)||!Number.isFinite(Date.parse(observation.at||''))||Date.parse(observation.at)>clock()+300000||clock()-Date.parse(observation.at)>72*60*60*1000)throw Error('Unverified, stale or mismatched player response');
        const decision=classifyLocation(previous,observation,iso());
        await store.commitPlayerObservation({job,previous,observation,decision,detectedAt:iso()});
      } else if(job.jobKind==='alliance_roster') {
        nextIntervalHours=['ARC','RKG','HOT','LUN'].includes(job.allianceTag)?12:168;
        const roster=await api.roster('3573',job.allianceTag);
        if(!roster?.complete||!roster?.fresh||!Array.isArray(roster.members)||!Number.isFinite(Date.parse(roster.observedAt||''))||Date.parse(roster.observedAt)>clock()+300000||clock()-Date.parse(roster.observedAt)>72*60*60*1000)throw Error('Incomplete or stale roster response');
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
