import { BUILDINGS, TEAM_COLORS } from '../../data/foundry.js';
import { C } from '../../utils/constants.js';
export function FoundryMap({plan,phase,onBuilding}) {
 return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 480" role="img" aria-label="Foundry team assignment map" style={{width:'100%',background:C.section,borderRadius:16}}>
  <path d="M230 10L450 240L230 470L10 240Z" fill={C.card} stroke={C.border}/>
  {BUILDINGS.map(b=>{const teams=plan.teams.filter(t=>t.targets[phase].includes(b.id));const x=b.x*4.6,y=b.y*4.8;return <g key={b.id} role={onBuilding?'button':undefined} tabIndex={onBuilding?0:undefined} aria-label={b.name} onClick={()=>onBuilding?.(b.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onBuilding?.(b.id);}}} style={{cursor:onBuilding?'pointer':undefined}}>
   {teams.map((t,i)=><path key={t.id} d={`M230 240L${x-42+i*12} ${y-30}L${x+42+i*12} ${y+30}Z`} fill={TEAM_COLORS[t.colorIndex]} opacity="0.18"/>)}
   <rect x={x-43} y={y-23} width="86" height="46" rx="9" fill={C.bg} stroke={teams.length?TEAM_COLORS[teams[0].colorIndex]:C.border} strokeWidth="2"/>
   <text x={x} y={y-6} textAnchor="middle" fill={C.white} fontSize="9">{b.name.split(' ').slice(0,-1).join(' ')}</text>
   <text x={x} y={y+6} textAnchor="middle" fill={C.white} fontSize="9">{b.name.split(' ').slice(-1)}</text>
   <text x={x} y={y+18} textAnchor="middle" fill={C.icy} fontSize="8">{teams.map(t=>t.name).join(' / ') || 'Unassigned'}</text>
  </g>})}
 </svg>;
}
