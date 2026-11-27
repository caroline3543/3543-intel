import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareScreenshotImport, screenshotMatches, createScreenshotMatcher } from '../roster-site/src/foundry/screenshotImportPlan.js';
import { accessContext, sessionToken } from '../roster-site/server/access.js';
import { plannerKey, plannerSlot, updateEventPlanner } from '../src/services/eventPlanner.js';

const setup = (kind, legion) => {
  const context = { kind, alliance: 'ARC', legion, expectedOccurrenceId: 'current' };
  const other = legion === 1 ? 2 : 1;
  const target = { ...plannerSlot(null, kind, 'ARC', legion), occurrenceId: 'current',
    registrations: { a: 'join' }, registeredUnder: { a: 'ARC' }, teams: { a: 'Blue' }, assignments: { a: 'Boiler' } };
  const source = { ...plannerSlot(null, kind, 'WAR', other), occurrenceId: 'source',
    registrations: { b: 'sub' }, registeredUnder: { b: 'WAR' } };
  const data = { players: [{ id:'a', username:'Alpha' }, { id:'b', username:'Bravo' }], foundry: { eventPlans: {
    [plannerKey(kind, 'ARC', legion)]: target, [plannerKey(kind, 'WAR', other)]: source,
  } } };
  return { context, data, other };
};

for (const kind of ['foundry', 'canyon']) for (const legion of [1, 2]) {
  test(`${kind} legion ${legion}: each import mode commits via the event planner`, () => {
    const { data, context, other } = setup(kind, legion);
    const read = (name = 'ARC', number = legion, workspace) => plannerSlot(workspace.foundry, kind, name, number);
    const importRows = (rows, mode) => prepareScreenshotImport(data.foundry, context, rows, mode);

    const powerOnly = importRows([{ id:'a', name:'Alpha', power:3500, role:'' }], 'powers');
    const a = updateEventPlanner(data, powerOnly.action);
    assert.equal(read('ARC', legion, a).powerByPlayer.a, 3500);
    assert.equal(read('ARC', legion, a).registrations.a, 'join');
    assert.equal(read('ARC', legion, a).assignments.a, 'Boiler');

    const rolesOnly = importRows([{ id:'b', name:'Bravo', power:3100, role:'join', alliance:'WAR' }], 'roles');
    assert.equal(rolesOnly.changes[0].destructive, true);
    assert.deepEqual(rolesOnly.changes[0].before, { alliance:'WAR', legion:other, role:'sub', occurrenceId:'source' });
    const b = updateEventPlanner(data, rolesOnly.action);
    assert.equal(read('WAR', other, b).registrations.b, undefined);
    assert.equal(read('ARC', legion, b).registrations.b, 'join');
    assert.equal(read('ARC', legion, b).powerByPlayer?.b, undefined);

    const both = importRows([{ id:'a', name:'Alpha', power:3500, role:'' }], 'both');
    assert.equal(both.changes.find(change => change.after).destructive, true);
    const c = updateEventPlanner(data, both.action);
    assert.equal(read('ARC', legion, c).powerByPlayer.a, 3500);
    assert.equal(read('ARC', legion, c).registrations.a, undefined);
    assert.equal(read('ARC', legion, c).assignments.a, undefined);

    assert.equal(updateEventPlanner(data, { ...both.action, expectedOccurrenceId:'stale' }), data);
    assert.equal(updateEventPlanner(data, { ...both.action, powers:[{id:'missing', value:3}] }), data);
    assert.equal(updateEventPlanner(data, { ...both.action, powers:[{id:'a', value:3}, {id:'a', value:4}] }), data);
    assert.match(importRows([{id:'a'}, {id:'a'}], 'roles').error, /once/);
    assert.equal(prepareScreenshotImport(data.foundry, {...context, expectedOccurrenceId:'old'}, [], 'both').action, undefined);
  });
}

test('roster changes reject transfers when the source no longer matches the approved move', () => {
  const { context, data, other } = setup('foundry', 1);
  const { action } = prepareScreenshotImport(data.foundry, context, [{ id:'b', name:'Bravo', power:50, role:'join' }], 'both');
  data.foundry.eventPlans[plannerKey('foundry','WAR',other)].registrations.b = 'join';
  assert.equal(updateEventPlanner(data, action), data);
});

