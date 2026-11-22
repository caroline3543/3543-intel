import {parseManualPlayerBatch} from '../src/services/manualMembershipRefresh.js';
import {verifiedAllianceRoster,verifiedPlayerLocation,verifiedProviderUsage} from '../src/services/verifiedPlayerLocation.js';
// Read-only Whiteout Stats response-shape diagnostic. No player data or secrets printed.
// Run: WOS_DIAGNOSTIC_KEY=... WOS_TEST_FID=... WOS_TEST_TAG=HOT node scripts/3573-provider-diagnostic.mjs
const key=process.env.WOS_DIAGNOSTIC_KEY||'';
const requestedFid=process.env.WOS_TEST_FID||'';
const tag=process.env.WOS_TEST_TAG||'HOT';
if(!/^wos_[\x21-\x7e]+$/.test(key))throw Error('Missing valid WOS_DIAGNOSTIC_KEY');
if(requestedFid&&!/^[1-9]\d{3,14}$/.test(requestedFid))throw Error('Missing valid WOS_TEST_FID');
if(!/^[A-Za-z0-9_]{1,16}$/.test(tag))throw Error('Invalid WOS_TEST_TAG');
const root='https://api.whiteoutstats.com/v1';
async function check(path){
 const response=await fetch(root+path,{headers:{Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 const data=await response.json().catch(()=>null);
 return {http:response.status,body:data?.data??data};
}
const usage=await check('/usage');
const counters=verifiedProviderUsage(usage.body);
if(usage.http!==200 || counters.used>4996 || counters.minuteUsed>56) {
  throw Error('Provider budget too low for this diagnostic. No player or roster requests sent.');
}
const roster=await check('/alliances/3573/'+encodeURIComponent(tag)+'?include=info,roster');
const validFid=value=>/^[1-9]\d{3,14}$/.test(value);
const members=Array.isArray(roster.body?.members)?roster.body.members:[];
const fid=requestedFid||members
 .map(member=>String(member?.chief_id??member?.fid??''))
 .find(validFid);
const batchIds=[...new Set([fid,...members.map(member=>String(member?.chief_id??member?.fid??''))].filter(validFid))].slice(0,2);
const player=fid?await check('/players/'+fid+'?include=base'):{http:null,body:null};
const parameters=new URLSearchParams({ids:batchIds.join(','),include:'base',wait:'5',max_age:'3600'});
const batch=batchIds.length?await check('/players?'+parameters):{http:null,body:null};
const batchResults=[...parseManualPlayerBatch(batch.body,batchIds).values()];
const keys=o=>o&&typeof o==='object'&&!Array.isArray(o)?Object.keys(o).slice(0,30):[];
const p=player.body,base=p?.player, r=roster.body,u=usage.body;
const at=base?.cached_at??p?.cached_at??p?.meta?.cached_at??null;
const timestampMs=value=>typeof value==='number'?(value<1e12?value*1000:value):typeof value==='string'&&/^\d{10,13}$/.test(value)?(Number(value)<1e12?Number(value)*1000:Number(value)):Date.parse(value);
const accepts = (check) => {
 try { check(); return true; } catch { return false; }
};
const evidence={
 usage:{http:usage.http,keys:keys(u),accepted:accepts(()=>verifiedProviderUsage(u))},
 player:{http:player.http,accepted:accepts(()=>verifiedPlayerLocation(p,fid)),keys:keys(p),playerKeys:keys(base),freshBoolean:typeof p?.fresh==='boolean',freshTrue:p?.fresh===true,hasExplicitAlliance:base!=null&&Object.hasOwn(base,'alliance'),hasState:base?.kid!=null,hasPlayerId:base?.chief_id!=null||base?.fid!=null,hasTimestamp:at!=null,timestampParseable:at!=null&&Number.isFinite(timestampMs(at))},
 batch:{http:batch.http,keys:keys(batch.body),attempted:batchIds.length,
  validPlayer:batchResults.filter(result=>result.validPlayer).length,
  verifiedMembership:batchResults.filter(result=>result.outcome==='verified').length,
  outcomeCounts:Object.fromEntries([...new Set(batchResults.map(result=>result.outcome))]
   .map(outcome=>[outcome,batchResults.filter(result=>result.outcome===outcome).length]))},
 roster:{http:roster.http,accepted:accepts(()=>verifiedAllianceRoster(r,'3573',tag)),keys:keys(r),memberCount:members.length}
};
console.log(JSON.stringify(evidence,null,2));
if([usage,player,roster,batch].some(x=>x.http!==200))process.exitCode=2;
else if(!evidence.usage.accepted||!evidence.player.accepted||!evidence.roster.accepted||evidence.batch.verifiedMembership!==batchIds.length||batchIds.length<2)process.exitCode=3;
