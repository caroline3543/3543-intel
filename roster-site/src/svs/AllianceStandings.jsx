import {useState} from 'react';
import {mightpulseRequest} from '../../../src/services/mightpulseService.js';
import {normalizeRankings} from '../../../src/services/stateRankingsService.js';
import {providerFurnaceLevel} from '../../../src/services/providerProfileService.js';

const TAGS=['ARC','HOT','RKG','LUN'];
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
export function AllianceStandings({players=[]}){
 const [snapshot,setSnapshot]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [sort,setSort]=useState('avgPower'),[ascending,setAscending]=useState(false),[showOther,setShowOther]=useState(false);
 const load=async()=>{if(busy)return;setBusy(true);setError('');
  try{const result=await mightpulseRequest('rankings',{state:3573,board:'labyrinth',limit:100});
   setSnapshot(normalizeRankings(result,'3573','labyrinth'));
  }catch(e){setSnapshot(null);setError(e?.message||'Could not load state Labyrinth rankings');}
  finally{setBusy(false);}
 };
 const rows=allianceStandings(players,snapshot);
 const lab=labGroups(snapshot);
 const ordered=[...rows].sort((a,b)=>{if(sort==='tag')return ascending?a.tag.localeCompare(b.tag):b.tag.localeCompare(a.tag);
  const av=a[sort],bv=b[sort];if(av==null)return 1;if(bv==null)return -1;return ascending?av-bv:bv-av;});
 const header=(key,label)=><button type="button" onClick={()=>{if(sort===key)setAscending(!ascending);else{setSort(key);setAscending(false);}}}
  style={{background:'transparent',border:0,color:'#C7D7E8',fontSize:11,fontWeight:700,padding:'12px 3px',cursor:'pointer',minHeight:44,textAlign:key==='tag'?'left':'right',width:'100%'}}>
  {label}{sort===key?(ascending?' ↑':' ↓'):''}</button>;
 return <section aria-label="3573 alliance standings" style={{background:'#15273A',border:'1px solid #344F69',borderRadius:15,padding:12,marginTop:13}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:6}}>
   <div><h3 style={{margin:0,fontSize:17}}>Alliance standings</h3><div style={{fontSize:12,color:'#A8BFD5',marginTop:4}}>State 3573 · Top four alliances</div></div>
   <button type="button" onClick={load} disabled={busy} style={{border:'1px solid #344F69',background:'#1E3448',color:'#F1F7FD',borderRadius:9,minHeight:44,padding:'8px 10px',fontSize:12,fontWeight:650}}>{busy?'Loading…':snapshot?'Refresh Lab':'Load Lab Top 100'}</button>
  </div>
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
  {error&&<p role="alert" style={{color:'#FFB4AE',fontSize:12}}>{error}</p>}
  <p style={{fontSize:11,color:'#A8BFD5',lineHeight:1.5,margin:'10px 0 0'}}>
   Averages use saved players with valid values; missing values are excluded. Avg FC is a progression-equivalent, not a literal furnace level.
   Top 100 in Lab counts every published state leaderboard entry by its reported alliance, including players absent from saved rosters{snapshot?' · retrieved '+new Date(snapshot.retrievedAt).toLocaleString():'. Load the leaderboard to see counts.'}
  </p>
  <p style={{fontSize:11,color:'#A8BFD5',margin:'5px 0 0'}}>Coverage: {rows.map(g=>g.tag+' '+g.powerCount+'/'+g.players+' power, '+g.fcCount+'/'+g.players+' furnace').join(' · ')}</p>
 </section>;
}
