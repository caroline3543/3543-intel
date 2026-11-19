import {useState} from 'react';
import {mightpulseRequest} from '../../../src/services/mightpulseService.js';
import {normalizeRankings} from '../../../src/services/stateRankingsService.js';
import {providerFurnaceLevel} from '../../../src/services/providerProfileService.js';

const TAGS=['ARC','HOT','RKG','LUN'];
const LAB_CACHE_KEY='3573:compare:labyrinth-top-100:v1';
const MAX_LAB_CACHE_AGE_MS=30*24*60*60*1000;
function readLabCache(){try{const value=JSON.parse(localStorage.getItem(LAB_CACHE_KEY)||'null');return value?.stateId==='3573'&&value.board==='labyrinth'&&Array.isArray(value.rows)&&value.rows.length<=100&&Number.isFinite(Date.parse(value.retrievedAt))&&Date.parse(value.retrievedAt)<=Date.now()+60000&&Date.now()-Date.parse(value.retrievedAt)<MAX_LAB_CACHE_AGE_MS?value:null;}catch{return null;}}
function writeLabCache(value){try{localStorage.setItem(LAB_CACHE_KEY,JSON.stringify(value));}catch{/* Private browsing may disable storage. */}}
const numeric=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
export function furnaceProgress(value){
 const label=providerFurnaceLevel(value);
 if(!label)return null;
 const fc=/^FC(\d+)$/.exec(label);
 if(fc)return Number(fc[1]);
 const pre=/^F(\d+)$/.exec(label);
 return pre?Math.max(0,(Number(pre[1])-30)/5):null;
}
export function allianceStandings(players,rankings){
 const unique=new Set();
 const groups=Object.fromEntries(TAGS.map(tag=>[tag,{tag,players:0,powerTotal:0,powerCount:0,fcTotal:0,fcCount:0,lab:null}]));
 for(const p of players||[]){
  if(p.membershipStatus==='transferred_out'||String(p.stateId||'3573')!=='3573')continue;
  const tag=String(p.allianceTag||'').trim().toUpperCase();
  if(!groups[tag])continue;
  const id=String(p.fid||p.id||'').trim();
  if(!id||unique.has(id))continue;
  unique.add(id);
  const g=groups[tag];g.players++;
  const power=numeric(p.power??p.cityPower);
  if(power!==null&&power>=0){g.powerTotal+=power;g.powerCount++;}
  const fc=furnaceProgress(p.furnaceLevel??p.providerStats?.furnaceLabel??p.providerStats?.furnaceLevel);
  if(fc!==null){g.fcTotal+=fc;g.fcCount++;}
 }
 const lab=labGroups(rankings);
 return TAGS.map(tag=>{const g=groups[tag];return {...g,avgPower:g.powerCount?g.powerTotal/g.powerCount:null,avgFC:g.fcCount?g.fcTotal/g.fcCount:null,lab:lab?.counts[tag]??(lab?0:null)};});
}
export function labGroups(rankings){
 if(!rankings)return null;
 if(rankings.stateId==='3573'&&rankings.board==='labyrinth'&&rankings.counts&&rankings.rows===undefined)return rankings;
 const counts=Object.fromEntries(TAGS.map(tag=>[tag,0]));
 const other={},seen=new Set();
 let noAlliance=0,unknown=0,total=0;
 for(const r of rankings.rows||[]){
  if(!Number.isInteger(r.rank)||r.rank<1||r.rank>100)continue;
  const id=String(r.fid||'').trim();
  const key=id||'rank:'+r.rank;
  if(seen.has(key))continue;
  seen.add(key);total++;
  const tag=String(r.allianceTag??'').trim().toUpperCase();
  if(TAGS.includes(tag))counts[tag]++;
  else if(tag==='NO ALLIANCE'||tag==='NONE'||tag==='N/A'||tag==='-')noAlliance++;
  else if(tag)other[tag]=(other[tag]||0)+1;
  else unknown++;
 }
 return {counts,other,noAlliance,unknown,total};
}

