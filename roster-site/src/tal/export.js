import {teamPower,troopPower,parsePower,targetGap} from './power.js';
import * as XLSX from 'xlsx';
import {coverage,playerLabel,record,teamIssues,transferRows} from './planner.js';
const safeNumber=value=>value===''||value==null?'':Number.isFinite(Number(value))?Number(value):'';
export function buildTalWorkbook(plan,players){
 const wb=XLSX.utils.book_new();
 const append=(name,rows,widths)=>{const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=widths.map(wch=>({wch}));ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(0,rows.length-1),c:rows[0].length-1}})};XLSX.utils.book_append_sheet(wb,ws,name);};
 const rows=transferRows(plan,players);
 append('Assignments',[
  ['Username','Player ID','Home alliance','Game alliance','TAL host','Legion','Role','Captain','TAL troop power','Registered in game','Matching times','Available times UTC','Furnace','Infantry','Lancer','Marksman','Skill 5 joiner heroes','Availability note'],
  ...rows.map(r=>{const p=r.player||{id:r.member.id},a=record(plan,p);return [playerLabel(p),String(p.fid||''),r.home,p.allianceTag||'',r.team.host,r.team.number,r.member.role,r.team.captain===p.id?'Yes':'',safeNumber(troopPower(plan,p)),r.member.registered?'Confirmed':'Not confirmed',r.team.slots.filter(t=>a.times.includes(t)).length,a.times.join(', '),p.furnaceLevel||'',p.troops?.infantry||'',p.troops?.lancer||'',p.troops?.marksman||'',(p.joinerHeroes||[]).filter(h=>h.skillLevel>=5).map(h=>h.hero).join(', '),a.note];})
 ],[24,20,16,16,16,10,14,12,20,20,16,30,12,14,14,14,28,40]);
 append('Legions',[
  ['Host alliance','Legion','Captain','Registration officer','Battle times UTC','Confirmed match UTC','Combatants','Substitutes','Per-time attendance','Planning items to check','Registration deadline UTC','Total recorded troop power','Planned top 20 power','Confirmed top 20 power','Missing powers','Target power','Planned target gap','Confirmed target gap'],
  ...plan.teams.map(t=>{const power=teamPower(plan,t,players);let target=null;try{target=parsePower(t.targetPower);}catch{}return [t.host,t.number,(t.captain?playerLabel(players.find(p=>p.id===t.captain)):'Not chosen'),t.officer,t.slots.join(', '),t.matchTime,t.members.filter(m=>m.role==='combatant').length,t.members.filter(m=>m.role==='substitute').length,coverage(plan,t,players).map(c=>`${c.time}: ${c.combatants} combatants + ${c.substitutes} substitutes`).join('; '),teamIssues(plan,t,players).join('; '),plan.deadline.replace('T',' '),power.total,power.planned,power.confirmed,power.missing,target??'',target==null?'':targetGap(power.planned,target),target==null?'':targetGap(power.confirmed,target)];})
 ],[16,10,24,24,30,24,14,14,65,65,26,24,24,24,18,20,28,28]);
 append('Availability',[
  ['Username','Player ID','Home alliance','Participation',...plan.times.map(t=>t+' UTC'),'TAL troop power','Note'],
  ...players.map(p=>{const r=record(plan,p);return [playerLabel(p),String(p.fid||''),r.homeAlliance,({pending:'No reply',available:'Taking part',declined:'Not participating'})[r.status],...plan.times.map(t=>r.status==='pending'?'Pending':r.status==='declined'?'Not participating':r.times.includes(t)?'Yes':'No'),safeNumber(r.troopPower),r.note];})
 ],[24,20,16,20,...plan.times.map(()=>16),28,40]);
 append('Alliance moves',[
  ['Username','Player ID','Home alliance','Last game alliance','Join alliance','Legion','Role','Registration'],
  ...rows.filter(r=>r.needsMove).map(r=>[playerLabel(r.player),String(r.player?.fid||''),r.home,r.player?.allianceTag||'',r.team.host,r.team.number,r.member.role,r.member.registered?'Confirmed':'Not confirmed'])
 ],[24,20,16,20,16,10,14,20]);
 return wb;
}
export function exportTalWorkbook(plan,players){XLSX.writeFile(buildTalWorkbook(plan,players),`3573-TAL-plan-${new Date().toISOString().slice(0,10)}.xlsx`,{bookType:'xlsx'});}
