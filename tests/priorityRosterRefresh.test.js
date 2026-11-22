import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePriorityRefresh} from '../roster-site/server/priorityRosterRefresh.js';
import {PRIORITY_ALLIANCES} from '../src/services/state3573Alliances.js';

const now = Date.parse('2026-11-22T20:00:00Z');
const asOf = new Date(now - 1000).toISOString();
const roster = (tag, ids) => ({data:{
  ok:true, fresh:true, kid:3573, tag, cached_at:asOf,
  alliance:{kid:3573,abbr:tag,count:ids.length},
  members:ids.map(fid => ({chief_id:fid,kid:3573,nick_name:'Player '+fid}))
}});
const player = (fid, allianceTag, extra={}) => ({id:fid,fid,allianceTag,notes:'Preserve',...extra});

test('priority refresh follows confirmed roster sightings and queues only unmatched absences', () => {
  const players=[
    player('1001','ARC'),player('1002','ARC'),player('1003','WAR'),
    player('1004','FARM'),player('1005',''),player('1006','HOT',{membershipStatus:'transferred_out'}),
    player('1007','LUN',{manualMembershipAt:new Date(now).toISOString()})
  ];
  const responses=new Map([
    ['ARC',roster('ARC',[])],['HOT',roster('HOT',['1001','1006','1008'])],
    ['RKG',roster('RKG',[])],['LUN',roster('LUN',[])],['FARM',roster('FARM',['1002'])]
  ]);
  const result=preparePriorityRefresh({players,settings:{}},responses,now);
  assert.deepEqual(result.succeeded,['ARC','HOT','RKG','LUN']);
  assert.deepEqual(result.unavailable,['WAR']);
  assert.deepEqual(result.missing,['1002']);
  assert.equal(result.workspace.players[0].allianceTag,'HOT');
  assert.equal(result.workspace.players[0].membershipLastSuccessfulAt,asOf);
  assert.equal(result.workspace.players[0].notes,'Preserve');
  assert.equal(result.workspace.players[5].membershipStatus,'transferred_out');
  assert.ok(result.workspace.players.some(p=>p.fid==='1008'));
});

test('missing, stale, partial or duplicate evidence cannot justify an unverified roster change', () => {
  const players=[player('1001','ARC'),player('1002','RKG'),player('1003','WAR')];
  const responses=new Map(PRIORITY_ALLIANCES.map(tag=>[tag,roster(tag,[])]));
  responses.get('ARC').data.fresh=false;
  responses.get('RKG').data.alliance.count=1;
  responses.set('HOT',roster('HOT',['1003']));
  responses.set('LUN',roster('LUN',['1003']));
  const result=preparePriorityRefresh({players},responses,now);
  assert.deepEqual(result.unavailable,['ARC','RKG']);
  assert.deepEqual(result.missing,[]);
  assert.deepEqual(result.workspace.players,players);
});

test('quick button requests exactly five lists and saves only the targeted candidates', async () => {
  const {default:handle}=await import('../roster-site/api/priority-roster-refresh.js');
  const {sessionToken}=await import('../roster-site/server/access.js');
  const host='fixture.example';
  const config={SESSION_SECRET:'isolated-roster-refresh-test-secret-long-enough',ACCESS_PASSWORD_HASH:'fixture:hash',
    GAME_API_URL:'https://isolated-fixture.invalid',GAME_API_PUBLIC_KEY:'fixture',
    GAME_SITE_TOKEN:'fixture',VERCEL_ENV:'preview',STATE_3573_PREVIEW_API_ORIGIN:'https://isolated-fixture.invalid'};
  const originals=Object.fromEntries(Object.keys(config).map(key=>[key,process.env[key]]));
  const originalFetch=globalThis.fetch;
  const calls=[];
  let saved;
  Object.assign(process.env,config);
  try {
    globalThis.fetch=async (_url, options)=>{
      const input=JSON.parse(options.body);
      calls.push(input.action==='alliance'?input.tag:input.action);
      if(input.action==='read')return Response.json({revision:2,data:{players:[
        player('1001','ARC'),player('1002','ARC'),player('1003','FARM')
      ]}});
      if(input.action==='priority-roster-refresh'){
        saved=input;
        return Response.json({queued:input.missing.length});
      }
      const body=roster(input.tag,input.tag==='HOT'?['1002']:[]);
      body.data.cached_at=new Date(Date.now()-1000).toISOString();
      return Response.json(body);
    };
    const res={status(code){this.code=code;return this;},setHeader(){},json(body){return {status:this.code,body};}};
    const result=await handle({method:'POST',headers:{host,origin:'https://'+host,cookie:'__Host-caroline_access='+sessionToken(config)}},res);
    assert.deepEqual(calls,['read',...PRIORITY_ALLIANCES,'priority-roster-refresh']);
    assert.deepEqual(saved.missing,['1001']);
    assert.equal(saved.data.players[1].allianceTag,'HOT');
    assert.deepEqual(result,{status:200,body:{succeeded:PRIORITY_ALLIANCES,unavailable:[],found:1,missing:1,queued:1}});
  } finally {
    globalThis.fetch=originalFetch;
    for(const [key,value] of Object.entries(originals)){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});
