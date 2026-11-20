import {test} from 'node:test';
import {suspectedTransferOut} from '../src/services/rosterViewService.js';
import assert from 'node:assert/strict';
import {gameLanguageCode,gameLanguageName,withGameLanguage,providerField} from '../src/services/gameLanguageService.js';
import {recordedTimestamp,recordedActivity} from '../src/services/recordedActivityService.js';
import {applyPlayerDetails} from '../src/services/playerDetailsService.js';
import {buildRosterDataSheet} from '../src/services/xlsxDataSheets.js';
import * as XLSX from 'xlsx';
test('game locale codes resolve to readable existing language names',()=>{
 for(const [code,name] of [['en','English'],['en_US','English'],['ru','Russian'],['zh-TW','Traditional Chinese'],['pt-BR','Portuguese'],['ko','Korean']])assert.equal(gameLanguageName(code),name);
 for(const invalid of [null,'',0,{},'not supplied','<script>'])assert.equal(gameLanguageCode(invalid),null);
});
test('saved provider language becomes primary and preserves additional manual languages without mutation',()=>{
 const p={id:'a',languages:['Portuguese'],providerStats:{raw:{language:'en'},retrievedAt:'2026-10-20T00:00:00Z'}};
 const before=structuredClone(p),next=withGameLanguage(p);assert.deepEqual(p,before);assert.equal(next.gameLanguage,'en');assert.deepEqual(next.languages,['English','Portuguese']);assert.equal(withGameLanguage(next),next);
});
test('newest supplied source wins; language changes replace the previous game language',()=>{
 const p={gameLanguage:'en',languages:['English','Portuguese'],providerStats:{raw:{language:'en'},retrievedAt:'2026-10-20T00:00:00Z'},providerDetails:{raw:{player:{language:'ru'}},retrievedAt:'2026-10-21T00:00:00Z'}};
 assert.equal(providerField(p,'language'),'ru');assert.deepEqual(withGameLanguage(p).languages,['Russian','Portuguese']);
 const empty={...p,providerDetails:{raw:{player:{language:null}},retrievedAt:'2026-10-22T00:00:00Z'}};assert.equal(withGameLanguage(empty).gameLanguage,'en');
});
test('authenticated profile refresh persists the game setting through the existing merge path',()=>{
 const p={id:'stable',fid:'596099868',languages:['Portuguese'],notes:'Keep'};
 const r={retrieved_at:'2026-10-21T03:00:00Z',data:{chief_id:p.fid,player:{fid:p.fid,kid:3573,language:'en'}}};
 const next=applyPlayerDetails(p,r,'3573');assert.deepEqual(next.languages,['English','Portuguese']);assert.equal(next.gameLanguage,'en');assert.equal(next.id,'stable');assert.equal(next.notes,'Keep');
 const sheet=buildRosterDataSheet([next]),row=XLSX.utils.sheet_to_json(sheet)[0];assert.equal(row.gameLanguage,'en');
});
test('activity timestamps accept Unix seconds, milliseconds and explicit UTC ISO strings',()=>{
 const expected='2026-10-21T01:40:46.000Z';assert.equal(recordedTimestamp(1792546846),expected);assert.equal(recordedTimestamp('1792546846'),expected);assert.equal(recordedTimestamp(1792546846000),expected);assert.equal(recordedTimestamp(expected),expected);
 for(const invalid of [null,'Last active 1h ago',0,-1,Infinity,'invalid'])assert.equal(recordedTimestamp(invalid),null);
});
test('relative activity uses the recorded timestamp, handles future times and keeps UTC text',()=>{
 const t=1792546846000;
 assert.deepEqual(recordedActivity(1792546846,t+3720000),{iso:'2026-10-21T01:40:46.000Z',utc:'2026-10-21 01:40:46 UTC',relative:'1h 2m ago'});
 assert.equal(recordedActivity(t,t+90000000).relative,'1d 1h ago');assert.equal(recordedActivity(t,t-3600000).relative,'1h 0m in the future');assert.equal(recordedActivity(null),null);
});

test('rolling 72-hour membership review covers all alliances and survives manual acknowledgement',()=>{
 const now=Date.parse('2026-11-17T12:00:00Z');
 const p={allianceTag:'RKG',membershipStatus:'active',providerStats:{capturedAt:'2026-11-14T11:00:00Z'}};
 assert.equal(suspectedTransferOut(p,now),true);
 assert.equal(suspectedTransferOut({...p,allianceTag:'FARM'},now),true);
 assert.equal(suspectedTransferOut({...p,providerStats:{capturedAt:'2026-11-17T11:00:00Z'}},now),false);
 assert.equal(suspectedTransferOut({...p,providerStats:{}},now),true);
 assert.equal(suspectedTransferOut({...p,membershipStatus:'transferred_out'},now),false);
 assert.equal(suspectedTransferOut({...p,membershipReviewedAt:'2026-11-17T12:00:00Z'},now),true);
 for(const allianceTag of ['ARC','HOT','LUN'])assert.equal(suspectedTransferOut({...p,allianceTag},now),true);
});

