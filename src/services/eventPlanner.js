export const EVENT_NAMES = {foundry:'Foundry', canyon:'Canyon Clash'};
const FOUNDRY_LIMITS = Object.freeze({join:30,sub:10});
export const EVENT_LIMITS = Object.freeze({foundry:FOUNDRY_LIMITS,canyon:FOUNDRY_LIMITS,tal:Object.freeze({join:30,sub:20})});
export const isParticipant = role => role==='join'||role==='sub';
export const REGISTRATION_ROLES = [['join','Combatant'], ['sub','Substitute'], ['out','Not participating']];
export const ATTENDANCE_RESULTS = [['attended','Attended'], ['excused','Excused absence'], ['no-show','No-show'], ['not-called','Not called up']];
export const TEAM_NAMES = ['Blue','Yellow','Green','Pink','Purple','Teal'];
const HOUR = 3_600_000;
const priority = ['ARC','HOT','RKG','WAR'];

export function plannerAlliances(tags) {
  const unique = [...new Set(tags)].filter(tag=>tag && tag!=='Unassigned');
  return [...priority,...unique.filter(tag=>!priority.includes(tag)).sort((a,b)=>a.localeCompare(b))];
}
export const plannerKey = (kind, alliance, legion) => JSON.stringify([kind,alliance,legion]);

export function plannerSlot(storage,kind,alliance,legion) {
  const key = plannerKey(kind,alliance,legion);
  const saved = storage?.eventPlans?.[key];
  if(saved) return saved;
  const base = {occurrenceId:key, teamCount:4, registrations:{},registeredUnder:{},teams:{},assignments:{}};
  if(kind!=='foundry'||legion!==1||!storage)return base;
  const ids = Object.keys(storage.registrations||{}).filter(id=>storage.registeredUnder?.[id]===alliance && storage.registrations[id]);
  const pick = fields => Object.fromEntries(ids.filter(id=>fields?.[id]!=null).map(id=>[id,fields[id]]));
  const teams = Object.fromEntries(Object.entries(pick(storage.teams)).filter(([id,team])=>
    storage.registrations[id]==='join'&&TEAM_NAMES.slice(0,4).includes(team)));
  const assignments = Object.fromEntries(Object.entries(pick(storage.assignments)).filter(([id])=>teams[id]));
  return {...base,registrations:pick(storage.registrations),registeredUnder:pick(storage.registeredUnder),
    teams,assignments,teamNames:storage.teamNames,
    shareInstructions:storage.shareInstructions,imports:(storage.imports||[]).filter(row=>ids.includes(row.id))};
}

export function eventStart(date,time) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!/^\d{2}:\d{2}$/.test(time||''))return null;
  const stamp = new Date(date+'T'+time+':00Z');
  return Number.isFinite(+stamp)&&stamp.toISOString().slice(0,16)===date+'T'+time ? stamp.toISOString() : null;
}
export const attendanceOpen = (startAt,now=Date.now()) => Number.isFinite(Date.parse(startAt)) && now>=Date.parse(startAt)+HOUR;
export const attendanceLabel = value => ATTENDANCE_RESULTS.find(([id])=>id===value)?.[1]||'Pending';

export function changeAttendance(record, update, now=Date.now()) {
  if(!record||!attendanceOpen(record.startAt,now))return record;
  const calledUp = record.role==='sub' && (update.calledUp ?? record.calledUp ?? false);
  const result = update.result ?? ((update.calledUp===false && record.result==='no-show'||update.calledUp===true && record.result==='not-called') ? '' : record.result) ?? '';
  if((result && !ATTENDANCE_RESULTS.some(([id])=>id===result)) ||
    (result==='not-called'&&(record.role!=='sub'||calledUp)) ||
    (result==='no-show'&&record.role==='sub'&&!calledUp))return record;
  if(result===(record.result||'')&&calledUp===(record.calledUp||false))return record;
  return {...record,calledUp,result,markedAt:new Date(now).toISOString()};
}

export function recentNoShow(records, currentStart) {
  const before = Date.parse(currentStart)||Infinity;
  const latest = Object.values(records||{}).filter(row=>
    (row.result==='attended'||row.result==='no-show')&&Date.parse(row.startAt)<before
  ).sort((a,b)=>b.startAt.localeCompare(a.startAt)||String(b.markedAt).localeCompare(String(a.markedAt)))[0];
  return latest?.result==='no-show';
}

