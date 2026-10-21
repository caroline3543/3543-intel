import {useState} from 'react';
import {C} from '../../../utils/constants.js';
import {interpretHero} from '../../../services/equipmentCatalogService.js';
import {ARENA_SLOTS,placeArenaHero} from '../../../services/arenaComparisonService.js';
import {HeroEquipmentCard} from '../../players/HeroEquipmentCard.jsx';
import {equipmentDate} from '../../players/EquipmentParts.jsx';
import {ArenaHeroEditor} from './ArenaHeroEditor.jsx';
import {arenaButton,arenaCard,arenaInput} from './arenaStyles.js';
export function ArenaTeamEditor({label,player,team,onChange,onReload,onViewPlayer}){
 const [adding,setAdding]=useState(false);
 return <details style={arenaCard}><summary style={{minHeight:44,cursor:'pointer',fontWeight:700,color:C.gold}}>{label}: edit formation & inspect gear</summary><p style={{fontSize:12,color:C.muted}}>Saved defence: {equipmentDate(team.sourceAt)}. Source position codes are shown below; check their front/back placement in the game.</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={onReload} style={arenaButton}>Reload saved heroes</button><button onClick={()=>onViewPlayer(player.id)} style={arenaButton}>Open player profile</button></div><p style={{fontSize:11,color:C.muted}}>Reload replaces this trial with the latest saved snapshot. Use the player profile to fetch heroes and gear.</p>
 {ARENA_SLOTS.map((slot,index)=><label key={slot} style={{display:'block',fontSize:12,marginTop:8}}>{label} {slot}<select aria-label={`${label} ${slot}`} value={team.slots[index] || ''} onChange={e=>onChange(placeArenaHero(team,index,e.target.value))} style={arenaInput}><option value="">Empty position</option>{team.heroes.map(h=><option key={h.key} value={h.key}>{interpretHero(h.raw).name} · {h.origin}{interpretHero(h.raw).position!=null?` · source pos ${interpretHero(h.raw).position}`:''}</option>)}</select></label>)}
 <label style={{display:'flex',alignItems:'center',minHeight:44,gap:8,fontSize:13,marginTop:8}}><input type="checkbox" checked={team.confirmed} onChange={e=>onChange({...team,confirmed:e.target.checked})} style={{width:24,height:24}}/>I checked {label.toLowerCase()} positions against the game</label>
 <button onClick={()=>setAdding(!adding)} style={arenaButton}>{adding?'Hide alternative form':'Add owned alternative'}</button>{adding && <ArenaHeroEditor existingIds={team.heroes.map(h=>String(h.raw.id ?? h.raw.hero_id))} onClose={()=>setAdding(false)} onAdd={hero=>{onChange({...team,heroes:[...team.heroes,hero],confirmed:false});setAdding(false)}}/>}
 {team.heroes.length===0 && <p style={{fontSize:13,color:C.muted}}>No matching saved heroes. Open the player profile to fetch them, or add actual heroes manually.</p>}
 {team.heroes.map(h=><details key={h.key} style={{marginTop:8}}><summary style={{minHeight:44,paddingTop:10,cursor:'pointer',fontSize:13}}>{interpretHero(h.raw).name} · {h.origin}{!team.slots.includes(h.key)?' · reserve':''}</summary><HeroEquipmentCard hero={h.raw}/></details>)}
 </details>;
}