test('main-alliance membership reconciles only after explicit complete roster',async()=>{
 const {reconcileAllianceMembership,mergeAllianceProfiles}=await import('../src/services/allianceImportService.js');
 const old={id:'old',fid:'594023568',username:'Example',allianceTag:'RKG',membershipStatus:'confirmed',allianceHistory:[]};
 const missing=reconcileAllianceMembership([old],[], 'RKG','2026-11-17T00:00:00Z')[0];
 assert.equal(missing.membershipStatus,'unverified');
 assert.equal(missing.allianceTag,'RKG');
 const rows=[{fid:'594023568',username:'Example',stateId:'3573',allianceTag:'MBT',retrievedAt:'2026-11-17T00:00:00Z',raw:{}}];
 const moved=mergeAllianceProfiles([missing],rows,'3573').players[0];
 assert.equal(moved.allianceTag,'MBT');
 assert.equal(moved.membershipStatus,'confirmed');
 assert.equal(moved.allianceHistory.at(-1).from,'RKG');
 assert.equal(moved.allianceHistory.at(-1).to,'MBT');
 const again=mergeAllianceProfiles([moved],rows,'3573').players[0];
 assert.equal(again.allianceHistory.length,1);
});

test('transfer location lookup accepts real numeric player IDs and rejects malformed FIDs',async()=>{
 const {validPlayerFid}=await import('../src/services/rosterViewService.js');
 for(const fid of ['609595807','821953994','596277993','764325708'])assert.equal(validPlayerFid(fid),true,fid);
 for(const fid of ['','abc','609595807x','0','000000000','123'])assert.equal(validPlayerFid(fid),false,fid);
});

test('transfer location button uses the shared FID validator and the visible roster ID fallback',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/components/players/RosterTab.jsx',import.meta.url),'utf8');
 const start=source.indexOf('async function checkLocation(player)');
 const end=source.indexOf('async function checkAllLocations()',start);
 assert.ok(start>=0&&end>start,'location lookup handler must exist');
 const handler=source.slice(start,end);
 assert.match(handler,/player\.fid\|\|player\.playerId\|\|player\.id/);
 assert.match(handler,/if\(!validPlayerFid\(fid\)\)/);
 assert.doesNotMatch(handler,/if\(!\/\^\[1-9\]/,'no duplicate local regex that can diverge from tested validation');
});

test('verified transfers are archived without deleting player data and returns restore existing profile',async()=>{
 const {archiveStateTransfer,restoreStateTransfer,eligibleFor3573Allocation}=await import('../src/services/rosterViewService.js');
 const original={id:'p1',fid:'609595807',username:'Example',allianceTag:'RKG',languages:['German','English'],troops:{infantry:'FC7'},allianceHistory:[{from:'ARC',to:'RKG',at:'2026-01-01'}],notes:'retain',membershipStatus:'active'};
 const away={status:'verified',state:'3588',tag:'ABC',at:'2026-11-17T00:00:00Z'};
 const archived=archiveStateTransfer(original,away,'2026-11-17T01:00:00Z');
 assert.equal(archived.membershipStatus,'transferred_out');
 assert.equal(archived.transferDestinationState,'3588');
 assert.equal(archived.lastKnownAlliance,'RKG');
 assert.equal(eligibleFor3573Allocation(archived),false);
 assert.deepEqual(archived.languages,original.languages);
 assert.deepEqual(archived.troops,original.troops);
 assert.equal(archived.notes,'retain');
 assert.throws(()=>archiveStateTransfer(original,{...away,state:'3573'}));
 const back=restoreStateTransfer(archived,{status:'verified',state:'3573',tag:'HOT',at:'2027-01-02T00:00:00Z'});
 assert.equal(back.fid,original.fid);
 assert.equal(back.membershipStatus,'active');
 assert.equal(back.allianceTag,'HOT');
 assert.equal(back.transferDestinationState,null);
 assert.equal(eligibleFor3573Allocation(back),true);
 assert.deepEqual(back.languages,original.languages);
 assert.equal(back.allianceHistory.at(-1).to,'HOT');
 assert.throws(()=>restoreStateTransfer(archived,away));
});

test('3573 active-player allocation and TAL under-development access are preserved',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../roster-site/src/site.jsx',import.meta.url),'utf8');
 assert.ok(source.includes("const activePlayers=players.filter(p=>p.membershipStatus!=='transferred_out')"));
 assert.ok(source.includes('<FoundryTab players={activePlayers}'));
 assert.ok(source.includes('Tundra Arms League under development'));
 assert.ok(!source.includes('<TalTab workspace='),'TAL editor is intentionally hidden');
 assert.ok(source.includes('value={data.talPlan}')===false,'TAL editor is not mounted');
 assert.ok(source.includes('talPlan:')||source.includes('data.talPlan'),'saved TAL data is still referenced');
 assert.ok(source.includes('players={activePlayers} plan={data.talPlan||newPlan()}'));

});

