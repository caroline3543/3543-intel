import {useState} from 'react';
import {mightpulseRequest} from '../../../src/services/mightpulseService.js';
import {normalizeRankings,rankingScore} from '../../../src/services/stateRankingsService.js';
import {normalizeRosterResponse} from './RosterFurnace.jsx';
import {RosterFurnace} from './RosterFurnace.jsx';
import {ScoreDistribution} from './ScoreDistribution.jsx';
import {AllianceStandings} from './AllianceStandings.jsx';

const panel={background:'#15273A',border:'1px solid #344F69',borderRadius:15,padding:12};
const field={boxSizing:'border-box',width:'100%',minWidth:0,borderRadius:9,background:'#0F1D30',border:'1px solid #344F69',color:'#F2F7FD',fontSize:16,padding:'10px 9px'};
const btn={border:'1px solid #344F69',borderRadius:10,background:'#1E3448',color:'#F1F7FD',padding:'10px 12px',minHeight:44,fontSize:13,fontWeight:650,cursor:'pointer'};
const fmt=v=>v==null?'—':Number(v).toLocaleString('en-US');
const compact=v=>v==null?'—':Number(v)>=1e9?(v/1e9).toFixed(2)+'B':Number(v)>=1e6?(v/1e6).toFixed(2)+'M':fmt(v);
const topEight=list=>{
 if(!Array.isArray(list))return null;
 const seen=new Set();
 const scores=list.filter(p=>p?.labScore!=null&&Number.isFinite(Number(p.labScore))&&Number(p.labScore)>=0).filter(p=>{
  const id=String(p.fid||p.id||p.name||'').trim();
  if(!id||seen.has(id))return false;seen.add(id);return true;
 }).map(p=>Number(p.labScore)).sort((a,b)=>b-a);
 return scores.length>=8?{total:scores.slice(0,8).reduce((a,b)=>a+b,0),count:8}:null;
};
const topEightLead=(a,b)=>{
 if(!a||!b)return null;
 if(a.total===b.total)return {winner:-1,percent:0};
 const winner=a.total>b.total?0:1;
 const lower=Math.min(a.total,b.total);
 return {winner,percent:lower>0?(Math.max(a.total,b.total)-lower)/lower*100:null};
};
const valid=s=>/^[1-9][0-9]{0,4}$/.test(s);
function Side({label,value,color}){return <div style={{minWidth:0}}><div style={{color,fontSize:11,fontWeight:700}}>{label}</div><div style={{fontSize:25,fontWeight:800,marginTop:5,fontVariantNumeric:'tabular-nums'}}>{value}</div></div>}
export function SvsComparison({players=[]}){
 const [mode,setMode]=useState('state'),[ourState,setOurState]=useState('3573'),[theirState,setTheirState]=useState('');
 const [ourTag,setOurTag]=useState('HOT'),[theirTag,setTheirTag]=useState('');
 const [rankings,setRankings]=useState(null),[rosters,setRosters]=useState(null),[busy,setBusy]=useState(''),[errors,setErrors]=useState([]);
 const [aboutData,setAboutData]=useState(false),[showCopyPreview,setShowCopyPreview]=useState(false),[top,setTop]=useState(10),[showPlayers,setShowPlayers]=useState(false),[sort,setSort]=useState('power'),[copyStatus,setCopyStatus]=useState('');
 const key=[mode,ourState,theirState,ourTag.trim(),theirTag.trim()].join('|');
 const ready=valid(ourState)&&valid(theirState)&&(mode==='state'||(ourTag.trim()&&theirTag.trim()));
 const rankData=rankings?.key===key?rankings:null,rosterData=rosters?.key===key?rosters:null;
 const filter=(rows,i)=>mode==='state'?rows:rows.filter(r=>String(r.allianceTag||'')===(i?theirTag:ourTag).trim());
 const sides=rankData?.sides.map((r,i)=>r?filter(r.rows||[],i):null);
 const entries=sides?.map(r=>r?.slice(0,top)||[]);
 const stateScores=sides?.map(r=>r?.map(p=>p.score).filter(v=>v!=null&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0)||null);
 const labEight=rosterData?.sides?.map(topEight);
 const labLead=labEight?.length===2?topEightLead(labEight[0],labEight[1]):null;
 const copyLines=()=>{
  const lines=[mode==='state'?'STATE COMPARISON':'ALLIANCE COMPARISON',mode==='state'?ourState+' vs '+theirState:ourTag+' ('+ourState+') vs '+theirTag+' ('+theirState+')',''];
  if(mode==='alliance'&&rosterData){
   if(labLead&&labEight.every(Boolean)){
    lines.push('LABYRINTH · TOP 8',ourTag+': '+compact(labEight[0].total),theirTag+': '+compact(labEight[1].total));
    lines.push(labLead.winner===-1?'Both alliances are tied.':labLead.percent==null?'Percentage lead unavailable (lower score is zero).':(labLead.winner===0?ourTag:theirTag)+' leads by '+labLead.percent.toFixed(1)+'%.','');
   }else lines.push('LABYRINTH · TOP 8','Not enough valid scores for both alliances (8 required each).','');
   if(metrics?.every(m=>m?.power?.count)){
    const a=metrics[0].power.average,b=metrics[1].power.average;
    lines.push('AVERAGE CITY POWER',ourTag+': '+compact(Math.round(a)),theirTag+': '+compact(Math.round(b)),a===b?'Both alliances are tied.':(a>b?ourTag:theirTag)+' leads in average city power.','');
   }
   lines.push('Roster coverage: '+rosterData.sides.map((v,i)=>(i?theirTag:ourTag)+': '+(v?.length??'unavailable')+' players').join(' · '));
  }
  if(mode==='state'&&sides)lines.push('LABYRINTH · PUBLISHED TOP 100','Entries found: '+sides.map((v,i)=>(i?theirState:ourState)+': '+(v?.length??'unavailable')).join(' · '),'');
  lines.push('Based on available data; not a battle outcome prediction.');
  return lines.join('\\n');
 };
 const copy=async()=>{try{await navigator.clipboard.writeText(copyLines());setCopyStatus('Copied');}catch{setCopyStatus('Copy unavailable');}};
 const loadLab=async()=>{
  if(mode!=='state'||!ready||busy)return;setBusy('lab');setErrors([]);
  const states=[ourState,theirState];
  const results=await Promise.allSettled(states.map(state=>mightpulseRequest('rankings',{state:Number(state),board:'labyrinth',limit:100}).then(x=>normalizeRankings(x,state,'labyrinth'))));
  setRankings({key,sides:results.map(r=>r.status==='fulfilled'?r.value:null),at:new Date().toISOString()});
  setErrors(results.flatMap((r,i)=>r.status==='rejected'?[states[i]+': '+(r.reason?.message||'Could not load Labyrinth')]:[]));setBusy('');
 };
 const loadRosters=async()=>{
  if(!ready||busy||mode!=='alliance')return;setBusy('roster');setErrors([]);
  const jobs=[{state:ourState,tag:ourTag.trim()},{state:theirState,tag:theirTag.trim()}];
  const results=await Promise.allSettled(jobs.map(j=>mightpulseRequest('alliance',{state:Number(j.state),tag:j.tag}).then(r=>normalizeRosterResponse(r,j.state,j.tag))));
  setRosters({key,sides:results.map(r=>r.status==='fulfilled'?r.value:null),at:new Date().toISOString()});
  setErrors(results.flatMap((r,i)=>r.status==='rejected'?[jobs[i].tag+': '+(r.reason?.message||'Could not load roster')]:[]));setBusy('');
 };
 const rows=rosterData?.sides.map(r=>r?[...r].sort((a,b)=>sort==='power'?(b.power??-1)-(a.power??-1):sort==='lab'?(b.labScore??-1)-(a.labScore??-1):String(b.tier).localeCompare(String(a.tier))):[]);
 const totals=rosterData?.sides.map(r=>r?r.reduce((n,p)=>n+(p.power||0),0):null);
 const metrics=rosterData?.sides.map(list=>{if(!list)return null;const summarize=field=>{const values=list.map(p=>p[field]).filter(v=>v!=null&&Number.isFinite(v)).sort((a,b)=>a-b);return {count:values.length,total:values.reduce((a,b)=>a+b,0),average:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,median:values.length?(values[Math.floor((values.length-1)/2)]+values[Math.floor(values.length/2)])/2:null};};return {power:summarize('power'),lab:summarize('labScore')};});
 return <section style={{padding:'12px 16px 35px',color:'#F2F7FD'}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:14}}><div><h2 style={{fontSize:23,letterSpacing:'-.5px',margin:'0 0 3px'}}>Compare</h2><div style={{fontSize:12,color:'#A7BED4'}}>Battle intelligence</div></div><button style={{...btn,background:'transparent',border:0}} onClick={()=>setAboutData(v=>!v)}>ⓘ About data</button></div>
  {aboutData&&<div style={{...panel,fontSize:12,color:'#A8BFD5',lineHeight:1.5,marginBottom:12}}>State Labyrinth rankings use a published top-100 sample. Alliance comparisons use returned roster records. Missing scores are excluded. Alliance tags are case-sensitive. State-wide furnace counts are not available from the published top-100 Labyrinth leaderboard. Alliance furnace distributions use returned roster data.</div>}
  <div style={{background:'#15273A',borderRadius:14,padding:4,display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:12}}>{[['state','States'],['alliance','Alliances']].map(([id,label])=><button key={id} aria-pressed={mode===id} onClick={()=>{setMode(id);setErrors([])}} style={{...btn,border:0,background:mode===id?'#416181':'transparent'}}>{label}</button>)}</div>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
   {[0,1].map(i=><div key={i} style={{minWidth:0}}><label style={{color:i?'#EBC18A':'#89C4FF',fontSize:11,fontWeight:700}}>{i?'OPPONENT':'YOUR SIDE'}</label><input style={{...field,marginTop:7}} aria-label={i?'Opponent state':'Your state'} inputMode="numeric" placeholder="State ID" value={i?theirState:ourState} onChange={e=>i?setTheirState(e.target.value):setOurState(e.target.value)}/>{mode==='alliance'&&<input style={{...field,marginTop:7}} aria-label={i?'Opponent alliance':'Your alliance'} placeholder="Alliance tag" value={i?theirTag:ourTag} onChange={e=>i?setTheirTag(e.target.value):setOurTag(e.target.value)}/>}</div>)}
  </div>

  {mode==='state'&&ourState==='3573'&&<AllianceStandings players={players}/>}
  {mode==='state'&&<div style={{...panel,marginTop:13}}>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><div><h3 style={{margin:'0 0 4px',fontSize:17}}>Labyrinth rankings</h3><div style={{color:'#A8BFD5',fontSize:12}}>Published top 100 per state</div></div><button style={btn} disabled={!ready||!!busy} onClick={loadLab}>{busy==='lab'?'Loading…':rankData?'Refresh':'Compare'}</button></div>
   {rankData&&<><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:16}}>{[0,1].map(i=><Side key={i} label={i?'OPPONENT':'YOUR SIDE'} color={i?'#EBC18A':'#89C4FF'} value={sides[i]?.length??'—'}/>)}</div><div style={{fontSize:12,color:'#A8BFD5',marginTop:8}}>Matching players in the published leaderboard. This is not an overall battle-strength score.</div>
    <ScoreDistribution title="Labyrinth score distribution" description="Published top-100 leaderboard sample" ours={stateScores?.[0]} theirs={stateScores?.[1]} ourLabel={ourState} theirLabel={theirState} coverageNote="This compares published leaderboard entries, not all players in either state. Scores from missing entries are excluded."/>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginTop:16}}><label style={{fontSize:12,color:'#A8BFD5'}}>Show top <select style={{...field,width:90,marginLeft:5,fontSize:13}} value={top} onChange={e=>setTop(Number(e.target.value))}>{[10,25,50,100].map(v=><option key={v}>{v}</option>)}</select></label><button style={btn} onClick={()=>setShowPlayers(v=>!v)}>{showPlayers?'Hide players':'Show players'}</button></div>
    {showPlayers&&<div style={{marginTop:12}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:5}}>{[0,1].map(i=><strong key={i} style={{color:i?'#EBC18A':'#89C4FF',fontSize:12}}>{i?theirState:ourState}</strong>)}</div>{Array.from({length:Math.max(entries[0]?.length||0,entries[1]?.length||0)},(_,j)=>{const pair=[entries[0]?.[j],entries[1]?.[j]],scores=pair.map(p=>p?Number(rankingScore(p,'labyrinth')):NaN);return <div key={j} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,borderTop:'1px solid #30465B',padding:'9px 0',alignItems:'stretch'}}>{pair.map((p,i)=>{const score=scores[i],other=scores[1-i],valid=Number.isFinite(score)&&Number.isFinite(other);return <div key={i} style={{minWidth:0,display:'flex',flexDirection:'column',gap:5}}><strong style={{fontSize:12,overflowWrap:'anywhere'}}>{p?'#'+p.rank+' '+p.username:'No entry'}</strong><div style={{fontSize:12,fontVariantNumeric:'tabular-nums',fontWeight:700,color:!valid?'#AFC4D8':score>other?'#74D5A1':score<other?'#F49B9B':'#AFC4D8'}}>{p?'Score: '+rankingScore(p,'labyrinth'):'—'}{valid?(score>other?' ↑':score<other?' ↓':' ='):''}</div></div>})}</div>})}</div>}
   </>}
  </div>}
  {mode==='alliance'&&<div style={{...panel,marginTop:13}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><div><h3 style={{fontSize:17,margin:'0 0 4px'}}>Alliance rosters</h3><div style={{fontSize:12,color:'#A8BFD5'}}>City power · Labyrinth score · Furnace level</div></div><button style={btn} disabled={!ready||!!busy} onClick={loadRosters}>{busy==='roster'?'Loading…':rosterData?'Refresh':'Load rosters'}</button></div>
   {rosterData&&<><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:15}}>{[0,1].map(i=><div key={i} style={{background:'#10263B',borderRadius:10,padding:10}}><Side label={i?'OPPONENT':'YOUR SIDE'} color={i?'#EBC18A':'#89C4FF'} value={compact(totals[i])}/><div style={{fontSize:12,color:'#A8BFD5',marginTop:6}}>Recorded city power · {rosterData.sides[i]?.length??'—'} players</div></div>)}</div>
    <div style={{background:'#10263B',borderRadius:12,padding:12,marginTop:12}}>
     <div style={{fontWeight:700,fontSize:15}}>Labyrinth · Top 8 players</div>
     <div style={{fontSize:12,color:'#A8BFD5',marginTop:3}}>Combined scores of each alliance's eight highest-scoring players</div>
     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginTop:12}}>{[0,1].map(i=><div key={i}><div style={{fontSize:12,color:i?'#EBC18A':'#89C4FF'}}>{i?theirTag:ourTag}</div><strong style={{fontSize:22}}>{labEight?.[i]?compact(labEight[i].total):'—'}</strong></div>)}</div>
     <div style={{marginTop:10,fontSize:13,color:labLead?'#F1F7FD':'#A8BFD5',fontWeight:labLead?700:400}}>{labLead?(labLead.winner===-1?'Both alliances are tied':labLead.percent==null?'Percentage lead unavailable (lower score is zero)':(labLead.winner===0?ourTag:theirTag)+' leads by '+labLead.percent.toFixed(1)+'%'):'Not enough data: 8 valid player scores required per alliance.'}</div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginTop:10}}>{metrics.map((m,i)=><div key={i} style={{background:'#102238',borderRadius:10,padding:10,minWidth:0}}><strong style={{color:i?'#EBC18A':'#89C4FF',fontSize:12}}>{i?theirTag:ourTag}</strong>{[['City power',m?.power],['Labyrinth score',m?.lab]].map(([label,stat])=><div key={label} style={{borderTop:'1px solid #30465B',marginTop:8,paddingTop:8}}><div style={{fontSize:12,color:'#AFC4D8'}}>{label}</div><div style={{fontSize:11,marginTop:3}}>Total {stat?.count?compact(stat.total):'—'} · Avg {stat?.average!=null?compact(Math.round(stat.average)):'—'}</div><div style={{fontSize:11,marginTop:3}}>Median {stat?.median!=null?compact(Math.round(stat.median)):'—'} · {stat?.count??0} with data</div></div>)}</div>)}</div>
    <ScoreDistribution title="Labyrinth score distribution" description="Recorded alliance members" ours={rosterData.sides[0]?.map(p=>p.labScore)} theirs={rosterData.sides[1]?.map(p=>p.labScore)} ourLabel={ourTag} theirLabel={theirTag} coverageNote="Based on returned alliance rosters. Players without a valid Labyrinth score are excluded; this is not a complete state sample."/>
    {rosterData.sides[0]&&rosterData.sides[1]&&<RosterFurnace ours={rosterData.sides[0]} theirs={rosterData.sides[1]} ourLabel={ourTag} theirLabel={theirTag}/>}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:14}}><h4 style={{margin:0,fontSize:15}}>Players by {sort==='power'?'city power':sort==='lab'?'Labyrinth score':'furnace'}</h4><select aria-label="Sort roster players" style={{...field,width:135,fontSize:13}} value={sort} onChange={e=>setSort(e.target.value)}><option value="power">City power</option><option value="lab">Labyrinth score</option><option value="furnace">Furnace</option></select></div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:9}}>{rows.map((list,i)=><div key={i}><div style={{color:i?'#EBC18A':'#89C4FF',fontSize:12,fontWeight:700}}>{i?theirTag:ourTag}</div>{list.slice(0,100).map(p=><div key={p.fid} style={{padding:'9px 0',borderBottom:'1px solid #30465B',fontSize:12,overflowWrap:'anywhere'}}><strong>{p.name}</strong><div style={{color:'#B4C8DD',marginTop:3}}>{p.level} · City {compact(p.power)} · Lab {compact(p.labScore)}</div></div>)}{!list.length&&<p style={{fontSize:12,color:'#A8BFD5'}}>No roster data</p>}</div>)}</div>
   </>}
  </div>}
  {(rosterData||rankData)&&<div style={{...panel,marginTop:14}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><div><strong style={{fontSize:16}}>Share comparison</strong><div style={{fontSize:12,color:'#A8BFD5',marginTop:3}}>Plain-language results for alliance chat</div></div><button style={{...btn,background:'transparent'}} onClick={()=>setShowCopyPreview(v=>!v)}>{showCopyPreview?'Hide':'Preview'}</button></div>
   {showCopyPreview&&<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit',fontSize:12,lineHeight:1.6,background:'#102238',padding:12,borderRadius:10}}>{copyLines()}</pre>}
   <button style={{...btn,width:'100%',marginTop:10,background:'#355879'}} onClick={copy}>Copy results</button>
  </div>}
  {errors.length>0&&<div role="alert" style={{...panel,marginTop:12,color:'#F2C58B'}}>{errors.map((e,i)=><div key={i}>{e}</div>)}</div>}
  {copyStatus&&<p role="status" style={{color:'#A8BFD5',fontSize:12}}>{copyStatus}</p>}
  <p style={{fontSize:11,color:'#91A9BF',lineHeight:1.5,marginTop:15}}>State-wide furnace counts are unavailable without a verified full-state dataset. State Labyrinth rankings are a published top-100 sample. Alliance roster statistics reflect returned members only. Alliance tags are case-sensitive. Missing values are not counted as zero. Read-only lookups do not alter Members or TAL data.</p>
 </section>;
}
