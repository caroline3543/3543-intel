import {useMemo,useState} from 'react';
import {C} from '../../utils/constants.js';
import {activeStateId,getWorkspaces,selectWorkspace} from '../../services/stateWorkspaceService.js';
import {hiveRoster} from '../../services/hiveIntegrationService.js';
import {HivePlannerFrame} from './HivePlannerFrame.jsx';
import {AllianceLocationMap} from './AllianceLocationMap.jsx';
export function HiveTab({players,settings,onSavePlayer,onViewPlayer,onImportAlliance}){
 const stateId=activeStateId(),tags=useMemo(()=>[...new Set(players.map(p=>p.allianceTag).filter(Boolean))].sort(),[players]);
 const [selected,setSelected]=useState(settings.allianceTag || ''),[view,setView]=useState('plan');
 const alliance=tags.includes(selected)?selected:tags[0] || '';
 const roster=useMemo(()=>alliance?hiveRoster(players,stateId,alliance):null,[players,stateId,alliance]);
 const button={minHeight:44,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',background:C.section,color:C.icy};
 return <section style={{padding:'8px 12px',height:'calc(100dvh - 60px)',boxSizing:'border-box',display:'flex',flexDirection:'column',overflow:'hidden'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:6}}><h2 style={{margin:0,fontSize:18}}>Bear Hive</h2><select aria-label="Hive state" value={stateId} onChange={e=>selectWorkspace(e.target.value)} style={{...button,fontSize:16}}>{getWorkspaces().states.map(id=><option key={id} value={id}>State {id}</option>)}</select></div><div style={{display:'flex',gap:8,alignItems:'end',marginBottom:12}}><label style={{flex:1,fontSize:12,color:C.icy}}>Alliance<select aria-label={`State ${stateId} · alliance`} value={alliance} onChange={e=>setSelected(e.target.value)} style={{...button,display:'block',width:'100%',fontSize:16,marginTop:6}}><option value="" disabled>Choose alliance</option>{tags.map(tag=><option key={tag} value={tag}>[{tag}]</option>)}</select></label><button onClick={onImportAlliance} style={button}>Pull alliance</button></div>
  {!roster?<p style={{color:C.muted,fontSize:13}}>Pull an alliance roster or add members with alliance tags to start planning.</p>:<><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>{[['plan','Planned layout'],['locations','Reported locations']].map(([key,label])=><button key={key} onClick={()=>setView(key)} aria-pressed={view===key} style={{...button,background:view===key?C.gold:C.section,color:view===key?C.bg:C.icy,fontWeight:700}}>{label}</button>)}</div>{roster.excluded>0 && <p style={{fontSize:12,color:C.gold}}>{roster.excluded} players excluded because their IDs are missing or duplicated. Resolve them in Members.</p>}
  <div hidden={view!=='plan'} style={{flex:1,minHeight:0,display:view==='plan'?'flex':'none',flexDirection:'column'}}><HivePlannerFrame key={`${stateId}:${alliance}`} roster={roster}/></div>{view==='locations' && <div style={{flex:1,minHeight:0,overflow:'auto'}}><AllianceLocationMap key={`${stateId}:${alliance}`} roster={roster} players={players} onSave={onSavePlayer} onViewPlayer={onViewPlayer}/></div>}</>}
 </section>;
}
