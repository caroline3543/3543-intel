import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareScreenshotImport, screenshotMatches } from '../roster-site/src/foundry/screenshotImportPlan.js';
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
  for (const name of ['낭만', 'Jose\u0301', '나무늘보', '風見', '风之谷', 'ᴱcho', '763001234']) {
    assert.equal(screenshotMatches(name, players, 'ARC').player?.id, 'a');
  }
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
