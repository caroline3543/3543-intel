import {useEffect,useState} from 'react';
import {recordedActivity} from '../../services/recordedActivityService.js';
import {C} from '../../utils/constants.js';
export function RecordedActivity({value}){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer)},[]);
 const activity=recordedActivity(value,now);
 return <div>{activity?<><time dateTime={activity.iso}>{activity.utc}</time><div style={{fontSize:12,marginTop:4,color:C.icy}}>{activity.relative}</div></>:<span>{value==null?'Not supplied':String(value)}</span>}<div style={{fontSize:11,marginTop:4,color:C.muted}}>Historical provider record · activity data may be stale</div></div>;
}
