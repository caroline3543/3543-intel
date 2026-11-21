import {providerObservationTime,verifiedPlayerLocation,verifiedProviderUsage} from '../src/services/verifiedPlayerLocation.js';
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
const [usage,roster]=await Promise.all([
 check('/usage'),
 check('/alliances/3573/'+encodeURIComponent(tag)+'?include=info,roster')
]);
const validFid=value=>/^[1-9]\d{3,14}$/.test(value);
const members=Array.isArray(roster.body?.members)?roster.body.members:[];
const fid=requestedFid||members
 .map(member=>String(member?.chief_id??member?.fid??''))
 .find(validFid);
const player=fid?await check('/players/'+fid+'?include=base'):{http:null,body:null};
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
 roster:{http:roster.http,timestampFresh:accepts(()=>providerObservationTime(r?.cached_at)),keys:keys(r),freshTrue:r?.fresh===true,completeTrue:r?.complete===true,membersArray:Array.isArray(r?.members),rosterArray:Array.isArray(r?.roster),hasTimestamp:r?.cached_at!=null}
};
console.log(JSON.stringify(evidence,null,2));
if([usage,player,roster].some(x=>x.http!==200))process.exitCode=2;
else if(!evidence.usage.accepted||!evidence.player.accepted||!evidence.roster.freshTrue||!evidence.roster.completeTrue||!evidence.roster.membersArray||!evidence.roster.timestampFresh)process.exitCode=3;