test('transferred-out archive is nested under More and confirmation requires verified external state',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/components/players/RosterTab.jsx',import.meta.url),'utf8');
 assert.ok(source.includes('Transferred out · {players.filter(isTransferred).length}'));
 assert.ok(source.includes("trackingView==='transferred'?isTransferred(p)&&matchesSearch(p)"));
 assert.ok(source.includes("disabled={!(locationChecks[p.id]?.status==='verified'&&locationChecks[p.id]?.state!=='3573')}"));
 assert.ok(source.includes("trackingView==='transferred'&&p.transferDestinationState"));
 assert.ok(source.includes("archiveStateTransfer(player,found)"));
 assert.ok(source.includes("applyVerifiedMembership(player,found)"));
});

test('3573 transfer lookup allows global player search while details stay state-bound',async()=>{
 const {readFileSync}=await import('node:fs');
 const route=readFileSync(new URL('../roster-site/api/lookup.js',import.meta.url),'utf8');
 const edge=readFileSync(new URL('../supabase/functions/caroline3573/index.ts',import.meta.url),'utf8');
 assert.ok(route.includes("'player_details','rankings','player'"));
 assert.ok(route.includes("input.action==='player'"));
 assert.ok(route.includes("body.fid=String(input.fid)"));
 assert.ok(edge.includes('"player_details", "player"'));
 assert.ok(edge.includes('include=base'));
 assert.ok(route.includes("input.action==='player_details'&&Number(input.state)!==3573"));
});
test('Events uses compact accessible rows and locks unavailable events',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../roster-site/src/site.jsx',import.meta.url),'utf8');
 assert.ok(source.includes("tab==='events'?'Events'"));
 assert.ok(source.includes("disabled={!available} aria-disabled={!available}"));
 assert.ok(source.includes("['castle','Castle Battle','Coming soon',false]"));
 assert.ok(source.includes("['canyon','Canyon Clash','Coming soon',false]"));
});

test('No alliance is a distinct roster filter and a verified same-state allocation',async()=>{
 const {readFileSync}=await import('node:fs');
 const roster=readFileSync(new URL('../src/components/players/RosterTab.jsx',import.meta.url),'utf8');
 const service=readFileSync(new URL('../src/services/rosterViewService.js',import.meta.url),'utf8');
 assert.ok(roster.includes("['__no_alliance','No alliance']"));
 assert.ok(roster.includes("'Confirm no alliance'"));
 assert.ok(service.includes("filters.alliance==='__no_alliance'"));
 const original={id:'123',allianceTag:'LUN',allianceHistory:[]};
 const {restoreStateTransfer}=await import('../src/services/rosterViewService.js');
 const updated=restoreStateTransfer(original,{status:'verified',state:'3573',tag:'',at:'2026-11-17T09:00:00Z'});
 assert.equal(updated.allianceTag,'');
 assert.equal(updated.lastKnownAlliance,'LUN');
 assert.equal(updated.membershipStatus,'active');
 assert.equal(updated.allianceHistory.at(-1).from,'LUN');
 assert.equal(updated.allianceHistory.at(-1).to,'');
});

test('incomplete player details cannot erase confirmed 3573 alliance',()=>{
 const p={id:'stable',fid:'596099868',allianceTag:'HOT',allianceRank:'R3',membershipStatus:'active',membershipObservedAt:'2026-11-17T00:00:00Z',allianceHistory:[]};
 const r={retrieved_at:'2026-11-20T00:00:00Z',data:{chief_id:p.fid,player:{fid:p.fid,kid:3573,alliance:null}}};
 const next=applyPlayerDetails(p,r,'3573');
 assert.equal(next.allianceTag,'HOT');
 assert.equal(next.allianceRank,'R3');
 assert.equal(next.membershipObservedAt,p.membershipObservedAt);
 assert.deepEqual(next.allianceHistory,[]);
});
test('verified explicit No Alliance in player details retains previous alliance history',()=>{
 const p={id:'stable',fid:'596099868',allianceTag:'HOT',membershipStatus:'active',membershipObservedAt:'2026-11-17T00:00:00Z',allianceHistory:[]};
 const at=new Date(Date.now()-3600000).toISOString();
 const r={retrieved_at:new Date().toISOString(),data:{fresh:true,chief_id:p.fid,player:{fid:p.fid,kid:3573,alliance:null,cached_at:at}}};
 const next=applyPlayerDetails(p,r,'3573');
 assert.equal(next.allianceTag,'');
 assert.equal(next.lastKnownAlliance,'HOT');
 assert.equal(next.allianceHistory.at(-1).from,'HOT');
 assert.equal(next.membershipLastSuccessfulAt,at);
});
