import {parseManualPlayerBatch} from '../src/services/manualMembershipRefresh.js';
import {verifiedProviderUsage} from '../src/services/verifiedPlayerLocation.js';

// Read-only diagnostic. Logs only counts and safe status labels.
const key=process.env.WOS_DIAGNOSTIC_KEY||'';
const requestedFid=process.env.WOS_TEST_FID||'';
const tag=process.env.WOS_TEST_TAG||'HOT';
const validFid=value=>/^[1-9]\d{3,14}$/.test(value);
if(!/^wos_[\x21-\x7e]+$/.test(key))throw Error('Missing valid WOS_DIAGNOSTIC_KEY');
if(requestedFid&&!validFid(requestedFid))throw Error('Missing valid WOS_TEST_FID');
if(!/^[A-Za-z0-9_]{1,16}$/.test(tag))throw Error('Invalid WOS_TEST_TAG');

const root='https://api.whiteoutstats.com/v1';
async function check(path, timeout=15000) {
  const response=await fetch(root+path,{
    headers:{Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(timeout)
  });
  const payload=await response.json().catch(()=>null);
  return {http:response.status,body:payload?.data??payload,retryAfter:response.headers.get('Retry-After')};
}

const usage=await check('/usage');
const counters=verifiedProviderUsage(usage.body);
if(usage.http!==200 || counters.used>4996 || counters.minuteUsed>56) {
  throw Error('Provider budget too low for this diagnostic. No player or roster requests sent.');
}
const roster=await check('/alliances/3573/'+encodeURIComponent(tag)+'?include=info,roster');
const members=Array.isArray(roster.body?.members)?roster.body.members:[];
const ids=[...new Set([requestedFid,...members.map(member=>String(member?.chief_id??member?.fid??''))].filter(validFid))].slice(0,2);
if(roster.http!==200||ids.length!==2)throw Error('Provider roster did not supply a two-player sample');

async function inspectBatch(fids, wait) {
  const params=new URLSearchParams({ids:fids.join(','),include:'base',wait:String(wait),max_age:'3600'});
  const response=await check('/players?'+params, (wait+10)*1000);
  const results=parseManualPlayerBatch(response.body,fids);
  const statuses=Object.create(null);
  for(const {outcome} of results.values())statuses[outcome]=(statuses[outcome]??0)+1;
  const freshFlags=(Array.isArray(response.body?.players)?response.body.players:[]).reduce((counts,row)=>{
    const label=row?.fresh===true?'fresh':row?.fresh===false?'stale':'missing';
    counts[label]++;
    return counts;
  },{fresh:0,stale:0,missing:0});
  return {response,results,evidence:{http:response.http,requested:fids.length,statuses,freshFlags}};
}

const first=await inspectBatch(ids,5);
let followup=null;
const waiting=[...first.results].find(([, result])=>['provider_pending','freshness_unverified'].includes(result.outcome));
if(first.response.http===200&&waiting) {
  // A single follow-up keeps even the fully charged case at four credits:
  // one alliance roster, two initial player IDs and one retry.
  const seconds=Number(waiting[1].retryAfter??first.response.body?.retry_after??first.response.retryAfter??5);
  if(Number.isFinite(seconds)&&seconds>=0&&seconds<=45) {
    await new Promise(resolve=>setTimeout(resolve,seconds*1000));
    followup=await inspectBatch([waiting[0]],30);
  }
}
const verified=new Set([...first.results,...(followup?.results??[])].filter(([,result])=>result.outcome==='verified').map(([fid])=>fid));
console.log(JSON.stringify({usageHttp:usage.http,rosterHttp:roster.http,first:first.evidence,
  followup:followup?.evidence??null,verifiedUniqueMemberships:verified.size},null,2));
if(first.response.http!==200||(followup&&followup.response.http!==200))process.exitCode=2;
else if(!verified.size)process.exitCode=3;