function reconcileSchedule(player,plan,details,now) {
  const id = String(player.id);
  const record = player.plannerAttendance?.[plan.occurrenceId];
  const role = plan.registrations[id];
  const startAt = eventStart(plan.date,plan.time);
  const next = {...player.plannerAttendance};
  if(record && (record.result || Date.parse(record.startAt)<=now))return player;
  if(!startAt||!['join','sub'].includes(role)){
    if(!record)return player;
    delete next[plan.occurrenceId];
  }else{
    if(record?.startAt===startAt&&record.role===role)return player;
    next[plan.occurrenceId]={...details,startAt,role};
  }
  return {...player,plannerAttendance:next};
}

const powerFields = {
  foundry:['lastFoundryTroopPower','lastFoundryTroopPowerAt'],
  canyon:['lastCanyonClashTroopPower','lastCanyonClashTroopPowerAt'],
};

function savePower(player,kind,id,value,at) {
  if(!Number.isSafeInteger(value)||value<0)return player;
  const readings = {...player.plannerPowerReadings};
  const [field,dateField] = powerFields[kind];
  const previousValue = player[field] ?? (kind==='canyon' ? player.lastCanyonTroopPower : null);
  const previousDate = player[dateField] ?? (kind==='canyon' ? player.lastCanyonTroopPowerAt : null);
  if(readings[id]?.value===value)return player;
  if(previousValue!=null&&!Object.values(readings).some(row=>row.kind===kind&&row.at===(previousDate||null)&&row.value===previousValue)){
    readings['legacy:'+kind]={kind,value:previousValue,at:previousDate||null};
  }
  readings[id]={kind,value,at};
  return {...player,[field]:value,[dateField]:at,plannerPowerReadings:readings};
}

export function eventAssignments(storage,kind) {
  const slots=new Map();
  if(kind==='foundry')for(const alliance of new Set(Object.values(storage?.registeredUnder||{}))){
    if(alliance)slots.set(plannerKey(kind,alliance,1),{alliance,legion:1});
  }
  for(const key of Object.keys(storage?.eventPlans||{})){
    let slot;
    try{slot=JSON.parse(key)}catch{continue}
    if(Array.isArray(slot)&&slot[0]===kind&&typeof slot[1]==='string'&&[1,2].includes(slot[2])){
      slots.set(key,{alliance:slot[1],legion:slot[2]});
    }
  }
  const assignments=new Map();
  for(const {alliance,legion} of slots.values()){
    const plan=plannerSlot(storage,kind,alliance,legion);
    for(const [id,role] of Object.entries(plan.registrations)){
      if(!isParticipant(role)||plan.registeredUnder[id]!==alliance)continue;
      const assignment={alliance,legion,role,occurrenceId:plan.occurrenceId};
      assignments.set(id,[...(assignments.get(id)||[]),assignment]);
    }
  }
  return assignments;
}

