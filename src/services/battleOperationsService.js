// Live Room uses epoch seconds. Do not mix with command draft milliseconds.
export const CLOSED = ['Completed', 'Failed', 'Cancelled'];
export function resolveBattleTimers(timers) {
  const map = new Map(timers.map(t => [t.id,t])), done = new Map(), visiting = new Set();
  function visit(id) {
    if(done.has(id)) return done.get(id);
    const t=map.get(id);
    if(!t || visiting.has(id)) throw Error('Missing or circular timer link');
    visiting.add(id);
    const parent=t.dependency?.mode==='relative'?visit(t.dependency.parentId):null;
    const base=parent?.actualImpactAtUtc??parent?.impactAtUtc;
    const impactAtUtc=parent?base+t.dependency.offsetSecs:t.impactAtUtc;
    if(parent && !Number.isFinite(impactAtUtc)) throw Error('Linked timer needs an impact time');
    const shift=parent?impactAtUtc-t.impactAtUtc:0;
    const openRallyAtUtc=t.openRallyAtUtc==null?null:t.openRallyAtUtc+shift;
    const marchesAtUtc=t.marchesAtUtc==null?null:t.marchesAtUtc+shift;
    const captureHold=!!parent?.captureHold || !!t.captureDependent && (!parent || parent.outcome!=='captured' || parent.review || CLOSED.includes(parent.status) && parent.status!=='Completed');
    const result={...t,status:t.status||'Planned',impactAtUtc,openRallyAtUtc,marchesAtUtc,captureHold,review:!!t.review||!!parent?.review};
    visiting.delete(id);done.set(id,result);return result;
  }
  return timers.map(t=>visit(t.id));
}
export function editBattleTimer(timers, timer) {
  const old=timers.find(t=>t.id===timer.id);
  if(old?.dependency?.mode==='relative' && timer.impactAtUtc!==old.impactAtUtc && timer.dependency?.mode==='relative'){
    const parent=resolveBattleTimers(timers).find(t=>t.id===timer.dependency.parentId);
    timer={...timer,dependency:{...timer.dependency,offsetSecs:timer.impactAtUtc-(parent.actualImpactAtUtc??parent.impactAtUtc)}};
  }
  let next=timers.some(t=>t.id===timer.id)?timers.map(t=>t.id===timer.id?timer:t):[...timers,timer];
  if(old?.enemy && (old.impactAtUtc!==timer.impactAtUtc || old.actualImpactAtUtc!==timer.actualImpactAtUtc)) next=next.map(t=>t.sequenceId===old.sequenceId?{...t,review:true}:t);
  return resolveBattleTimers(next).map(({captureHold,...t})=>t);
}
export const timerActionAt = t => t.status==='Opened' || t.status==='Reported' || t.status==='Confirmed' ? t.impactAtUtc : (t.openRallyAtUtc??t.impactAtUtc);
export function battleConflicts(timers) {
  const active=timers.filter(t=>!CLOSED.includes(t.status));
  return active.flatMap((a,i)=>active.slice(i+1).filter(b=> (a.leaderId && a.leaderId===b.leaderId || !a.leaderId && a.leaderName && a.leaderName===b.leaderName) && Math.max(a.openRallyAtUtc??a.impactAtUtc,b.openRallyAtUtc??b.impactAtUtc)<=Math.min(a.impactAtUtc,b.impactAtUtc)).map(b=>`${a.leaderName}: ${a.rallyType} conflicts with ${b.rallyType}`));
}
export function battleCallout(t, format, templates={}) {
  if(t.status==='Failed' || t.outcome==='failed') return '❌ Counter failed. Hold switching sequence. Await revised orders.';
  if(t.review || t.captureHold) return `HOLD · ${t.leaderName||t.rallyType}. Capture or timing requires review.`;
  if(t.status==='Cancelled') return `CANCELLED · ${t.leaderName||t.rallyType}. Hold action.`;
  const evidence=t.actualImpactAtUtc!=null?'CONFIRMED':t.status==='Reported'?'REPORTED':'PLANNED';
  const kind=t.enemy?'enemy':t.rallyType==='Garrison Entry'?'garrison':t.rallyType==='Reinforcement'?'reinforcement':'rally';
  const defaults={enemy:'🚨 Enemy follow-up at {impact} UTC. Confirm garrison.',garrison:'🏰 {name}: enter at {action} UTC. Backup standby.',reinforcement:'🏰 {name}: reinforce at {action} UTC.',rally:'⚔️ {name}: open {type} at {action} UTC.'};
  const text=(templates[kind]||defaults[kind]).replaceAll('{name}',t.leaderName||'Unassigned').replaceAll('{type}',t.rallyType).replaceAll('{action}',format(timerActionAt(t))).replaceAll('{impact}',format(t.actualImpactAtUtc??t.impactAtUtc));
  return `${evidence} · ${text}`;
}
export function leadersFromPlan(plan, registry, players) {
  return (plan.rallySlots||[]).filter(s=>s.leaderName).map(s=>{
    const member=players.find(p=>p.id===s.leaderId);
    const saved=registry.find(r=>s.leaderId && r.playerId===s.leaderId || r.name===s.leaderName);
    return {id:s.id,slotId:s.id,playerId:s.leaderId,registryId:saved?.id||s.leaderId,name:s.leaderName,type:s.type||'Main Rally',target:s.target,
      marchSecs:saved?.marchSecs??member?.leaderProfile?.marchTime??null,rallyDuration:s.rallyDuration||3,offset:0,offsetConvention:'later',notes:s.notes||'',joiners:s.joiners||[],ratio:s.ratio||'',leadHeroes:s.leaderRallyHeroes||[]};
  });
}
export function importCommandBattle(battle, profiles) {
  const kinds={Rally:'Counter Rally',Garrison:'Garrison Entry',Enemy:'Counter-Counter',Reinforcement:'Reinforcement',Custom:'Custom'};
  const timers=(battle.events||[]).map(e=>({id:`command:${e.id}`,sequenceId:`command:${battle.id}`,leaderId:e.playerId,leaderName:profiles.find(p=>p.id===e.playerId)?.name||e.name,rallyType:kinds[e.type]||'Custom',enemy:e.type==='Enemy',impactAtUtc:e.plannedAt/1000,openRallyAtUtc:e.startAt==null?null:e.startAt/1000,actualImpactAtUtc:e.actualAt==null?null:e.actualAt/1000,status:e.status==='Launched'?'Opened':e.status||'Planned',notes:e.name,review:true,captureDependent:e.captureDependent,dependency:e.dependency?.mode==='relative'?{mode:'relative',parentId:`command:${e.dependency.parentId}`,offsetSecs:e.dependency.offsetSeconds}:{mode:'fixed'}}));
  return resolveBattleTimers(timers);
}
