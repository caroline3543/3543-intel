import {useState} from 'react';
import {C} from '../../../src/utils/constants.js';
import {mightpulseRequest} from '../../../src/services/mightpulseService.js';
import {normalizeRankings,rankingScore} from '../../../src/services/stateRankingsService.js';
import {normalizeRosterResponse,aggregateRoster} from './RosterFurnace.jsx';
import {countFurnace} from './FurnaceDistribution.jsx';

const boards=[
 ['personal_power','Personal power'],['troop_power','Troop power'],['hero_total','Hero power'],['pet_power','Pet power'],
 ['chief_gear','Chief gear'],['chief_charm','Chief charms'],['research_power','Research power'],['building_power','Building power'],
 ['kills','Kills'],['labyrinth','Labyrinth'],['furnace','Furnace'],['state_transfer','Transfer score'],
 ['single_hero','Strongest hero'],['hero_no_equip','Hero power without gear'],['hero_equip','Hero equipment'],
 ['island_prosperity','Island prosperity'],['alliance_power','Alliance power'],['alliance_kills','Alliance kills'],
 ['rebel_conquest','Rebel conquest'],['land_of_heroes','Land of Heroes'],['cave_of_monsters','Cave of Monsters'],
 ['charm_mine','Charm Mine'],['research_center','Research Center'],['gear_forge','Gear Forge'],['gaia_heart','Gaia Heart'],['master_power','Master power']
];
const panel={background:'#17283D',border:'1px solid #293E55',borderRadius:13,padding:13};
const input={background:'#0E1D30',border:'1px solid #36506A',borderRadius:9,color:'#F3F7FF',padding:'10px',fontSize:16,width:'100%',minWidth:0,boxSizing:'border-box'};
const button={border:'1px solid #36506A',background:'#20364D',borderRadius:9,color:'#D9E7F7',minHeight:42,padding:'9px 12px',fontWeight:650,cursor:'pointer'};
const n=x=>{const v=Number(x);return Number.isFinite(v)?v:null;};
const fmt=x=>x==null?'—':Math.abs(x)>=1e9?(x/1e9).toFixed(2)+'B':Math.abs(x)>=1e6?(x/1e6).toFixed(2)+'M':Math.round(x).toLocaleString();
const topSum=(rows,count)=>{const vals=rows.slice(0,count).map(r=>n(r.score)).filter(v=>v!=null);return vals.length?vals.reduce((a,b)=>a+b,0):null;};
const levels=['FC10','FC9','FC8','FC7','FC6','FC5'];
function Duel({label,a,b,selected,onClick,unit='',note=''}) {
 const max=Math.max(a||0,b||0,1);
 return <button type="button" onClick={onClick} aria-pressed={selected} style={{...panel,width:'100%',color:'#EAF2FB',textAlign:'left',cursor:'pointer',background:selected?'#203851':'#17283D'}}>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1.35fr 1fr',alignItems:'center',gap:5}}>
   <strong style={{color:'#89C4FF',fontSize:16,fontVariantNumeric:'tabular-nums'}}>{fmt(a)}{unit}</strong>
   <span style={{fontSize:12,fontWeight:650,textAlign:'center'}}>{label}<span style={{display:'block',fontSize:10,fontWeight:450,color:a==null||b==null?'#91A6BE':a>b?'#89C4FF':b>a?'#EBC18A':'#A5B7C9',marginTop:3}}>{a==null||b==null?'Incomplete':a>b?'Your lead':b>a?'Their lead':'Tied'}</span></span>
   <strong style={{color:'#EBC18A',fontSize:16,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{fmt(b)}{unit}</strong>
  </div>
  <div style={{display:'grid',gridTemplateColumns:'1fr 2px 1fr',gap:5,alignItems:'center',marginTop:11}}>
   <div style={{height:7,background:'#304255',borderRadius:8,display:'flex',justifyContent:'flex-end',overflow:'hidden'}}>{a!=null&&<div style={{height:'100%',width:(a/max*100)+'%',background:'#77B9FA',borderRadius:8}}/>}</div>
   <div style={{height:13,background:'#71869A'}}/>
   <div style={{height:7,background:'#304255',borderRadius:8,overflow:'hidden'}}>{b!=null&&<div style={{height:'100%',width:(b/max*100)+'%',background:'#E6B675',borderRadius:8}}/>}</div>
  </div>
  {note&&<div style={{fontSize:10,color:'#8EA6C0',marginTop:7}}>{note}</div>}
 </button>;
}
export function SvsComparison(){
 const [mode,setMode]=useState('state'),[ours,setOurs]=useState('3573'),[theirs,setTheirs]=useState(''),[ourTag,setOurTag]=useState('HOT'),[theirTag,setTheirTag]=useState('');
 const [view,setView]=useState('overview'),[board,setBoard]=useState('troop_power'),[limit,setLimit]=useState(10);
 const [cache,setCache]=useState({}),[busy,setBusy]=useState(false),[errors,setErrors]=useState([]),[at,setAt]=useState(''),[rosters,setRosters]=useState(null),[detail,setDetail]=useState(false);
 const valid=/^[1-9]\d{0,4}$/.test(ours)&&/^[1-9]\d{0,4}$/.test(theirs)&&(mode==='state'||(ourTag.trim()&&theirTag.trim()));
 const key=mode+'|'+ours+'|'+theirs+'|'+ourTag.toUpperCase()+'|'+theirTag.toUpperCase();
 const snapshot=cache[key]||{};
 const list=mode==='alliance'?boards.filter(x=>!x[0].startsWith('alliance_')):boards;
 const getRows=(b,i)=>{const rows=snapshot[b]?.[i]?.rows||[];return mode==='alliance'?rows.filter(r=>String(r.allianceTag||'').toUpperCase()===(i?theirTag:ourTag).trim().toUpperCase()):rows;};
 const load=async (requested=board)=>{
  if(!valid||busy)return;setBusy(true);setErrors([]);setDetail(false);
  const needed=[requested,...(requested==='furnace'?[]:['furnace'])].filter((v,i,a)=>a.indexOf(v)===i);
  const next={...snapshot};const failures=[];
  for(const b of needed){
   if(next[b])continue;
   const states=[ours,theirs];
   const results=await Promise.allSettled(states.map(state=>mightpulseRequest('rankings',{state:Number(state),board:b,limit:100}).then(r=>normalizeRankings(r,state,b))));
   next[b]=results.map((r,i)=>r.status==='fulfilled'?r.value:null);
   results.forEach((r,i)=>{if(r.status==='rejected')failures.push(states[i]+' · '+b+': '+(r.reason?.message||'Unavailable'));});
  }
  setCache(prev=>({...prev,[key]:next}));setErrors(failures);setAt(new Date().toISOString());setBusy(false);
 };
 const loadRosters=async()=>{
  if(!valid||busy||mode!=='alliance')return;
  setBusy(true);setErrors([]);
  const jobs=[{state:ours,tag:ourTag},{state:theirs,tag:theirTag}];
  const result=await Promise.allSettled(jobs.map(j=>mightpulseRequest('alliance',{state:Number(j.state),tag:j.tag}).then(r=>aggregateRoster([{job:j,players:normalizeRosterResponse(r,j.state,j.tag)}]))));
  setRosters({key,data:result.map(r=>r.status==='fulfilled'?r.value:null)});
  setErrors(result.flatMap((r,i)=>r.status==='rejected'?[jobs[i].tag+': '+(r.reason?.message||'Unavailable')]:[]));
  setBusy(false);
 };
 const report=()=>{const lines=['BATTLE INTELLIGENCE',mode==='state'?ours+' vs '+theirs:'['+ourTag+'] '+ours+' vs ['+theirTag+'] '+theirs,'Published top-100 leaderboard sample, not complete state totals',''];for(const [id,label] of list){if(!snapshot[id])continue;const a=getRows(id,0),b=getRows(id,1);lines.push(label+': '+fmt(topSum(a,limit))+' vs '+fmt(topSum(b,limit)));}navigator.clipboard?.writeText(lines.join('\n'));};
 const metricRows=view==='overview'?boards.filter(x=>['troop_power','hero_total','labyrinth','pet_power','chief_gear','furnace'].includes(x[0])):view==='power'?boards.filter(x=>['personal_power','troop_power','hero_total','pet_power','chief_gear','chief_charm','research_power','building_power','kills'].includes(x[0])):view==='rankings'?list:view==='furnace'?[['furnace','Furnace levels']]:[];
 const boardA=getRows(board,0),boardB=getRows(board,1);
 const topA=topSum(boardA,limit),topB=topSum(boardB,limit);
 const loaded=Object.keys(snapshot).length>0;
 const rowsFor=(id,i)=>getRows(id,i);
 return <section style={{padding:'12px 16px 30px',color:'#F2F7FC',fontSize:14}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:14}}><div><h2 style={{fontSize:23,letterSpacing:'-.6px',margin:'0 0 4px'}}>Battle intelligence</h2><span style={{fontSize:12,color:'#9EB5CC'}}>State and alliance comparison</span></div><button style={button} onClick={report} disabled={!loaded}>Copy report</button></div>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,background:'#17283D',padding:5,borderRadius:12,marginBottom:12}}>{[['state','States'],['alliance','Alliances']].map(([id,label])=><button key={id} onClick={()=>{setMode(id);setRosters(null);setDetail(false)}} aria-pressed={mode===id} style={{...button,border:0,background:mode===id?'#426184':'transparent',color:mode===id?'white':'#AFC3D7'}}>{label}</button>)}</div>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:12}}>
   {[0,1].map(i=><div key={i} style={panel}><label style={{fontSize:11,color:i?'#EBC18A':'#89C4FF',fontWeight:700}}>{i?'OPPONENT':'YOUR SIDE'}</label><input aria-label={i?'Opponent state':'Your state'} inputMode="numeric" value={i?theirs:ours} onChange={e=>i?setTheirs(e.target.value):setOurs(e.target.value)} placeholder="State ID" style={{...input,marginTop:7}}/>{mode==='alliance'&&<input aria-label={i?'Opponent alliance':'Your alliance'} value={i?theirTag:ourTag} onChange={e=>i?setTheirTag(e.target.value.toUpperCase()):setOurTag(e.target.value.toUpperCase())} placeholder="Alliance tag" style={{...input,marginTop:7}}/>}</div>)}
  </div>
  <button style={{...button,width:'100%',background:valid?'#D8B46F':'#24374A',color:valid?'#172536':'#8299AE',fontSize:15}} disabled={!valid||busy} onClick={()=>load()}>{busy?'Loading…':loaded?'Refresh / load selected metric':'Compare states'}</button>
  {errors.length>0&&<div role="alert" style={{...panel,marginTop:10,color:'#F4C68E'}}><strong>Some data could not be loaded</strong><details><summary style={{marginTop:5}}>View details</summary>{errors.map((e,i)=><p key={i} style={{fontSize:12}}>{e}</p>)}</details></div>}
  {loaded&&<><div style={{...panel,marginTop:14,marginBottom:13}}>
   <div style={{display:'flex',justifyContent:'space-between',color:'#A9BED3',fontSize:11}}><strong>COMPARISON SNAPSHOT</strong><span>{at?new Date(at).toLocaleTimeString():''}</span></div>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,margin:'13px 0'}}>
    {[0,1].map(i=>{let wins=0;for(const [id] of boards){if(!snapshot[id])continue;const a=topSum(rowsFor(id,0),10),b=topSum(rowsFor(id,1),10);if(a!=null&&b!=null&&(i?b>a:a>b))wins++;}return <div key={i} style={{textAlign:'center'}}><div style={{fontSize:30,fontWeight:800,color:i?'#EBC18A':'#89C4FF'}}>{wins}</div><div style={{fontSize:12,color:'#B5C7D9'}}>{i?'Their leads':'Your leads'}</div></div>})}
   </div><div style={{fontSize:12,color:'#AFC3D8',lineHeight:1.5}}>Lead counts cover loaded comparable metrics only. Rankings and furnace levels are not battle-power scores.</div>
  </div>
  <div style={{display:'flex',gap:5,overflowX:'auto',paddingBottom:8,marginBottom:9}}>{[['overview','Overview'],['power','Power'],['rankings','Rankings'],['furnace','Furnace'],['players','Players']].map(([id,label])=><button key={id} onClick={()=>setView(id)} style={{...button,flexShrink:0,minHeight:36,padding:'7px 11px',background:view===id?'#426184':'#1B2C42',border:0}}>{label}</button>)}</div>
  {view!=='players'&&<><h3 style={{fontSize:17,margin:'9px 0 12px'}}>Head-to-head</h3><div style={{display:'flex',justifyContent:'space-between',color:'#A9BFD4',fontSize:12,marginBottom:8}}><span style={{color:'#89C4FF'}}>{mode==='alliance'?ourTag:ours}</span><span style={{color:'#EBC18A'}}>{mode==='alliance'?theirTag:theirs}</span></div>
  <div style={{display:'grid',gap:8}}>{metricRows.map(([id,label])=>{const a=rowsFor(id,0),b=rowsFor(id,1),exists=!!snapshot[id];const va=id==='furnace'?null:exists?topSum(a,limit):null,vb=id==='furnace'?null:exists?topSum(b,limit):null;return <div key={id}><Duel label={label} a={va} b={vb} selected={board===id} note={id==='furnace'?'Tap for furnace distribution':!exists?'Not loaded · tap to fetch':'Published top '+limit+' only'} onClick={()=>{setBoard(id);setDetail(true);if(!snapshot[id])load(id);}}/></div>})}</div>
  {view==='furnace'&&snapshot.furnace&&<div style={{...panel,marginTop:12}}><h3 style={{margin:'0 0 8px',fontSize:16}}>Furnace distribution</h3><p style={{fontSize:12,color:'#AFC3D8'}}>Counts reflect published top-100 furnace leaderboard entries, not the entire state.</p>{levels.map(level=>{const a=countFurnace(rowsFor('furnace',0))[level]||0,b=countFurnace(rowsFor('furnace',1))[level]||0;return <Duel key={level} label={level} a={a} b={b} onClick={()=>{}}/>})}</div>}
  </>}
  {view==='players'&&<div style={panel}><h3 style={{margin:'0 0 10px'}}>Top players</h3><label style={{fontSize:12,color:'#AFC3D8'}}>Leaderboard<select value={board} onChange={e=>{setBoard(e.target.value);if(!snapshot[e.target.value])load(e.target.value)}} style={{...input,margin:'7px 0'}}>{list.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>{[boardA,boardB].map((rows,i)=><div key={i}><strong style={{color:i?'#EBC18A':'#89C4FF',fontSize:12}}>{i?(mode==='alliance'?theirTag:theirs):(mode==='alliance'?ourTag:ours)}</strong>{rows.slice(0,limit).map((r,j)=><div key={r.key||j} style={{padding:'9px 0',borderBottom:'1px solid #30465C',fontSize:12,overflowWrap:'anywhere'}}>#{r.rank} {r.username}<div style={{color:'#AFC3D8',marginTop:3}}>{rankingScore(r,board)}</div></div>)}{!rows.length&&<p style={{fontSize:12,color:'#AFC3D8'}}>No matching entries</p>}</div>)}</div></div>}
  {detail&&view!=='players'&&<div style={{...panel,marginTop:12,borderColor:'#507392'}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong>{boards.find(x=>x[0]===board)?.[1]}</strong><button style={{...button,minHeight:28,padding:'2px 9px'}} onClick={()=>setDetail(false)}>Close</button></div><p style={{color:'#AFC3D8',fontSize:12}}>Top {limit} recorded leaderboard scores. Missing entries are not zero.</p><Duel label="Top score sum" a={topA} b={topB} onClick={()=>{}}/><button style={{...button,width:'100%',marginTop:10}} onClick={()=>setView('players')}>View ranked players</button></div>}
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:13}}><label style={{color:'#AFC3D8',fontSize:12}}>Compare top <select value={limit} onChange={e=>setLimit(Number(e.target.value))} style={{...input,width:90,marginLeft:6}}>{[10,25,50,100].map(x=><option key={x}>{x}</option>)}</select></label><button style={button} onClick={report}>Copy report</button></div>
  {mode==='alliance'&&<div style={{...panel,marginTop:14}}><h3 style={{margin:'0 0 5px'}}>Complete alliance roster</h3><p style={{color:'#AFC3D8',fontSize:12}}>Fetch both alliances separately for a more complete furnace distribution. This does not change your saved roster.</p><button style={button} onClick={loadRosters} disabled={busy}>Load alliance rosters</button>{rosters?.key===key&&<p style={{fontSize:12,color:'#BFD2E4'}}>Roster response: {rosters.data.map((x,i)=>x?'Loaded '+(i?'opponent':'your')+' alliance':'Unavailable').join(' · ')}</p>}</div>}
  <p style={{fontSize:11,color:'#90A8BF',lineHeight:1.5,marginTop:16}}>Data source: WhiteoutStats through the existing secured lookup. Published leaderboards contain at most 100 entries per state. Values are not complete state totals. Last fetched: {at?new Date(at).toLocaleString():'—'}.</p>
  </>}
 </section>;
}
