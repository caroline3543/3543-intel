import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTalRallyDraft, troopTargets, normaliseRatio, hasNorah } from '../src/services/talRallyTeamGenerator.js';

function player(id, counts={}, { leader=false, march=200, rally=400, heroes=[] }={}) {
  return {
    id, username:id, marchCapacity:march, leaderProfile:{role:leader?'leader':'none',rallyCapacity:rally},
    joinerHeroes:heroes,
    talTroopInventory:Object.fromEntries(['infantry','lancer','marksman'].map(type=>[type,{
      t11:counts[type]?.t11 ?? 0,t10:counts[type]?.t10 ?? 0
    }]))
  };
}
const make=(players,settings={})=>generateTalRallyDraft({
  team:{id:'HOT:1',matchTime:'19:00',members:players.map(p=>({id:p.id,role:'combatant'}))},
  config:{},players,event:{},settings:{teamCount:1,ratio:[50,0,50],...settings}
}).teams[0];
test('validates ratio and deterministic integer rounding',()=>{
  assert.deepEqual(troopTargets(7,[33.33,33.33,33.34]),{infantry:2,lancer:2,marksman:3});
  assert.throws(()=>normaliseRatio([50,40,50]),/totalling 100/);
});
test('50-0-50 combines Infantry and Marksman specialists without Lancers',()=>{
  const a=make([
    player('lead',{infantry:{t11:100},marksman:{t11:100}},{leader:true}),
    player('inf',{infantry:{t11:200}}),
    player('mar',{marksman:{t11:200}})
  ]);
  assert.equal(a.status,'confirmed-full');
  assert.equal(a.fill,400);
  assert.equal(a.players.reduce((s,p)=>s+p.troops.lancer.t11+p.troops.lancer.t10,0),0);
});
test('prioritises available T11 joiners before fallback T10 joiners',()=>{
  const a=make([
    player('lead',{infantry:{t11:100},marksman:{t11:100}},{leader:true}),
    player('t10',{infantry:{t10:100},marksman:{t10:100}}),
    player('t11',{infantry:{t11:100},marksman:{t11:100}})
  ]);
  assert.equal(a.fill,400);
  assert.equal(a.players.reduce((s,p)=>s+p.troops.infantry.t10+p.troops.marksman.t10,0),0);
});
test('uses T10 when recorded T11 is inadequate',()=>{
  const a=make([
    player('lead',{infantry:{t11:100},marksman:{t11:100}},{leader:true}),
    player('joiner',{infantry:{t10:100},marksman:{t10:100}})
  ]);
  assert.equal(a.status,'confirmed-full');
  assert.equal(a.players[1].troops.infantry.t10,100);
});
test('unknown inventories are estimated, never treated as confirmed T11',()=>{
  const lead=player('lead',{infantry:{t11:100},marksman:{t11:100}},{leader:true});
  const joiner=player('unknown',{},{});joiner.talTroopInventory={};
  const a=make([lead,joiner]);
  assert.equal(a.status,'estimated-full');
  assert.equal(a.players[1].troops.infantry.t11,0);
  assert.equal(a.players[1].estimated,true);
});
test('rallies lacking leader contribution require review',()=>{
  const a=make([player('lead',{}, {leader:true}),player('i',{infantry:{t11:200}}),player('m',{marksman:{t11:200}})]);
  assert.equal(a.status,'needs-review');
});
test('never exceeds individual march and rally limits or reuses joiners across teams',()=>{
  const players=[
    player('L1',{infantry:{t11:100},marksman:{t11:100}},{leader:true}),
    player('L2',{infantry:{t11:100},marksman:{t11:100}},{leader:true}),
    player('J',{infantry:{t11:1000},marksman:{t11:1000}},{march:200})
  ];
  const draft=generateTalRallyDraft({team:{id:'HOT:1',matchTime:'19:00',members:players.map(p=>({id:p.id,role:'combatant'}))},config:{},players,event:{},settings:{teamCount:2,ratio:[50,0,50]}});
  const joined=draft.teams.flatMap(t=>t.players.filter(p=>p.id==='J'));
  assert.ok(joined.length<=1);
  for(const t of draft.teams){
    assert.ok(t.fill<=t.capacity);
    for(const p of t.players) assert.ok(p.total<=p.marchCapacity);
  }
});
test('Norah identification works for manually confirmed heroes',()=>{
  assert.equal(hasNorah({joinerHeroes:[{hero:'Norah',skillLevel:5,verified:true}]}),true);
});

