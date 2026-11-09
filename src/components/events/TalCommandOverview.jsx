import {readinessForMatch} from '../../services/talMatchReadiness.js';
import {teamWarnings} from '../../services/talPlanner.js';
import {C} from '../../utils/constants.js';

const pill={border:`1px solid ${C.border}`,background:C.card,color:C.icy,borderRadius:10,padding:'8px 10px',minHeight:40,fontSize:13,fontWeight:650,cursor:'pointer'};
export function TalCommandOverview({config,players,step,onNavigate}) {
 const pollCount=players.filter(p=>(config.availability?.[p.id]||[]).length>0).length;
 const teams=config.teams||[];
 const pending=teams.filter(t=>!t.matchTime).length;
 const issues=teams.reduce((n,t)=>n+teamWarnings(t,config,players).filter(w=>!w.includes('cannot confirm every selected time')).length,0);
 const ready=teams.filter(t=>!!t.matchTime).reduce((sum,t)=>{const r=readinessForMatch(t,config,players);sum.correct+=r.correct;sum.expected+=r.attending;sum.move+=r.needMove;sum.unknown+=r.unverified;return sum;},{correct:0,expected:0,move:0,unknown:0});
 const pct=ready.expected?Math.round(100*ready.correct/ready.expected):0;
 const stat=(label,value,sub)=> <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 10px',minWidth:0}}>
  <div style={{fontSize:11,color:C.icy,fontWeight:600}}>{label}</div>
  <div style={{fontSize:24,fontWeight:750,color:C.white,margin:'3px 0',fontVariantNumeric:'tabular-nums'}}>{value}</div>
  <div style={{fontSize:11,color:C.icy,lineHeight:1.35}}>{sub}</div>
 </div>;
 return <section aria-label="TAL planning overview" style={{marginBottom:16}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:10}}>
   <div><div style={{fontSize:12,color:C.gold,fontWeight:700,letterSpacing:'.07em'}}>COMMAND OVERVIEW</div>
    <h3 style={{fontSize:18,margin:'3px 0 0',color:C.white}}>Plan at a glance</h3></div>
   <span style={{fontSize:12,color:config.locked?C.green:C.icy}}>{config.locked?'Locked':'Draft'}</span>
  </div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}>
   {stat('Poll replies',pollCount,'With times')}
   {stat('Legions',teams.length,pending?`${pending} awaiting time`:'Times checked')}
   {stat('Needs review',issues,issues?'Registration checks':'No flagged checks')}
  </div>
  {teams.length>0&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:12,marginTop:8}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'baseline'}}>
    <strong style={{fontSize:14,color:C.white}}>Match-ready alliances</strong>
    <strong style={{fontSize:14,color:C.green}}>{ready.correct}/{ready.expected}</strong>
   </div>
   <div role="progressbar" aria-label="Expected players in correct alliance" aria-valuemin={0} aria-valuemax={ready.expected||1} aria-valuenow={ready.correct} style={{height:8,borderRadius:8,background:C.border,overflow:'hidden',margin:'10px 0'}}>
    <div style={{height:'100%',width:`${pct}%`,background:C.green,borderRadius:8}}/>
   </div>
   <div style={{fontSize:12,color:C.icy}}>{pending?'Only legions with a confirmed match time are counted. · ':''}{ready.move} need to move · {ready.unknown} unverified</div>
  </div>}
  <div aria-label="Planner sections" style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:5,marginTop:12}}>
   {[['Availability','Poll'],['Legions','Legions'],['Buildings','Battle'],['Review','Review']].map(([key,label])=><button key={key} type="button" onClick={()=>onNavigate(key)} aria-current={step===key?'step':undefined}
    style={{...pill,padding:'10px 3px',fontSize:12,borderColor:step===key?C.gold:C.border,color:step===key?C.gold:C.icy,background:step===key?C.section:C.card}}>{label}</button>)}
  </div>
 </section>;
}
