// Read-only Whiteout Stats response-shape diagnostic. No player data or secrets printed.
// Run: WOS_DIAGNOSTIC_KEY=... WOS_TEST_FID=... WOS_TEST_TAG=HOT node scripts/3573-provider-diagnostic.mjs
const key=process.env.WOS_DIAGNOSTIC_KEY||'';
const fid=process.env.WOS_TEST_FID||'';
const tag=process.env.WOS_TEST_TAG||'HOT';
if(!/^wos_[\x21-\x7e]+$/.test(key))throw Error('Missing valid WOS_DIAGNOSTIC_KEY');
if(!/^[1-9]\d{3,14}$/.test(fid))throw Error('Missing valid WOS_TEST_FID');
if(!/^[A-Za-z0-9_]{1,16}$/.test(tag))throw Error('Invalid WOS_TEST_TAG');
const root='https://api.whiteoutstats.com/v1';
async function check(path){
 const response=await fetch(root+path,{headers:{Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 const data=await response.json().catch(()=>null);
 return {http:response.status,body:data?.data??data};
}
const [usage,player,roster]=await Promise.all([
 check('/usage'),
 check('/players/'+fid+'?include=base'),
 check('/alliances/3573/'+encodeURIComponent(tag)+'?include=info,roster')
]);
const keys=o=>o&&typeof o==='object'&&!Array.isArray(o)?Object.keys(o).slice(0,30):[];
const p=player.body,base=p?.player, r=roster.body,u=usage.body;
const at=base?.cached_at??p?.cached_at??p?.meta?.cached_at??null;
const timestampMs=value=>typeof value==='number'?(value<1e12?value*1000:value):typeof value==='string'&&/^\d{10,13}$/.test(value)?(Number(value)<1e12?Number(value)*1000:Number(value)):Date.parse(value);
const evidence={
 usage:{http:usage.http,keys:keys(u),usedInteger:Number.isSafeInteger(u?.used),minuteUsedInteger:Number.isSafeInteger(u?.minute_used)},
 player:{http:player.http,keys:keys(p),playerKeys:keys(base),freshBoolean:typeof p?.fresh==='boolean',freshTrue:p?.fresh===true,hasExplicitAlliance:base!=null&&Object.hasOwn(base,'alliance'),hasState:base?.kid!=null,hasPlayerId:base?.chief_id!=null||base?.fid!=null,hasTimestamp:at!=null,timestampParseable:at!=null&&Number.isFinite(timestampMs(at))},
 roster:{http:roster.http,keys:keys(r),freshBoolean:typeof r?.fresh==='boolean',completeBoolean:typeof r?.complete==='boolean',membersArray:Array.isArray(r?.members),rosterArray:Array.isArray(r?.roster),hasTimestamp:r?.cached_at!=null}
};
console.log(JSON.stringify(evidence,null,2));
if([usage,player,roster].some(x=>x.http!==200))process.exitCode=2;
else if(!evidence.usage.usedInteger||!evidence.usage.minuteUsedInteger||!evidence.player.freshTrue||!evidence.player.hasExplicitAlliance||!evidence.player.hasState||!evidence.player.hasPlayerId||!evidence.player.timestampParseable||!evidence.roster.freshBoolean||!evidence.roster.completeBoolean||!evidence.roster.membersArray||!evidence.roster.hasTimestamp)process.exitCode=3;
