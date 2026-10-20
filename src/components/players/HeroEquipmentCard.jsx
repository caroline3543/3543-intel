import {C} from '../../utils/constants.js';
import {heroStars} from '../../services/playerDetailsService.js';
import {EquipmentIcon,EquipmentFacts} from './EquipmentParts.jsx';
export function HeroEquipmentCard({hero,index}){
  const name=hero.name || `Hero ${hero.id ?? index+1}`,widget=hero.exclusive_gear;
  const gear=Array.isArray(hero.gear)?hero.gear:[],skills=Array.isArray(hero.skill_levels)?hero.skill_levels:[];
  return <article style={{padding:14,borderRadius:10,background:C.bg,marginTop:10}}>
    <div style={{display:'flex',gap:10,alignItems:'center'}}><EquipmentIcon url={hero.icon} name={name} size={48}/><div style={{flex:1,minWidth:0}}><strong style={{color:C.white,fontSize:15}}>{name}</strong><EquipmentFacts entries={[["Level",hero.level],["Stars",heroStars(hero)],["Power",hero.power],["Arena position",hero.position]]}/></div></div>
    {(hero.exclusive_gear_level!=null || widget) && <div style={{marginTop:12,padding:10,border:`1px solid ${C.border}`,borderRadius:8}}><strong style={{fontSize:12,color:C.gold}}>Exclusive gear / widget</strong><div style={{fontSize:13,color:C.white,marginTop:4}}>{widget?.name || 'Widget'}</div><EquipmentFacts entries={[["Level",hero.exclusive_gear_level ?? widget?.level]]}/></div>}
    {skills.length>0 && <details style={{marginTop:6}}><summary style={{minHeight:44,paddingTop:12,fontSize:12,color:C.icy,cursor:'pointer'}}>Reported skills ({skills.length})</summary>{skills.map((skill,i)=><div key={`${skill.id ?? i}:${i}`} style={{fontSize:12,color:C.muted,padding:'5px 0'}}>{skill.name || skill.label || `Skill ${skill.id ?? i+1}`} · Level {skill.level ?? '—'}</div>)}</details>}
    {gear.length>0?<div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:10}}>{gear.map((item,i)=><div key={`${item.eid ?? item.slot ?? i}:${i}`} style={{padding:10,borderRadius:8,background:C.section,minWidth:0}}><strong style={{fontSize:12,color:C.white,overflowWrap:'anywhere'}}>{item.name || `Equipment slot ${item.slot ?? i+1}`}</strong><EquipmentFacts entries={[["Enhancement",item.enhancement_level==null?null:`+${item.enhancement_level}`],["Mastery",item.refine_level],["Quality",item.quality_label ?? item.quality],["Troop",item.troop_label]]}/>{item.red===true && <div style={{fontSize:11,color:C.red,marginTop:6}}>Red equipment</div>}</div>)}</div>:<p style={{fontSize:12,color:C.muted,margin:'10px 0 0'}}>No hero equipment returned.</p>}
  </article>;
}