export function prepareEventRoles(storage,{kind,alliance,legion,expectedOccurrenceId},changes,now=Date.now()) {
  const destination=plannerSlot(storage,kind,alliance,legion);
  const fail=error=>({error});
  if(destination.occurrenceId!==expectedOccurrenceId)return fail('The selected event changed. Try again.');
  const assignments=eventAssignments(storage,kind),from=new Map(),to={...destination};
  to.registrations={...destination.registrations};
  to.registeredUnder={...destination.registeredUnder};
  to.teams={...destination.teams};
  to.assignments={...destination.assignments};
  const seen=new Set();
  for(const {id,role,expectedRole,moveFrom} of changes){
    if(seen.has(id)||!['','out','join','sub'].includes(role)||(destination.registrations[id]||'')!==expectedRole){
      return fail('A registration changed. Check the current role and try again.');
    }
    seen.add(id);
    const elsewhere=(assignments.get(id)||[]).filter(item=>item.alliance!==alliance||item.legion!==legion);
    if(elsewhere.length&&isParticipant(role)){
      const source=elsewhere[0];
      if(elsewhere.length!==1)return fail('A player has multiple existing assignments. Review those rosters before moving them.');
      if(!moveFrom||['alliance','legion','role','occurrenceId'].some(key=>source[key]!==moveFrom[key])){
        return fail('The player is assigned elsewhere. Confirm the current assignment before moving them.');
      }
      const start=eventStart(destination.date,destination.time);
      if(start&&Date.parse(start)<=now)return fail('The destination legion has already started.');
      const key=plannerKey(kind,source.alliance,source.legion);
      const prior=from.get(key)?.plan||plannerSlot(storage,kind,source.alliance,source.legion);
      from.set(key,{...source,plan:{...prior,registrations:withoutPlayer(prior.registrations,id),
        registeredUnder:withoutPlayer(prior.registeredUnder,id),teams:withoutPlayer(prior.teams,id),
        assignments:withoutPlayer(prior.assignments,id)}});
      if(prior.powerByPlayer?.[id]!=null&&to.powerByPlayer?.[id]==null)to.powerByPlayer={...to.powerByPlayer,[id]:prior.powerByPlayer[id]};
    }else if(moveFrom)return fail('The original assignment changed. Review the rosters before moving the player.');
    if(role){
      to.registrations[id]=role;
      to.registeredUnder[id]=alliance;
    }else{
      delete to.registrations[id];
      delete to.registeredUnder[id];
    }
    if(role!=='join'){
      delete to.teams[id];
      delete to.assignments[id];
    }
  }
  for(const [role,label] of REGISTRATION_ROLES.filter(([role])=>isParticipant(role))){
    const limit=EVENT_LIMITS[kind][role];
    if(Object.values(to.registrations).filter(value=>value===role).length>limit)return fail('The destination has only '+limit+' '+label.toLowerCase()+' slots.');
  }
  return {slots:[...from.values(),{alliance,legion,plan:to}]};
}

