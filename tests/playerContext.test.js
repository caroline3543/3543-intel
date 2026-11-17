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

test('three-day stale API signal only flags unreviewed main-alliance players',()=>{
 const now=Date.parse('2026-11-17T12:00:00Z');
 const p={allianceTag:'RKG',membershipStatus:'active',providerStats:{retrievedAt:'2026-11-14T12:00:00Z'}};
 assert.equal(suspectedTransferOut(p,now),true);
 assert.equal(suspectedTransferOut({...p,allianceTag:'FARM'},now),false);
 assert.equal(suspectedTransferOut({...p,providerStats:{retrievedAt:'2026-11-15T12:00:00Z'}},now),false);
 assert.equal(suspectedTransferOut({...p,providerStats:{}},now),false);
 assert.equal(suspectedTransferOut({...p,membershipStatus:'transferred_out'},now),false);
 assert.equal(suspectedTransferOut({...p,membershipReviewedAt:'2026-11-16T12:00:00Z'},now),false);
 assert.equal(suspectedTransferOut({...p,membershipReviewedAt:'2026-11-13T12:00:00Z'},now),true);
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

test('3573 team allocation components receive active players only',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../roster-site/src/site.jsx',import.meta.url),'utf8');
 assert.ok(source.includes("const activePlayers=players.filter(p=>p.membershipStatus!=='transferred_out')"));
 assert.ok(source.includes('<FoundryTab players={activePlayers}'));
 assert.ok(source.includes('<TalTab workspace={{...data,players:activePlayers}} value={data.talPlan} players={activePlayers}'));
 assert.ok(source.includes('players={activePlayers} plan={data.talPlan}'));

});

test('transferred-out archive is nested under More and confirmation requires verified external state',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/components/players/RosterTab.jsx',import.meta.url),'utf8');
 assert.ok(source.includes('Transferred out · {players.filter(isTransferred).length}'));
 assert.ok(source.includes("trackingView==='transferred'?isTransferred(p)&&matchesSearch(p)"));
 assert.ok(source.includes("disabled={!(locationChecks[p.id]?.status==='verified'&&locationChecks[p.id]?.state!=='3573')}"));
 assert.ok(source.includes("trackingView==='transferred'&&p.transferDestinationState"));
 assert.ok(source.includes("archiveStateTransfer(player,found)"));
 assert.ok(source.includes("restoreStateTransfer(player,found)"));
});
