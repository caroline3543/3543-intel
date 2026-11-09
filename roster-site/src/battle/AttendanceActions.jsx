import {button,C} from '../tal/ui.jsx';
export function AttendanceActions({member,name,onChange,controls}){
 return <div role="group" aria-label={`Attendance for ${name}`} style={{display:'flex',gap:4,flexShrink:0}}>{[['available','✓','attending',C.green],['unavailable','×','not attending',C.red],['unknown','?','unknown',C.icy]].map(([value,icon,label,color])=><button type="button" key={value} ref={el=>{if(controls)controls.current[`${member.id}:${value}`]=el;}} aria-label={`Mark ${name} ${label}`} aria-pressed={member.attendance===value} onClick={()=>onChange(value)} style={{...button,width:44,height:44,padding:0,fontSize:22,borderRadius:22,color:member.attendance===value?C.bg:color,background:member.attendance===value?color:C.bg,border:`1px solid ${color}`}}>{icon}</button>)}</div>;
}