test('registration limits reject the whole screenshot plan', () => {
  const { context, data } = setup('canyon', 1);
  const target = data.foundry.eventPlans[plannerKey('canyon', 'ARC', 1)];
  for (let i=0;i<29;i++) target.registrations['member-'+i]='join';
  assert.match(prepareScreenshotImport(data.foundry, context, [{ id:'b', power:50, role:'join' }], 'both').error, /30/);
});

test('safe screenshot matching separates same names, lookalikes and cross-alliance matches', () => {
  const players = [
    { id:'a', name:'낭만', searchFields:['José','나무늘보','風見','风之谷','ᴱcho', '763001234'], alliance:'ARC' },
    { id:'b', name:'J0sé', searchFields:['Alias'], alliance:'WAR' },
  ];
  for (const name of ['낭만', '나무늘보', '風見', '风之谷', 'ᴱcho', '763001234']) {
    assert.equal(screenshotMatches(name, players, 'ARC').player?.id, 'a');
  }
  assert.equal(screenshotMatches('Jose\u0301', players, 'ARC').player, null);
  assert.equal(screenshotMatches('Jose\u0301', [players[0]], 'ARC').player?.id, 'a');
  assert.equal(screenshotMatches('J0sé', players, 'ARC').player, null);
  assert.equal(screenshotMatches('Jose', players, 'ARC').player, null);
  assert.equal(screenshotMatches('José', [...players, { id:'c', name:'José', alliance:'HOT' }], 'ARC').player, null);
});

test('a Vercel preview rejects even a valid production session', () => {
  const env = { SESSION_SECRET:'s'.repeat(32), ACCESS_PASSWORD_HASH:'salt:hash' };
  const req = { headers:{ cookie:'__Host-caroline_access='+sessionToken(env) } };
  assert.ok(accessContext(req, { ...env, VERCEL_ENV:'production' }));
  assert.equal(accessContext(req, { ...env, VERCEL_ENV:'preview', VERCEL_GIT_COMMIT_REF:'fix/3573-ocr-upgrade' }), false);
  assert.equal(accessContext(req, { ...env, VERCEL:'1', VERCEL_GIT_COMMIT_REF:'fix/3573-ocr-upgrade' }), false);
});

for (const kind of ['foundry','canyon']) for (const legion of [1,2]) {
  test(`${kind} legion ${legion}: unusual power requires exact value approval`,()=>{
    const {data,context}=setup(kind,legion);
    const target=data.foundry.eventPlans[plannerKey(kind,'ARC',legion)];
    target.powerByPlayer={a:3647};
    const plan=(power,powerApproval,mode='powers')=>prepareScreenshotImport(data.foundry,context,[{id:'a',name:'Alpha',power,powerApproval,role:'sub'}],mode);
    assert.ok(plan(3650).action);
    assert.ok(plan(15630).action);
    for(const value of [36470,364,0,1520000000]){
      assert.match(plan(value).error,/unusually large/);
      assert.ok(plan(value,{previous:3647,next:value}).action);
      assert.match(plan(value,{previous:3647,next:value+1}).error,/unusually large/);
    }
    target.powerByPlayer.a=1520000000;
    assert.match(plan(3647,{previous:3647,next:3647}).error,/unusually large/);
    assert.ok(plan(3647,{previous:1520000000,next:3647}).action);
    assert.ok(plan(3647,undefined,'roles').action);
    delete target.powerByPlayer.a;
    assert.ok(plan(3647).action);
  });
}

test('screenshot import preserves other event powers and city power',()=>{
 const {data,context}=setup('foundry',1);
 Object.assign(data.players[0],{lastFoundryTroopPower:3630,lastCanyonClashTroopPower:946105130,lastTALTroopPower:12345,cityPower:987654321});
 const {action}=prepareScreenshotImport(data.foundry,context,[{id:'a',power:3647,previousPower:3630}],'powers');
 const saved=updateEventPlanner(data,action);
 assert.equal(saved.players[0].lastFoundryTroopPower,3647);
 for(const field of ['lastCanyonClashTroopPower','lastTALTroopPower','cityPower'])assert.equal(saved.players[0][field],data.players[0][field]);
});

