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

export function otherAllianceRegistration(storage,kind,alliance,id) {
  const slots = Object.keys(storage?.eventPlans||{}).map(key=>{
    try{return JSON.parse(key)}catch{return null}
  }).filter(slot=>Array.isArray(slot)&&slot.length===3);
  const legacyAlliance = kind==='foundry' ? storage?.registeredUnder?.[id] : null;
  if(legacyAlliance)slots.push(['foundry',legacyAlliance,1]);
  for(const [event,tag,legion] of slots){
    if(event!==kind||tag===alliance||![1,2].includes(legion))continue;
    const plan=plannerSlot(storage,event,tag,legion);
    const role=plan.registrations[id];
    if(isParticipant(role)&&plan.registeredUnder[id]===tag)return {alliance:tag,legion,role};
  }
  return null;
}

export function importRegistrationState(plan,other,id) {
  return JSON.stringify([
    plan.occurrenceId,plan.registrations[id]??null,plan.registeredUnder[id]??null,
    other.occurrenceId,other.registrations[id]??null,other.registeredUnder[id]??null,
    plan.powerByPlayer?.[id]??null,
  ]);
}

export function updateEventPlanner(workspace,{kind,alliance,legion,plan,powers=[],attendance,expectedOccurrenceId,move,expectedRegistrations},now=Date.now()) {
  if(!Object.hasOwn(EVENT_NAMES,kind)||![1,2].includes(legion))return workspace;
  if(move)return moveLegion(workspace,{kind,alliance,legion,expectedOccurrenceId,move},now);
  const storage = workspace.foundry||{};
  const key = plannerKey(kind,alliance,legion);
  const current = plannerSlot(storage,kind,alliance,legion);
  const fresh = plan||current;
  if(expectedOccurrenceId && current.occurrenceId!==expectedOccurrenceId)return workspace;
  if(plan){
    const other=plannerSlot(storage,kind,alliance,legion===1?2:1);
    if(expectedRegistrations&&Object.entries(expectedRegistrations).some(([id,expected])=>importRegistrationState(current,other,id)!==expected))return workspace;
    if(Object.entries(plan.registrations).some(([id,role])=>isParticipant(role)&&
      !isParticipant(current.registrations[id])&&(isParticipant(other.registrations[id])||otherAllianceRegistration(storage,kind,alliance,id))))return workspace;
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

export function legionMoveError(source,destination,id,role,now=Date.now()) {
  if(!isParticipant(role)||source.registrations[id]!==role||isParticipant(destination.registrations[id])){
    return 'The registration changed. Review both legions and try again.';
  }
  const start=eventStart(destination.date,destination.time);
  if(start&&Date.parse(start)<=now)return 'The destination legion has already started.';
  if(Object.values(destination.registrations).filter(value=>value===role).length>=EVENT_LIMITS.foundry[role]){
    return 'The destination has no '+(role==='join'?'combatant':'substitute')+' slots left.';
  }
  return '';
}

function withoutPlayer(fields,id) {
  const next={...fields};
  delete next[id];
  return next;
}

function moveLegion(workspace,{kind,alliance,legion,expectedOccurrenceId,move},now) {
  const storage=workspace.foundry;
  const otherLegion=legion===1?2:1;
  const source=plannerSlot(storage,kind,alliance,otherLegion);
  const destination=plannerSlot(storage,kind,alliance,legion);
  const {id,role,sourceOccurrenceId}=move;
  if(destination.occurrenceId!==expectedOccurrenceId||source.occurrenceId!==sourceOccurrenceId||
    source.registeredUnder[id]!==alliance||legionMoveError(source,destination,id,role,now)||
    !workspace.players.some(player=>String(player.id)===id))return workspace;
  const from={...source,
    registrations:withoutPlayer(source.registrations,id),registeredUnder:withoutPlayer(source.registeredUnder,id),
    teams:withoutPlayer(source.teams,id),assignments:withoutPlayer(source.assignments,id)};
  const to={...destination,registrations:{...destination.registrations,[id]:role},
    registeredUnder:{...destination.registeredUnder,[id]:alliance}};
  const sourcePower=source.powerByPlayer?.[id];
  if(sourcePower!=null&&to.powerByPlayer?.[id]==null)to.powerByPlayer={...to.powerByPlayer,[id]:sourcePower};
  const players=workspace.players.map(player=>String(player.id)===id
    ?reconcileSchedule(reconcileSchedule(player,from,{kind,alliance,legion:otherLegion},now),to,{kind,alliance,legion},now)
    :player);
  return {...workspace,players,foundry:{...storage,eventPlans:{...storage?.eventPlans,
    [plannerKey(kind,alliance,otherLegion)]:from,[plannerKey(kind,alliance,legion)]:to}}};
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
