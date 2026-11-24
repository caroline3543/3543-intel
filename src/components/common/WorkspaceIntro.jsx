import {C} from '../../utils/constants.js';
/** Small, accessible orientation panel shared by the core workspaces. */
export function WorkspaceIntro({title,description,detail}){
 return <header style={{marginBottom:16}}>
  <h2 style={{fontSize:22,lineHeight:1.2,fontWeight:750,color:C.white,margin:'0 0 6px'}}>{title}</h2>
  <p style={{fontSize:14,lineHeight:1.5,color:C.icy,margin:'0 0 8px'}}>{description}</p>
  {detail&&<p style={{fontSize:12,lineHeight:1.45,color:C.muted,margin:0}}>{detail}</p>}
 </header>;
}
