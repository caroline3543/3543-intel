import {ATTENDANCE_RESULTS,EVENT_LIMITS,EVENT_NAMES,attendanceOpen,eventStart,plannerKey,TEAM_NAMES} from '../../src/services/eventPlanner.js';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

export function validateEventPlannerData(data,now=Date.now()) {
 for(const p of data.players) {
  if(p.plannerAttendance!=null){
   if(!plain(p.plannerAttendance))throw Error('Invalid event attendance.');
   for(const entry of Object.values(p.plannerAttendance)){
    if(!plain(entry)||!Object.hasOwn(EVENT_NAMES,entry.kind)||typeof entry.alliance!=='string'||![1,2].includes(entry.legion)||
       !['join','sub'].includes(entry.role)||!Number.isFinite(Date.parse(entry.startAt)))throw Error('Invalid scheduled event.');
    if(entry.result&&(!ATTENDANCE_RESULTS.some(([value])=>value===entry.result)||!attendanceOpen(entry.startAt,now)||
       !attendanceOpen(entry.startAt,Date.parse(entry.markedAt))||
       (entry.result==='no-show'&&entry.role==='sub'&&entry.calledUp!==true)||
       (entry.result==='not-called'&&(entry.role!=='sub'||entry.calledUp))))throw Error('Invalid attendance result.');
   }
  }
 }
 const f=data.foundry;
  if(f?.eventPlans!=null){
   if(!plain(f.eventPlans))throw Error('Invalid event plans.');
   for(const [key,plan] of Object.entries(f.eventPlans)){
    let slot;
    try{slot=JSON.parse(key);}catch{throw Error('Invalid event plan slot.');}
    if(!Array.isArray(slot)||slot.length!==3)throw Error('Invalid event plan slot.');
    const [kind,alliance,legion]=slot;
    if(!Object.hasOwn(EVENT_NAMES,kind)||typeof alliance!=='string'||!alliance||![1,2].includes(legion)||
       key!==plannerKey(kind,alliance,legion)||!plain(plan)||
       typeof plan.occurrenceId!=='string'||(plan.occurrenceId!==key&&!plan.occurrenceId.startsWith(key+':'))||
       ![3,4,5,6].includes(plan.teamCount)||!plain(plan.registrations)||!plain(plan.registeredUnder)||
       !plain(plan.teams)||!plain(plan.assignments)||
       ((plan.date||plan.time)&&!eventStart(plan.date,plan.time)))throw Error('Invalid event plan.');
    if(plan.powerByPlayer!=null&&(!plain(plan.powerByPlayer)||Object.values(plan.powerByPlayer).some(value=>!Number.isSafeInteger(value)||value<0)))throw Error('Invalid event troop power.');
    const roles=Object.values(plan.registrations);
    if(roles.some(role=>!['','join','sub','out'].includes(role))||roles.filter(role=>role==='join').length>EVENT_LIMITS[kind].join||
       roles.filter(role=>role==='sub').length>EVENT_LIMITS[kind].sub||Object.entries(plan.teams).some(([id,team])=>
       plan.registrations[id]!=='join'||!TEAM_NAMES.slice(0,plan.teamCount).includes(team)))throw Error('Invalid event registration or team.');
   }
  }
 return data;
}