test('balanced mode distributes joiners across two rallies',()=>{
  const players=[
    player('L1',{infantry:{t11:50},marksman:{t11:50}},{leader:true}),
    player('L2',{infantry:{t11:50},marksman:{t11:50}},{leader:true}),
    player('J1',{infantry:{t11:200},marksman:{t11:0}}),
    player('J2',{infantry:{t11:0},marksman:{t11:200}}),
    player('J3',{infantry:{t11:200},marksman:{t11:0}}),
    player('J4',{infantry:{t11:0},marksman:{t11:200}})
  ];
  const draft=generateTalRallyDraft({
    team:{id:'HOT:1',matchTime:'19:00',members:players.map(p=>({id:p.id,role:'combatant'}))},
    config:{},players,event:{},settings:{teamCount:2,mode:'balanced',ratio:[50,0,50]}
  });
  assert.equal(draft.mode,'balanced');
  assert.equal(draft.teams.length,2);
  assert.ok(draft.teams.every(t=>t.players.filter(p=>!p.leader).length>0));
  const used=draft.teams.flatMap(t=>t.players.map(p=>p.id));
  assert.equal(used.length,new Set(used).size);
});
test('partial match-day tier override preserves other profile tiers and does not mutate profile',()=>{
  const lead=player('lead',{infantry:{t11:100},marksman:{t11:100}},{leader:true});
  const joiner=player('joiner',{infantry:{t11:100,t10:50},marksman:{t11:100,t10:50}});
  const team={id:'HOT:1',matchTime:'19:00',members:[lead,joiner].map(p=>({id:p.id,role:'combatant'}))};
  const draft=generateTalRallyDraft({
    team,players:[lead,joiner],event:{},config:{},
    overrides:{joiner:{troopInventory:{infantry:{t11:0}}}},
    settings:{teamCount:1,ratio:[50,0,50]}
  });
  const allocation=draft.teams[0].players.find(p=>p.id==='joiner');
  assert.equal(allocation.troops.infantry.t11,0);
  assert.equal(allocation.troops.infantry.t10,50);
  assert.equal(joiner.talTroopInventory.infantry.t11,100);
});
test('match-day march capacity override caps troop contribution',()=>{
  const lead=player('lead',{infantry:{t11:100},marksman:{t11:100}},{leader:true});
  const joiner=player('joiner',{infantry:{t11:200},marksman:{t11:200}});
  const draft=generateTalRallyDraft({
    team:{id:'HOT:1',matchTime:'19:00',members:[lead,joiner].map(p=>({id:p.id,role:'combatant'}))},
    players:[lead,joiner],config:{},event:{},
    overrides:{joiner:{marchCapacity:50}},
    settings:{teamCount:1,ratio:[50,0,50]}
  });
  const allocation=draft.teams[0].players.find(p=>p.id==='joiner');
  assert.equal(allocation.total,50);
  assert.equal(draft.teams[0].fill,250);
  assert.equal(joiner.marchCapacity,200);
});
test('team count cannot exceed eight',()=>{
  const participants=Array.from({length:10},(_,i)=>player('L'+i,{infantry:{t11:100},marksman:{t11:100}},{leader:true}));
  const draft=generateTalRallyDraft({
    team:{id:'HOT:1',matchTime:'19:00',members:participants.map(p=>({id:p.id,role:'combatant'}))},
    players:participants,config:{},event:{},settings:{teamCount:20}
  });
  assert.equal(draft.teams.length,8);
});
test('explicit non-attending players are excluded',()=>{
  const lead=player('lead',{infantry:{t11:100},marksman:{t11:100}},{leader:true});
  const joiner=player('joiner',{infantry:{t11:100},marksman:{t11:100}});
  const draft=generateTalRallyDraft({
    team:{id:'HOT:1',matchTime:'19:00',members:[lead,joiner].map(p=>({id:p.id,role:'combatant'})),battleAttendance:{joiner:'not-attending'}},
    players:[lead,joiner],config:{},event:{},settings:{teamCount:1}
  });
  assert.ok(!draft.teams[0].players.some(p=>p.id==='joiner'));
});

test('explicit zero troop counts are not treated as unknown capacity',()=>{
  const lead=player('lead',{infantry:{t11:100},marksman:{t11:100}},{leader:true});
  const zero=player('zero',{infantry:{t11:0,t10:0},marksman:{t11:0,t10:0}});
  const draft=generateTalRallyDraft({team:{id:'HOT:1',matchTime:'19:00',members:[lead,zero].map(p=>({id:p.id,role:'combatant'}))},config:{},players:[lead,zero],event:{},settings:{teamCount:1,ratio:[50,0,50]}});
  assert.equal(draft.teams[0].fill,200);
  assert.equal(draft.teams[0].estimated,false);
  assert.ok(!draft.teams[0].players.some(p=>p.id==='zero'));
});
test('rally leader profile rally-capacity override affects targets and fill',()=>{
  const lead=player('lead',{infantry:{t11:200},marksman:{t11:200}},{leader:true,march:400,rally:400});
  const draft=generateTalRallyDraft({team:{id:'HOT:1',matchTime:'19:00',members:[{id:'lead',role:'combatant'}]},config:{},players:[lead],event:{},settings:{ratio:[50,0,50]},overrides:{lead:{rallyCapacity:200}}});
  assert.equal(draft.teams[0].capacity,200);
  assert.deepEqual(draft.teams[0].targets,{infantry:100,lancer:0,marksman:100});
  assert.equal(draft.teams[0].fill,200);
  assert.equal(lead.leaderProfile.rallyCapacity,400);
});