test('stale suspicious power approval rejects combined import atomically',()=>{
 const {data,context}=setup('foundry',1);
 const slot=data.foundry.eventPlans[plannerKey('foundry','ARC',1)];
 slot.powerByPlayer={a:3647};
 const {action}=prepareScreenshotImport(data.foundry,context,[{id:'a',power:40000,powerApproval:{previous:3647,next:40000},role:'sub'}],'both');
 assert.ok(action);
 assert.equal(updateEventPlanner(data,{...action,powers:[{id:'a',value:40000}]}),data);
 slot.powerByPlayer.a=3800;
 assert.equal(updateEventPlanner(data,action),data);
 assert.equal(slot.registrations.a,'join');
});
test('Canyon import preserves Foundry, TAL and city power',()=>{
 const {data,context}=setup('canyon',2);
 Object.assign(data.players[0],{lastFoundryTroopPower:3630,lastCanyonClashTroopPower:946105130,lastTALTroopPower:12345,cityPower:987654321});
 const {action}=prepareScreenshotImport(data.foundry,context,[{id:'a',power:950000000,previousPower:946105130}],'powers');
 const saved=updateEventPlanner(data,action);
 assert.equal(saved.players[0].lastCanyonClashTroopPower,950000000);
 for(const field of ['lastFoundryTroopPower','lastTALTroopPower','cityPower'])assert.equal(saved.players[0][field],data.players[0][field]);
});

test('OCR exact names cannot bypass roster-wide normalized identity collisions',()=>{
 const a={id:'a',name:'Panda',alliance:'HOT'};
 for(const b of [
  {id:'b',name:'ＰＡＮＤＡ',alliance:'ARC'},
  {id:'b',name:'Panda!',alliance:'HOT'},
  {id:'b',name:'Different',searchFields:['P A N D A'],alliance:'HOT'},
  {id:'b',name:'Pánda',alliance:'RKG'}
 ]){
  const match=screenshotMatches('Panda',[a,b],'HOT');
  assert.equal(match.player,null);
  assert.ok(match.candidates.some(p=>p.id==='a'));
  assert.ok(match.candidates.some(p=>p.id==='b'));
 }
 assert.equal(screenshotMatches('Panda',[a],'HOT').player?.id,'a');
 assert.equal(screenshotMatches('ＰＡＮＤＡ',[a],'HOT').player?.id,'a');
 assert.equal(screenshotMatches('Panda',[a],'ARC').player,null);
 assert.equal(createScreenshotMatcher([a],'ARC',['a'])('Panda').player?.id,'a');
 assert.equal(createScreenshotMatcher([a],'ARC',[],['a'])('Panda').player?.id,'a');
 assert.ok(screenshotMatches('Panda',[a],'ARC').candidates.some(p=>p.id==='a'));
});

test('OCR spacing and case equivalence requires a unique collision-free identity',()=>{
 const a={id:'a',name:'abdツ',alliance:'HOT'}, b={id:'b',name:'E I G H T',alliance:'HOT'};
 assert.equal(screenshotMatches('abd ツ',[a,b],'HOT').player?.id,'a');
 assert.equal(screenshotMatches('eight',[a,b],'HOT').player?.id,'b');
 assert.equal(screenshotMatches('EIGHT',[a,b,{id:'c',name:'Eight',alliance:'ARC'}],'HOT').player,null);
 assert.equal(screenshotMatches('an',[{id:'x',name:'XAVI',alliance:'HOT'}],'HOT').player,null);
});

