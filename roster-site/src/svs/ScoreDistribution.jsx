import {useState} from 'react';

const COLORS=['#89C4FF','#EBC18A'];
const fmt=v=>Number(v).toLocaleString('en-US');
const compact=v=>v>=1e9?(v/1e9).toFixed(2)+'B':v>=1e6?(v/1e6).toFixed(2)+'M':fmt(Math.round(v));
const frame={background:'#102238',border:'1px solid #30465B',borderRadius:12,padding:12};
const good=v=>v!=null&&Number.isFinite(Number(v))&&Number(v)>=0;
const summary=values=>{const v=values.filter(good).map(Number).sort((a,b)=>a-b);return {count:v.length,mean:v.length?v.reduce((a,b)=>a+b,0)/v.length:null,median:v.length?(v[Math.floor((v.length-1)/2)]+v[Math.floor(v.length/2)])/2:null,max:v.length?v[v.length-1]:null};};
const bands=(values,max)=>{const counts=[0,0,0,0,0];for(const v of values.filter(good)){const index=max>0?Math.min(4,Math.floor(Number(v)/max*5)):0;counts[index]++;}return counts;};
function Bar({value,max,color}){return <div style={{height:9,background:'#0B1929',borderRadius:6,overflow:'hidden'}}><div style={{width:(max?value/max*100:0)+'%',height:'100%',background:color,borderRadius:6}}/></div>}
export function ScoreDistribution({title,description,ours,theirs,ourLabel,theirLabel,coverageNote}){
 const [view,setView]=useState('distribution');
 const samples=[ours,theirs].map(a=>Array.isArray(a)?a.filter(good).map(Number):null);
 const stats=samples.map(v=>v?summary(v):null);
 const combined=samples.flatMap(v=>v||[]);
 const max=Math.max(0,...combined);
 const hist=samples.map(v=>v?bands(v,max):null);
 const maxCount=Math.max(1,...hist.flatMap(h=>h||[]));
 const both=stats.every(s=>s?.count);
 const meanLead=both&&stats[0].mean!==stats[1].mean?(stats[0].mean>stats[1].mean?0:1):-1;
 const leadPct=meanLead<0?0:(Math.max(stats[0].mean,stats[1].mean)-Math.min(stats[0].mean,stats[1].mean))/Math.min(stats[0].mean,stats[1].mean)*100;
 return <section style={{...frame,marginTop:12}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,flexWrap:'wrap'}}>
   <div><h3 style={{fontSize:16,margin:0}}>{title}</h3><p style={{fontSize:12,color:'#A8BFD5',margin:'4px 0 0'}}>{description}</p></div>
   <div role="group" aria-label={title+' view'} style={{display:'flex',background:'#182D43',padding:3,borderRadius:9}}>{[['distribution','Distribution'],['summary','Summary']].map(([id,label])=><button key={id} type="button" aria-pressed={view===id} onClick={()=>setView(id)} style={{border:0,borderRadius:7,padding:'7px 9px',fontSize:12,color:'#F2F7FD',background:view===id?'#355879':'transparent'}}>{label}</button>)}</div>
  </div>
  {both&&<div style={{marginTop:12,padding:'10px 11px',background:'#1C3449',borderRadius:10,fontSize:13,fontWeight:700}}>{meanLead<0?'Average scores are tied':Number.isFinite(leadPct)?(meanLead===0?ourLabel:theirLabel)+' leads by '+leadPct.toFixed(1)+'% in average score':'Percentage lead unavailable because the lower average is zero'}</div>}
  {view==='summary'?<div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:12}}>{stats.map((s,i)=><div key={i} style={{background:'#172D42',borderRadius:9,padding:10,minWidth:0}}><strong style={{color:COLORS[i],fontSize:12}}>{i?theirLabel:ourLabel}</strong>{[['Players',s?.count],['Average',s?.mean],['Median',s?.median],['Highest',s?.max]].map(([label,value])=><div key={label} style={{display:'flex',justifyContent:'space-between',gap:8,borderTop:'1px solid #30465B',marginTop:8,paddingTop:8,fontSize:12}}><span style={{color:'#B4C8DD'}}>{label}</span><strong style={{fontVariantNumeric:'tabular-nums'}}>{value==null?'—':label==='Players'?fmt(value):compact(value)}</strong></div>)}</div>)}</div>:<div style={{marginTop:13}}>
   <div style={{display:'flex',gap:12,marginBottom:10}}>{[ourLabel,theirLabel].map((label,i)=><span key={i} style={{color:COLORS[i],fontSize:12}}>● {label} ({stats[i]?.count??'—'})</span>)}</div>
   {Array.from({length:5},(_,i)=><div key={i} style={{padding:'8px 6px',background:i%2?'#192F43':'transparent',borderRadius:6}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:11,color:'#B4C8DD',marginBottom:5}}><span>{max===0?'Zero scores':compact(max*i/5)+'–'+compact(max*(i+1)/5)}</span><span style={{fontVariantNumeric:'tabular-nums'}}>{hist.map(h=>h?h[i]:'—').join(' vs ')}</span></div>
    {[0,1].map(j=><div key={j} style={{margin:'3px 0'}}><Bar value={hist[j]?.[i]||0} max={maxCount} color={COLORS[j]}/></div>)}
   </div>)}
   <p style={{fontSize:11,color:'#A8BFD5',lineHeight:1.5,margin:'10px 0 0'}}>Five equal score ranges using one shared scale. Bar length shows player counts, not total score.</p>
  </div>}
  <p style={{fontSize:11,color:'#91A9BF',lineHeight:1.5,margin:'10px 0 0'}}>{coverageNote}</p>
 </section>;
}