const compact=v=>v==null?'—':v>=1e9?(v/1e9).toFixed(2)+'B':v>=1e6?(v/1e6).toFixed(1)+'M':Math.round(v).toLocaleString();
export function AllianceStandings({players=[],lastLabSummary=null,onLabSummary}){
 const [snapshot,setSnapshot]=useState(readLabCache),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [distributionMetric,setDistributionMetric]=useState('count');
 const [selectedFurnace,setSelectedFurnace]=useState(null);
 const [sort,setSort]=useState('avgPower'),[ascending,setAscending]=useState(false),[showOther,setShowOther]=useState(false);
 const load=async()=>{if(busy)return;setBusy(true);setError('');
  try{const result=await mightpulseRequest('rankings',{state:3573,board:'labyrinth',limit:100});
   const next=normalizeRankings(result,'3573','labyrinth');
   if(next?.stateId!=='3573'||next.board!=='labyrinth'||!Array.isArray(next.rows)||next.rows.length>100||!Number.isFinite(Date.parse(next.retrievedAt)))throw new Error('Invalid Labyrinth response');
   setSnapshot(next);writeLabCache(next);
   onLabSummary?.({...labGroups(next),stateId:'3573',board:'labyrinth',retrievedAt:next.retrievedAt});
  }catch(e){setError((e?.message||'Could not refresh Labyrinth rankings')+'. Previous results retained.');}
  finally{setBusy(false);}
 };
 const savedSummary=lastLabSummary?.stateId==='3573'&&lastLabSummary?.board==='labyrinth'&&Number.isFinite(Date.parse(lastLabSummary?.retrievedAt))?lastLabSummary:null;
 const effectiveLab=snapshot&&(!savedSummary||Date.parse(snapshot.retrievedAt)>=Date.parse(savedSummary.retrievedAt))?snapshot:savedSummary;
 const rows=allianceStandings(players,effectiveLab);
 const lab=labGroups(effectiveLab);
 const ordered=[...rows].sort((a,b)=>{if(sort==='tag')return ascending?a.tag.localeCompare(b.tag):b.tag.localeCompare(a.tag);
  const av=a[sort],bv=b[sort];if(av==null)return 1;if(bv==null)return -1;return ascending?av-bv:bv-av;});
 const header=(key,label)=><button type="button" onClick={()=>{if(sort===key)setAscending(!ascending);else{setSort(key);setAscending(false);}}}
  style={{background:'transparent',border:0,color:'#C7D7E8',fontSize:11,fontWeight:700,padding:'12px 3px',cursor:'pointer',minHeight:44,textAlign:key==='tag'?'left':'right',width:'100%'}}>
  {label}{sort===key?(ascending?' ↑':' ↓'):''}</button>;
 return <section aria-label="3573 alliance standings" style={{background:'#15273A',border:'1px solid #344F69',borderRadius:15,padding:12,marginTop:13}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:6}}>
   <div><h3 style={{margin:0,fontSize:17}}>Alliance standings</h3><div style={{fontSize:12,color:'#A8BFD5',marginTop:4}}>Top four · App roster</div></div>
   <button type="button" onClick={load} disabled={busy} style={{border:'1px solid #344F69',background:'#1E3448',color:'#F1F7FD',borderRadius:9,minHeight:44,padding:'8px 10px',fontSize:12,fontWeight:650}}>{busy?'Refreshing…':'Refresh Lab'}</button>
  </div>
  <div style={{fontSize:11,color:'#A8BFD5',marginBottom:7}}>Lab Top 100 · {effectiveLab?'Last lookup '+new Date(effectiveLab.retrievedAt).toLocaleString():'No saved lookup yet'}</div>
  <div style={{overflowX:'auto'}}>
   <table style={{width:'100%',borderCollapse:'collapse',fontVariantNumeric:'tabular-nums',minWidth:310}}>
    <thead><tr>{[['tag','Alliance'],['avgPower','Avg power'],['avgFC','Avg FC'],['lab','Top 100 in Lab']].map(([k,label])=><th key={k} scope="col" style={{textAlign:k==='tag'?'left':'right',padding:0,borderBottom:'1px solid #344F69'}}>{header(k,label)}</th>)}</tr></thead>
    <tbody>{ordered.map((g,i)=><tr key={g.tag} style={{background:i%2?'#1A3045':'transparent'}}>
     <th scope="row" style={{padding:'11px 4px',textAlign:'left',fontSize:13}}>{g.tag}</th>
     <td style={{padding:'11px 3px',textAlign:'right',fontSize:13}}>{compact(g.avgPower)}</td>
     <td style={{padding:'11px 3px',textAlign:'right',fontSize:13}}>{g.avgFC==null?'—':g.avgFC.toFixed(2)}</td>
     <td style={{padding:'11px 3px',textAlign:'right',fontSize:13}}>{g.lab==null?'—':g.lab}</td>
    </tr>)}</tbody>
   </table>
  </div>
  {lab&&<div style={{borderTop:'1px solid #344F69',marginTop:8,paddingTop:10,fontSize:12}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
    <strong>Other alliances</strong><button type="button" aria-expanded={showOther} onClick={()=>setShowOther(v=>!v)} style={{border:0,background:'transparent',color:'#B9D9F8',minHeight:44,padding:'8px 4px'}}>{Object.values(lab.other).reduce((a,b)=>a+b,0)} players · {showOther?'Hide':'Show'} alliances</button>
   </div>
   {showOther&&Object.entries(lab.other).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([tag,count])=><div key={tag} style={{display:'flex',justifyContent:'space-between',padding:'8px 5px',background:'#1A3045'}}><span>{tag}</span><strong>{count}</strong></div>)}
   <div style={{display:'flex',justifyContent:'space-between',padding:'9px 5px'}}><span>No alliance (explicitly reported)</span><strong>{lab.noAlliance}</strong></div>
   <div style={{display:'flex',justifyContent:'space-between',padding:'9px 5px',background:'#1A3045'}}><span>Alliance unknown</span><strong>{lab.unknown}</strong></div>
   <div style={{display:'flex',justifyContent:'space-between',padding:'10px 5px',borderTop:'1px solid #344F69',fontWeight:750}}><span>Top 100 entries returned</span><strong>{lab.total}</strong></div>
  </div>}

  <div style={{marginTop:18,borderTop:'1px solid #344F69',paddingTop:15}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
    <div><h3 style={{fontSize:16,margin:0}}>Furnace distribution</h3><div style={{fontSize:12,color:'#A8BFD5',marginTop:3}}>App roster · four alliances</div></div>
    <div role="group" aria-label="Furnace chart units" style={{display:'flex',background:'#102238',borderRadius:9,padding:3}}>
     {[['count','Players'],['percent','%']].map(([id,label])=><button key={id} type="button" aria-pressed={distributionMetric===id} onClick={()=>setDistributionMetric(id)} style={{border:0,borderRadius:7,minHeight:36,padding:'6px 12px',background:distributionMetric===id?'#365675':'transparent',color:'#F2F7FD',fontSize:12,fontWeight:700}}>{label}</button>)}
    </div>
   </div>
   {(()=>{
    const tags=['ARC','HOT','RKG','LUN'],colors=['#8EA5C4','#3A9CC2','#43A59B','#E0AC65'],tiers=['Pre-FC','FC1','FC2','FC3','FC4','FC5','FC6','FC7','FC8'];
    const unique=new Set(),groups=Object.fromEntries(tags.map(t=>[t,{known:0,unknown:0,counts:Object.fromEntries(tiers.map(tier=>[tier,0]))}]));
    for(const p of players||[]){
     if(p.membershipStatus==='transferred_out'||String(p.stateId||'3573')!=='3573')continue;
     const tag=String(p.allianceTag||'').trim().toUpperCase(),id=String(p.fid||p.id||'').trim();
     if(!groups[tag]||!id||unique.has(id))continue;unique.add(id);
     const label=providerFurnaceLevel(p.furnaceLevel??p.providerStats?.furnaceLabel??p.providerStats?.furnaceLevel);
     const tier=label&&/^F\d+$/.test(label)?'Pre-FC':label;
     if(tiers.includes(tier)){groups[tag].counts[tier]++;groups[tag].known++;}
     else groups[tag].unknown++;
    }
    const vals=tiers.flatMap(t=>tags.map(tag=>distributionMetric==='count'?groups[tag].counts[t]:groups[tag].known?groups[tag].counts[t]/groups[tag].known*100:0));
    const maximum=Math.max(1,...vals);
    const active=selectedFurnace&&tiers.includes(selectedFurnace)?selectedFurnace:null;
    return <div style={{marginTop:12}}>
     <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:10}}>{tags.map((tag,i)=><span key={tag} style={{fontSize:11,color:'#D3E0EC'}}><span style={{color:colors[i]}}>●</span> {tag}</span>)}</div>
     <div style={{overflowX:'auto',paddingBottom:5}}>
      <div style={{minWidth:340}}>
       <div style={{height:178,display:'flex',alignItems:'stretch',gap:7,borderBottom:'1px solid #54708B',background:'repeating-linear-gradient(to top,transparent 0,transparent calc(25% - 1px),#29445D 25%)'}}>
        {tiers.map(tier=><button key={tier} type="button" aria-label={'Show '+tier+' furnace counts'} aria-pressed={active===tier} onClick={()=>setSelectedFurnace(active===tier?null:tier)} style={{display:'flex',flex:1,alignItems:'flex-end',gap:2,justifyContent:'center',border:0,background:active===tier?'#203C56':'transparent',padding:'0 2px',cursor:'pointer',minWidth:0}}>
         {tags.map((tag,i)=>{const value=distributionMetric==='count'?groups[tag].counts[tier]:groups[tag].known?groups[tag].counts[tier]/groups[tag].known*100:0;return <span key={tag} title={tag+' '+tier+': '+(distributionMetric==='count'?value:value.toFixed(1)+'%')} style={{height:(value/maximum*100)+'%',width:'23%',minHeight:value>0?2:0,background:colors[i],borderRadius:'3px 3px 0 0'}}/>})}
        </button>)}
       </div>
       <div style={{display:'flex',gap:7,marginTop:7}}>{tiers.map(tier=><div key={tier} style={{flex:1,textAlign:'center',fontSize:11,color:active===tier?'#F2F7FD':'#B9CADB',fontWeight:active===tier?800:500}}>{tier}</div>)}</div>
      </div>
     </div>
     {active&&<div role="status" style={{background:'#102238',padding:10,borderRadius:10,marginTop:9}}>
      <strong style={{fontSize:13}}>{active}</strong>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8,marginTop:7}}>{tags.map((tag,i)=><div key={tag}><span style={{color:colors[i],fontSize:11}}>{tag}</span><div style={{fontSize:17,fontWeight:750}}>{distributionMetric==='count'?groups[tag].counts[active]:groups[tag].known?(groups[tag].counts[active]/groups[tag].known*100).toFixed(1)+'%':'—'}</div></div>)}</div>
     </div>}
     <div style={{fontSize:11,color:'#A8BFD5',marginTop:9}}>Valid levels: {tags.map(tag=>tag+' '+groups[tag].known).join(' · ')} · Unknown/out of range: {tags.reduce((n,tag)=>n+groups[tag].unknown,0)}.</div>
    </div>;
   })()}
  </div>
  {error&&<p role="alert" style={{color:'#FFB4AE',fontSize:12}}>{error}</p>}
  <p style={{fontSize:11,color:'#A8BFD5',margin:'10px 0 0'}}>Averages exclude missing values. Lab counts use the last successful state lookup.</p>
 </section>;
}
