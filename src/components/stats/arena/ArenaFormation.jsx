import {C} from '../../../utils/constants.js';
import {EquipmentIcon} from '../../players/EquipmentParts.jsx';
import {ARENA_SLOTS,activeArenaHeroes} from '../../../services/arenaComparisonService.js';
export function ArenaFormation({team,label}){
 const heroes=activeArenaHeroes(team);
 return <div style={{minWidth:0}}><strong style={{display:'block',fontSize:13,overflowWrap:'anywhere',marginBottom:8}}>{label}</strong>{[[0,1],[2,3,4]].map((row,i)=><div key={i}><div style={{fontSize:10,color:C.muted,margin:'6px 0'}}>{i?'Back row':'Front row'}</div><div style={{display:'grid',gridTemplateColumns:`repeat(${row.length},minmax(0,1fr))`,gap:4}}>{row.map(slot=>{const h=heroes[slot];return <div key={slot} aria-label={`${label} ${ARENA_SLOTS[slot]}: ${h?.name || 'Empty'}`} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:5,minWidth:0,display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center'}}>{h?<><EquipmentIcon url={h.icon} name={h.name} size={32}/><span style={{fontSize:11,overflowWrap:'anywhere',marginTop:4}}>{h.name}</span><small style={{fontSize:10,color:C.muted}}>{h.level!=null?`Lv ${h.level}`:'Lv ?'}</small></>:<span style={{fontSize:11,color:C.muted}}>Empty</span>}</div>})}</div></div>)}<p style={{fontSize:11,color:team?.confirmed?C.green:C.gold}}>{team?.confirmed?'Positions confirmed':'Check positions below'}</p></div>;
}
