import {C} from '../../../src/utils/constants.js';
import {providerFurnaceLevel} from '../../../src/services/providerProfileService.js';

const levels=['FC10','FC9','FC8','FC7','FC6','FC5','Below FC5','Unknown'];
export function furnaceTier(row){
 const label=providerFurnaceLevel(row?.scoreLabel)||providerFurnaceLevel(row?.score);
 if(!label)return 'Unknown';
 if(/^FC(10|[5-9])$/.test(label))return label;
 return 'Below FC5';
}
export function countFurnace(rows){
 const counts=Object.fromEntries(levels.map(level=>[level,0]));
 for(const row of rows||[])counts[furnaceTier(row)]++;
 return counts;
}
export function FurnaceDistribution({left,right,leftName='Our side',rightName='Opponent',scope='state'}){
 const l=left?.rows||[],r=right?.rows||[],lc=countFurnace(l),rc=countFurnace(r);
 const available=!!left&&!!right;
 const high=values=>['FC10','FC9','FC8','FC7'].reduce((sum,t)=>sum+values[t],0);
 const cap=Math.max(1,...levels.map(level=>Math.max(lc[level],rc[level])));
 return <section style={{background:C.card,borderRadius:16,padding:16,marginTop:14}}>
  <h3 style={{fontSize:18,margin:'0 0 5px'}}>Furnace levels</h3>
  <p style={{fontSize:13,color:C.icy,lineHeight:1.5,margin:'0 0 14px'}}>How many ranked players reached each furnace tier?</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginBottom:12}}>
   {[[lc,left,leftName,C.gold],[rc,right,rightName,C.blue]].map(([counts,data,name,color])=><div key={name} style={{background:C.section,padding:12,borderRadius:12,minWidth:0}}>
    <div style={{fontSize:12,color,marginBottom:6,fontWeight:700,overflowWrap:'anywhere'}}>{name}</div>
    <div style={{fontSize:27,fontWeight:800}}>{data?high(counts):'—'}</div>
    <div style={{fontSize:12,color:C.icy,marginTop:2}}>FC7 or higher</div>
    <div style={{fontSize:11,color:C.muted,marginTop:8}}>{data?`${data.rows.length} ranked entries examined`:'Data unavailable'}</div>
   </div>)}
  </div>
  <div style={{display:'grid',gridTemplateColumns:'minmax(65px,.8fr) 1fr 1fr',gap:10,alignItems:'center',paddingBottom:8,borderBottom:'1px solid '+C.border}}>
   <div style={{fontSize:12,color:C.muted}}>Tier</div><div style={{fontSize:12,color:C.gold,fontWeight:700,textAlign:'center'}}>{leftName}</div><div style={{fontSize:12,color:C.blue,fontWeight:700,textAlign:'center'}}>{rightName}</div>
  </div>
  {levels.map(level=><div key={level} style={{display:'grid',gridTemplateColumns:'minmax(65px,.8fr) 1fr 1fr',gap:10,alignItems:'center',padding:'10px 0',borderBottom:'1px solid '+C.border}}>
   <strong style={{fontSize:13}}>{level}</strong>
   {[[lc,left,C.gold],[rc,right,C.blue]].map(([counts,data,color],i)=><div key={i} style={{textAlign:'center'}}>
    <strong style={{fontSize:17}}>{data?counts[level]:'—'}</strong>
    <div style={{height:5,borderRadius:4,background:C.section,marginTop:7,overflow:'hidden'}}><div style={{height:'100%',borderRadius:4,background:color,width:data?(counts[level]/cap*100)+'%':'0%'}}/></div>
   </div>)}
  </div>)}
  {!available&&<p style={{fontSize:13,color:C.icy}}>Load the furnace leaderboard for both sides to compare these counts.</p>}
  <p style={{fontSize:12,color:C.muted,lineHeight:1.55,margin:'14px 0 0'}}>Counts cover only players returned by the published top-100 furnace leaderboard{scope==='alliance'?' who match each alliance tag':''}. They are not the total number of FC7+ players in the state. Players outside the leaderboard cannot be counted here.</p>
 </section>;
}