test('real screenshot examples match unique current HOT usernames without unnecessary review',()=>{
 const examples=[['Crazy Joe','Crazy Joe'],['Black Jack','Black Jack'],['Armenia_2025','Armenia_2025'],['강 인 ㅇ _ ㅇ','강인ㅇ_ㅇ'],['나 다 나 다','나다나다'],['abd ツ','abdツ']];
 const roster=examples.map(([,name],i)=>({id:String(i),name,alliance:'HOT'}));
 roster.push({id:'davy',name:'Davy',alliance:'ARC',searchFields:['Armenia_2025','Crazy Joe','Black Jack']});
 const match=createScreenshotMatcher(roster,'HOT');
 for(const [i,[reading]] of examples.entries())assert.equal(match(reading).player?.id,String(i),reading);
 assert.equal(createScreenshotMatcher([...roster,{id:'duplicate',name:'Crazy Joe',alliance:'ARC'}],'HOT')('Crazy Joe').player,null);
 assert.equal(createScreenshotMatcher(roster,'HOT',['davy'])('Armenia_2025').player,null);
 assert.equal(createScreenshotMatcher([...roster,{id:'similar',name:'Black Jack!',alliance:'ARC'}],'HOT')('Black Jack').player,null);
 assert.equal(match('Crazy J0e').player,null);
});

 test('registration proposals are exception-only and preserve explicit overrides',async()=>{const {proposeScreenshotRegistration:p}=await import('../roster-site/src/foundry/screenshotImportPlan.js');const base={player:{id:'a',alliance:'HOT'},alliance:'HOT',mode:'both'};const check=(registration,extra={})=>p({...base,row:{registration},...extra});assert.deepEqual(check('combatant'),{proposedRole:'join',registrationPending:false});assert.deepEqual(check('substitute'),{proposedRole:'sub',registrationPending:false});assert.deepEqual(check('other-legion'),{proposedRole:null,registrationPending:false});assert.equal(check('combatant',{elsewhere:true}).registrationPending,true);assert.equal(check('substitute',{here:'join'}).registrationPending,true);assert.equal(check('combatant',{player:{id:'b',alliance:'ARC'}}).registrationPending,true);assert.equal(check('combatant',{row:{registration:'combatant',conflict:true}}).registrationPending,true);assert.deepEqual(check('combatant',{edit:{role:'',registrationReviewed:true}}),{proposedRole:null,registrationPending:false});});

for(const kind of ['foundry','canyon']) for(const [registration,role,limit] of [['combatant','join',30],['substitute','sub',10]]) test(kind+' automatic '+registration+' proposals respect capacity atomically',async()=>{const {proposeScreenshotRegistration:p}=await import('../roster-site/src/foundry/screenshotImportPlan.js');const {data,context}=setup(kind,1);const target=data.foundry.eventPlans[plannerKey(kind,'ARC',1)];target.registrations={};for(let i=0;i<limit;i++)target.registrations['member-'+i]=role;const proposal=p({row:{registration},player:{id:'b',alliance:'ARC'},alliance:'ARC',mode:'both'});assert.equal(proposal.proposedRole,role);const before=JSON.stringify(data);const result=prepareScreenshotImport(data.foundry,context,[{id:'b',power:50,role:proposal.proposedRole}],'both');assert.ok(result.error);assert.equal(result.action,undefined);assert.equal(JSON.stringify(data),before);});

 test('current username cannot override a conflicting nickname in another alliance',()=>{
 const a={id:'a',name:'Plain Name',alliance:'HOT'};
 for(const nickname of ['Plain Name','Ｐｌａｉｎ Ｎａｍｅ','PlainName','Plain Nâme']){
 const b={id:'b',name:'Other Name',nickname,alliance:'ARC'};
 assert.equal(createScreenshotMatcher([a,b],'HOT')('Plain Name').player,null,nickname);
 }
 assert.equal(createScreenshotMatcher([a,{id:'b',name:'Other Name',searchFields:['Plain Name'],alliance:'ARC'}],'HOT')('Plain Name').player?.id,'a');
 });

 test('remembered OCR aliases resolve repeated imports and preserve collision protection',()=>{
 const a={id:'a',name:'HΞRMΞS',alliance:'HOT',nickname:'Hermes',ocrAliases:['HER MES','HERMΞS']};
 for(const reading of ['HERMES','HER MES','HERMΞS'])assert.equal(createScreenshotMatcher([a],'HOT')(reading).player?.id,'a');
 const b={id:'b',name:'Other',alliance:'ARC',ocrAliases:['HERMES']};
 assert.equal(createScreenshotMatcher([a,b],'HOT')('HERMES').player,null);
 assert.equal(createScreenshotMatcher([{...a,name:'New username'}],'HOT')('HER MES').player?.id,'a');
 });