export function updateEventPlanner(workspace,{kind,alliance,legion,plan,powers=[],attendance,expectedOccurrenceId,move,roleChanges,screenshotImport,resetPlanner},now=Date.now()) {
  if(!Object.hasOwn(EVENT_NAMES,kind)||![1,2].includes(legion))return workspace;
  if(resetPlanner){
    const storage=workspace.foundry||{}, slots=resetPlanner.slots;
    if(!Array.isArray(slots)||!slots.length||slots.length>2||new Set(slots.map(x=>x.legion)).size!==slots.length)return workspace;
    if(slots.some(x=>![1,2].includes(x.legion)||typeof x.occurrenceId!=='string'||!x.occurrenceId.startsWith(plannerKey(kind,alliance,x.legion)+':')||plannerSlot(storage,kind,alliance,x.legion).occurrenceId!==x.expectedOccurrenceId))return workspace;
    const eventPlans={...storage.eventPlans},eventArchives={...storage.eventArchives};
    for(const slot of slots){
      const key=plannerKey(kind,alliance,slot.legion), prior=plannerSlot(storage,kind,alliance,slot.legion);
      eventArchives[prior.occurrenceId]={kind,alliance,legion:slot.legion,archivedAt:new Date(now).toISOString(),plan:prior};
      eventPlans[key]={occurrenceId:slot.occurrenceId,teamCount:prior.teamCount||4,teamNames:prior.teamNames,shareInstructions:prior.shareInstructions,powerByPlayer:prior.powerByPlayer,registrations:{},registeredUnder:{},teams:{},assignments:{}};
    }
    return {...workspace,foundry:{...storage,eventPlans,eventArchives}};
  }
  if(screenshotImport){
    const current=plannerSlot(workspace.foundry,kind,alliance,legion);
    const validIds=new Set(workspace.players.filter(player=>player.membershipStatus!=='transferred_out').map(player=>String(player.id)));
    if(current.occurrenceId!==expectedOccurrenceId||new Set(powers.map(row=>row.id)).size!==powers.length||
      powers.some(row=>!validIds.has(row.id)||!Number.isSafeInteger(row.value)||row.value<0))return workspace;
  }

  if(roleChanges){
    const ids=new Set(workspace.players.filter(p=>p.membershipStatus!=='transferred_out').map(p=>String(p.id)));
    if(!roleChanges.length||roleChanges.some(change=>!ids.has(change.id)))return workspace;
    if(screenshotImport&&roleChanges.some(change=>workspace.players.find(p=>String(p.id)===change.id)?.allianceTag!==alliance))return workspace;
    const {slots}=prepareEventRoles(workspace.foundry,{kind,alliance,legion,expectedOccurrenceId},roleChanges,now);
    if(!slots)return workspace;
    const eventPlans={...workspace.foundry?.eventPlans};
    for(const slot of slots)eventPlans[plannerKey(kind,slot.alliance,slot.legion)]=slot.plan;
    const affected=new Set(roleChanges.map(change=>change.id));
    const players=workspace.players.map(p=>affected.has(String(p.id))?slots.reduce((player,slot)=>
      reconcileSchedule(player,slot.plan,{kind,alliance:slot.alliance,legion:slot.legion},now),p):p);
    const updated={...workspace,players,foundry:{...workspace.foundry,eventPlans}};
    return powers.length ? updateEventPlanner(updated,{kind,alliance,legion,expectedOccurrenceId,powers},now) : updated;
  }
  if(move)return moveLegion(workspace,{kind,alliance,legion,expectedOccurrenceId,move},now);
  const storage = workspace.foundry||{};
  const key = plannerKey(kind,alliance,legion);
  const current = plannerSlot(storage,kind,alliance,legion);
  const fresh = plan||current;
  if(expectedOccurrenceId && current.occurrenceId!==expectedOccurrenceId)return workspace;
  if(plan){
    const assignments=eventAssignments(storage,kind);
    if(Object.entries(plan.registrations).some(([id,role])=>isParticipant(role)&&
      current.registrations[id]!==role&&(assignments.get(id)||[]).some(item=>item.alliance!==alliance||item.legion!==legion)))return workspace;
  }
  const start = eventStart(current.date,current.time);
  if(fresh.occurrenceId===current.occurrenceId&&start&&Date.parse(start)<=now &&
    eventStart(fresh.date,fresh.time)!==start)return workspace;
  if(fresh.occurrenceId!==current.occurrenceId&&!attendanceOpen(start,now))return workspace;
  const at = new Date(now).toISOString();
  const matched = new Map(powers.filter(row=>Number.isSafeInteger(row.value)&&row.value>=0).map(row=>[String(row.id),row.value]));
  const perPlayer = {...fresh.powerByPlayer};
  const players = workspace.players.map(p=>{
    let player = plan ? reconcileSchedule(p,fresh,{kind,alliance,legion},now) : p;
    const id = String(p.id);
    if(matched.has(id)){
      player = savePower(player,kind,fresh.occurrenceId,matched.get(id),at);
      perPlayer[id]=matched.get(id);
    }
    if(attendance?.id!==id)return player;
    const occurrenceId = attendance.occurrenceId || fresh.occurrenceId;
    const record = player.plannerAttendance?.[occurrenceId];
    if(record?.kind!==kind||record.alliance!==alliance||record.legion!==legion)return player;
    const next = changeAttendance(record,attendance,now);
    return next!==record ? {...player,plannerAttendance:{...player.plannerAttendance,[occurrenceId]:next}} : player;
  });
  const shouldSave = plan||matched.size;
  return {...workspace,players,...(shouldSave?{foundry:{...storage,eventPlans:{...storage.eventPlans,[key]:{
    ...fresh,...(matched.size?{powerByPlayer:perPlayer}:{}),
  }}}}:{})};
}

function withoutPlayer(fields,id) {
  const next={...fields};
  delete next[id];
  return next;
}

function moveLegion(workspace,{kind,alliance,legion,expectedOccurrenceId,move},now) {
  const sourceLegion=legion===1?2:1;
  const destination=plannerSlot(workspace.foundry,kind,alliance,legion);
  return updateEventPlanner(workspace,{kind,alliance,legion,expectedOccurrenceId,roleChanges:[{
    id:move.id,role:move.role,expectedRole:destination.registrations[move.id]||'',
    moveFrom:{alliance,legion:sourceLegion,role:move.role,occurrenceId:move.sourceOccurrenceId},
  }]},now);
}

export function resizePlannerTeams(plan,count) {
  if(![3,4,5,6].includes(count))return plan;
  const teams=Object.fromEntries(Object.entries(plan.teams||{}).filter(([,name])=>TEAM_NAMES.slice(0,count).includes(name)));
  const assignments=Object.fromEntries(Object.entries(plan.assignments||{}).filter(([id])=>teams[id]));
  return {...plan,teamCount:count,teams,assignments};
}

export function formatPlannerPower(value,kind) {
  if(kind==='canyon') {
    const units=value>=1e9?[1e9,'B']:[1e6,'M'];
    return (value/units[0]).toFixed(2)+units[1];
  }
  return new Intl.NumberFormat('en-NZ',{maximumFractionDigits:0}).format(value);
}
