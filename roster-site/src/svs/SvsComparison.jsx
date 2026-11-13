import {useState} from 'react';
import {mightpulseRequest} from '../../../src/services/mightpulseService.js';
import {normalizeRankings,rankingScore} from '../../../src/services/stateRankingsService.js';
import {normalizeRosterResponse} from './RosterFurnace.jsx';
import {RosterFurnace} from './RosterFurnace.jsx';

const panel={background:'#17283D',border:'1px solid #2B4157',borderRadius:14,padding:14};
const field={boxSizing:'border-box',width:'100%',minWidth:0,borderRadius:9,background:'#102238',border:'1px solid #36516B',color:'#F2F7FD',fontSize:16,padding:'11px 10px'};
const btn={border:'1px solid #36516B',borderRadius:10,background:'#213850',color:'#F1F7FD',padding:'10px 12px',minHeight:44,fontSize:13,fontWeight:650,cursor:'pointer'};
const fmt=v=>v==null?'—':Number(v).toLocaleString('en-US');
const compact=v=>v==null?'—':Number(v)>=1e9?(v/1e9).toFixed(2)+'B':Number(v)>=1e6?(v/1e6).toFixed(2)+'M':fmt(v);
const valid=s=>/^[1-9][0-9]{0,4}$/.test(s);
function Side({label,value,color}){return <div style={{minWidth:0}}><div style={{color,fontSize:11,fontWeight:700}}>{label}</div><div style={{fontSize:25,fontWeight:800,marginTop:5,fontVariantNumeric:'tabular-nums'}}>{value}</div></div>}
export function SvsComparison(){
 const [mode,setMode]=useState('state'),[ourState,setOurState]=useState('3573'),[theirState,setTheirState]=useState('');
 const [ourTag,setOurTag]=useState('HOT'),[theirTag,setTheirTag]=useState('');
 const [rankings,setRankings]=useState(null),[rosters,setRosters]=useState(null),[busy,setBusy]=useState(''),[errors,setErrors]=useState([]);
 const [top,setTop]=useState(10),[showPlayers,setShowPlayers]=useState(false),[sort,setSort]=useState('power'),[copyStatus,setCopyStatus]=useState('');
 const key=[mode,ourState,theirState,ourTag.trim().toUpperCase(),theirTag.trim().toUpperCase()].join('|');
 const ready=valid(ourState)&&valid(theirState)&&(mode==='state'||(ourTag.trim()&&theirTag.trim()));
 const rankData=rankings?.key===key?rankings:null,rosterData=rosters?.key===key?rosters:null;
 const filter=(rows,i)=>mode==='state'?rows:rows.filter(r=>String(r.allianceTag||'').toUpperCase()===(i?theirTag:ourTag).trim().toUpperCase());
 const sides=rankData?.sides.map((r,i)=>r?filter(r.rows||[],i):null);
 const entries=sides?.map(r=>r?.slice(0,top)||[]);
 const copy=async()=>{
  const lines=['BATTLE COMPARISON',mode==='state'?ourState+' vs '+theirState:'['+ourTag+'] '+ourState+' vs ['+theirTag+'] '+theirState,''];
  if(sides)lines.push('Labyrinth leaderboard entries (published top 100): '+sides.map(s=>s?.length??'Unavailable').join(' vs '),'Top '+top+' ranked entries: '+entries.map(s=>s.length).join(' vs '));
  if(rosterData)lines.push('Alliance roster sizes: '+rosterData.sides.map(s=>s?.length??'Unavailable').join(' vs '),'Recorded city power: '+rosterData.sides.map(s=>s?compact(s.reduce((n,p)=>n+(p.power||0),0)):'Unavailable').join(' vs '));
  lines.push('Source: WhiteoutStats. Labyrinth data is limited to the published top 100 per state.');
  try{await navigator.clipboard.writeText(lines.join('\\n'));setCopyStatus('Copied');}catch{setCopyStatus('Copy unavailable');}
 };
 const loadLab=async()=>{
  if(!ready||busy)return;setBusy('lab');setErrors([]);
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
 const rows=rosterData?.sides.map(r=>r?[...r].sort((a,b)=>sort==='power'?(b.power||0)-(a.power||0):String(b.tier).localeCompare(String(a.tier))):[]);
 const totals=rosterData?.sides.map(r=>r?r.reduce((n,p)=>n+(p.power||0),0):null);
 return <section style={{padding:'12px 16px 35px',color:'#F2F7FD'}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:14}}><div><h2 style={{fontSize:23,letterSpacing:'-.5px',margin:'0 0 3px'}}>Compare</h2><div style={{fontSize:12,color:'#A7BED4'}}>Battle intelligence</div></div><button style={btn} disabled={!rankData&&!rosterData} onClick={copy}>Copy summary</button></div>
  <div style={{...panel,padding:5,display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:12}}>{[['state','States'],['alliance','Alliances']].map(([id,label])=><button key={id} aria-pressed={mode===id} onClick={()=>{setMode(id);setErrors([])}} style={{...btn,border:0,background:mode===id?'#416181':'transparent'}}>{label}</button>)}</div>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
   {[0,1].map(i=><div key={i} style={panel}><label style={{color:i?'#EBC18A':'#89C4FF',fontSize:11,fontWeight:700}}>{i?'OPPONENT':'YOUR SIDE'}</label><input style={{...field,marginTop:7}} aria-label={i?'Opponent state':'Your state'} inputMode="numeric" placeholder="State ID" value={i?theirState:ourState} onChange={e=>i?setTheirState(e.target.value):setOurState(e.target.value)}/>{mode==='alliance'&&<input style={{...field,marginTop:7}} aria-label={i?'Opponent alliance':'Your alliance'} placeholder="Alliance tag" value={i?theirTag:ourTag} onChange={e=>i?setTheirTag(e.target.value.toUpperCase()):setOurTag(e.target.value.toUpperCase())}/>}</div>)}
  </div>
  <div style={{...panel,marginTop:13}}>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><div><h3 style={{margin:'0 0 4px',fontSize:17}}>Labyrinth rankings</h3><div style={{color:'#A8BFD5',fontSize:12}}>Published top 100 per state</div></div><button style={btn} disabled={!ready||!!busy} onClick={loadLab}>{busy==='lab'?'Loading…':rankData?'Refresh':'Compare'}</button></div>
   {rankData&&<><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:16}}>{[0,1].map(i=><Side key={i} label={i?'OPPONENT':'YOUR SIDE'} color={i?'#EBC18A':'#89C4FF'} value={sides[i]?.length??'—'}/>)}</div><div style={{fontSize:12,color:'#A8BFD5',marginTop:8}}>Matching players in the published leaderboard. This is not an overall battle-strength score.</div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginTop:16}}><label style={{fontSize:12,color:'#A8BFD5'}}>Show top <select style={{...field,width:90,marginLeft:5,fontSize:13}} value={top} onChange={e=>setTop(Number(e.target.value))}>{[10,25,50,100].map(v=><option key={v}>{v}</option>)}</select></label><button style={btn} onClick={()=>setShowPlayers(v=>!v)}>{showPlayers?'Hide players':'Show players'}</button></div>
    {showPlayers&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}>{entries.map((list,i)=><div key={i}><div style={{color:i?'#EBC18A':'#89C4FF',fontSize:12,fontWeight:700,marginBottom:5}}>{i?(mode==='state'?theirState:theirTag):(mode==='state'?ourState:ourTag)}</div>{list.map((p,j)=><div key={p.key||j} style={{padding:'8px 0',borderTop:'1px solid #30465B',fontSize:12,overflowWrap:'anywhere'}}><strong>#{p.rank} {p.username}</strong><div style={{color:'#AFC4D8',marginTop:3}}>Score: {rankingScore(p,'labyrinth')}</div></div>)}{!list.length&&<p style={{color:'#AFC4D8',fontSize:12}}>No matching entries</p>}</div>)}</div>}
   </>}
  </div>
  {mode==='alliance'&&<div style={{...panel,marginTop:13}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><div><h3 style={{fontSize:17,margin:'0 0 4px'}}>Alliance rosters</h3><div style={{fontSize:12,color:'#A8BFD5'}}>City power and furnace levels</div></div><button style={btn} disabled={!ready||!!busy} onClick={loadRosters}>{busy==='roster'?'Loading…':rosterData?'Refresh':'Load rosters'}</button></div>
   {rosterData&&<><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:15}}>{[0,1].map(i=><div key={i} style={{background:'#10263B',borderRadius:10,padding:10}}><Side label={i?'OPPONENT':'YOUR SIDE'} color={i?'#EBC18A':'#89C4FF'} value={compact(totals[i])}/><div style={{fontSize:12,color:'#A8BFD5',marginTop:6}}>Recorded city power · {rosterData.sides[i]?.length??'—'} players</div></div>)}</div>
    {rosterData.sides[0]&&rosterData.sides[1]&&<RosterFurnace ours={rosterData.sides[0]} theirs={rosterData.sides[1]} ourLabel={ourTag} theirLabel={theirTag}/>}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:14}}><h4 style={{margin:0,fontSize:15}}>Players by {sort==='power'?'city power':'furnace'}</h4><select aria-label="Sort roster players" style={{...field,width:135,fontSize:13}} value={sort} onChange={e=>setSort(e.target.value)}><option value="power">City power</option><option value="furnace">Furnace</option></select></div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:9}}>{rows.map((list,i)=><div key={i}><div style={{color:i?'#EBC18A':'#89C4FF',fontSize:12,fontWeight:700}}>{i?theirTag:ourTag}</div>{list.slice(0,100).map(p=><div key={p.fid} style={{padding:'9px 0',borderBottom:'1px solid #30465B',fontSize:12,overflowWrap:'anywhere'}}><strong>{p.name}</strong><div style={{color:'#B4C8DD',marginTop:3}}>{p.level} · {compact(p.power)}</div></div>)}{!list.length&&<p style={{fontSize:12,color:'#A8BFD5'}}>No roster data</p>}</div>)}</div>
   </>}
  </div>}
  {errors.length>0&&<div role="alert" style={{...panel,marginTop:12,color:'#F2C58B'}}>{errors.map((e,i)=><div key={i}>{e}</div>)}</div>}
  {copyStatus&&<p role="status" style={{color:'#A8BFD5',fontSize:12}}>{copyStatus}</p>}
  <p style={{fontSize:11,color:'#91A9BF',lineHeight:1.5,marginTop:15}}>Rankings are a top-100 sample. Alliance roster statistics reflect returned members only. Missing values are not counted as zero. Read-only lookups do not alter Members or TAL data.</p>
 </section>;
}
