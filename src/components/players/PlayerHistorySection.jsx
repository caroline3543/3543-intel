import {useState} from 'react';
import {C} from '../../utils/constants.js';
import {activeStateId} from '../../services/stateWorkspaceService.js';
import {HISTORY_LIMIT,playerObservations} from '../../services/playerObservationService.js';
import {historyMetrics,historyPoints,historyValue,HISTORY_LABELS,streamLabel} from '../../services/playerChangeService.js';
const utc=value=>new Date(value).toISOString().slice(0,16).replace('T',' ')+' UTC';
function Trend({points,label}){
  if(!points.length)return <p style={{color:C.muted,fontSize:12}}>No measurements yet.</p>;
  const values=points.map(p=>p.value),low=Math.min(...values),high=Math.max(...values);
  const first=Date.parse(points[0].at),last=Date.parse(points.at(-1).at);
  const xy=points.map(p=>({x:last===first?150:12+(Date.parse(p.at)-first)/(last-first)*276,y:high===low?58:102-(p.value-low)/(high-low)*88,p}));
  return <><svg viewBox="0 0 300 116" role="img" aria-label={`${label}: ${points.length} saved observations`} style={{width:'100%',height:130,display:'block'}}>
    <polyline points={xy.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={C.gold} strokeWidth="2"/>
    {xy.map(({x,y,p},i)=><circle key={i} cx={x} cy={y} r={i===xy.length-1?4:2} fill={C.gold}/>)}
  </svg><div style={{fontSize:11,color:C.muted,display:'flex',justifyContent:'space-between',gap:12}}><span>{points[0].at.slice(0,10)} · {points[0].label}</span><span>{points.at(-1).at.slice(0,10)} · {points.at(-1).label}</span></div></>;
}
export function PlayerHistorySection({player}){
  const stateId=activeStateId(),[selected,setSelected]=useState('');
  const events=playerObservations(player,stateId),metrics=historyMetrics(player,stateId);
  const metric=metrics.find(m=>m.key===selected) || metrics[0];
  if(!events.length)return <section style={{background:C.section,padding:16,borderRadius:12,marginBottom:12}}><h3 style={{fontSize:14,color:C.icy,margin:0}}>Player history</h3><p style={{fontSize:12,color:C.muted}}>History starts when you import alliance stats or save rankings. Past measurements are not reconstructed.</p></section>;
  const points=historyPoints(player,stateId,metric);
  return <section style={{background:C.section,padding:16,borderRadius:12,marginBottom:12}}><h3 style={{fontSize:14,color:C.icy,margin:'0 0 10px'}}>Player history</h3>
    {metrics.length>0 && <><select aria-label="Player history metric" value={metric.key} onChange={e=>setSelected(e.target.value)} style={{width:'100%',minHeight:44,padding:10,background:C.card,color:C.white,border:`1px solid ${C.border}`,borderRadius:8}}>{metrics.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}</select><Trend points={points} label={metric.label}/>{metric.field==='rank' && <p style={{color:C.muted,fontSize:11}}>A lower rank number is better.</p>}</>}
    <p style={{fontSize:11,color:C.muted,lineHeight:1.5}}>Observed when imported, not the exact time of an in-game change. Latest {HISTORY_LIMIT} observations retained per player; export backups to keep copies.</p>
    <details><summary style={{minHeight:44,paddingTop:10,cursor:'pointer',color:C.gold}}>Observation log ({events.length})</summary>
      {[...events].reverse().slice(0,30).map(event=><article key={event.id} style={{padding:'10px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}><strong style={{color:C.icy}}>{streamLabel(event.stream)}</strong><div style={{color:C.muted,marginTop:3}}>{utc(event.observedAt)}{event.baseline?' · Baseline':''}</div>{event.changes.length?event.changes.map(c=><div key={c.field} style={{marginTop:5}}>{HISTORY_LABELS[c.field] || c.field}: {historyValue(c.before,c.field,event.stream)} → {historyValue(c.after,c.field,event.stream)}</div>):<div style={{color:C.muted,marginTop:5}}>Saved observation · no comparable change</div>}</article>)}
      {events.length>30 && <p style={{color:C.muted,fontSize:11}}>Showing the latest 30 log entries. Charts and backups include all retained observations.</p>}
    </details>
  </section>;
}
