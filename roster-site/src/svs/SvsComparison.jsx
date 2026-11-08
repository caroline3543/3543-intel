import {useEffect,useMemo,useState} from 'react';
import {C} from '../../../src/utils/constants.js';
import {mightpulseRequest} from '../../../src/services/mightpulseService.js';
import {normalizeRankings,rankingScore} from '../../../src/services/stateRankingsService.js';
const style={width:'100%',boxSizing:'border-box',border:'1px solid '+C.border,background:C.section,color:C.white,padding:'11px 12px',minHeight:44,borderRadius:10,fontSize:15};
const btn={...style,width:'auto',fontWeight:650,cursor:'pointer'};
const groups=[
 {label:'Battle strength',items:[['personal_power','Personal power'],['troop_power','Troop power'],['kills','Kills'],['furnace','Furnace level'],['state_transfer','State transfer score']]},
 {label:'Heroes & development',items:[['hero_total','Total hero power'],['single_hero','Single hero power'],['labyrinth','Labyrinth'],['pet_power','Pet power'],['chief_gear','Chief gear power'],['chief_charm','Chief charm power']]},
 {label:'Progression',items:[['research_power','Research power'],['building_power','Building power'],['island_prosperity','Island prosperity']]},
 {label:'Alliances',items:[['alliance_power','Alliance power'],['alliance_kills','Alliance kills']]}
];
const boards=groups.flatMap(group=>group.items);
const toNum=value=>{const v=Number(value);return Number.isFinite(v)?v:null;};
const format=v=>v==null?'No data':Number(v).toLocaleString('en-US',{maximumFractionDigits:0});
function summary(rows,mode,tag){
 const filtered=mode==='alliance'?rows.filter(r=>r.allianceTag.toLowerCase()===tag.trim().toLowerCase() || r.username.toLowerCase()===tag.trim().toLowerCase()):rows;
 const nums=filtered.map(r=>toNum(r.score)).filter(n=>n!=null);
 return {rows:filtered,count:filtered.length,total:nums.length?nums.reduce((a,b)=>a+b,0):null,top10:nums.length?nums.slice(0,10).reduce((a,b)=>a+b,0):null};
}
const delta=(a,b)=>a==null||b==null||!b?'—':((a-b)/b*100>=0?'+':'')+((a-b)/b*100).toFixed(1)+'%';
function CompareBar({a,b}){const max=Math.max(a||0,b||0,1);return <div style={{display:'grid',gap:5,marginTop:10}}><div style={{height:9,background:C.section,borderRadius:9,overflow:'hidden'}}><div style={{height:'100%',width:(Math.max(0,a||0)/max*100)+'%',background:C.gold,borderRadius:9}}/></div><div style={{height:9,background:C.section,borderRadius:9,overflow:'hidden'}}><div style={{height:'100%',width:(Math.max(0,b||0)/max*100)+'%',background:C.blue,borderRadius:9}}/></div></div>;}
export function SvsComparison({players=[]}){
 const [mode,setMode]=useState('state'),[ourState,setOurState]=useState('3573'),[enemyState,setEnemyState]=useState(''),[ourTag,setOurTag]=useState('HOT'),[enemyTag,setEnemyTag]=useState(''),[board,setBoard]=useState('personal_power');
 const [snapshots,setSnapshots]=useState(null),[errors,setErrors]=useState([]),[busy,setBusy]=useState(false);
 const valid=id=>/^[1-9]\d{0,4}$/.test(String(id));
 const ready=valid(ourState)&&valid(enemyState)&&(mode==='state'||(ourTag.trim()&&enemyTag.trim()));
 useEffect(()=>{setSnapshots(null);setErrors([]);},[mode,ourState,enemyState,ourTag,enemyTag]);
 async function loadBoard(key,targets,previous=null){
  setBusy(true);setErrors([]);
  const results=previous?.results?.map(v=>({...v}))||[{},{}];
  const fail=[];
  // Load only the selected board, for both states. Fetching all 16 boards at once
  // would consume 32 protected API requests and can exhaust the daily allowance.
  const requests=await Promise.allSettled(targets.map((target,index)=>results[index][key]
    ?Promise.resolve(results[index][key])
    :mightpulseRequest('rankings',{state:Number(target.state),board:key,limit:100})
      .then(response=>normalizeRankings(response,target.state,key))));
  requests.forEach((item,index)=>{if(item.status==='fulfilled')results[index][key]=item.value;
    else fail.push(targets[index].state+' · '+key+': '+(item.reason?.message||'Unavailable'));});
  setSnapshots({results,targets,at:new Date().toISOString()});setErrors(fail);setBusy(false);
 }
 async function compare(){
  if(!ready)return;
  const targets=[{state:ourState,label:mode==='state'?'Our state':'Our alliance',tag:ourTag},{state:enemyState,label:mode==='state'?'Opponent state':'Opponent alliance',tag:enemyTag}];
  await loadBoard(board,targets,null);
 }
 async function chooseBoard(key){setBoard(key);if(snapshots)await loadBoard(key,snapshots.targets,snapshots);}

 const left=snapshots?.results?.[0]?.[board],right=snapshots?.results?.[1]?.[board];
 const a=left?summary(left.rows,mode,ourTag):null,b=right?summary(right.rows,mode,enemyTag):null;
 const isFurnace=board==='furnace';
 const isAllianceBoard=board.startsWith('alliance_');
 const furnaceHighest=rows=>rows?.length?rankingScore(rows[0],'furnace'):'No data';
 const ranks=useMemo(()=>[a?.rows||[],b?.rows||[]].map(rows=>rows.slice(0,10)),[a?.rows,b?.rows]);
 function copy(){const text=[mode==='state'?'SvS State Comparison':'SvS Alliance Comparison',mode==='state'?ourState+' vs '+enemyState:'['+ourTag+'] '+ourState+' vs ['+enemyTag+'] '+enemyState,boards.find(v=>v[0]===board)?.[1]||board,'Top 100 leaderboard sample, not full state totals', 'Our top 10: '+(isFurnace?furnaceHighest(a?.rows):format(a?.top10)),'Opponent top 10: '+(isFurnace?furnaceHighest(b?.rows):format(b?.top10)),'Difference: '+(isFurnace?'Furnace rankings shown individually':delta(a?.top10,b?.top10))].join('\n');navigator.clipboard?.writeText(text);}
 const label=mode==='state'?'Top-100 entries':'Matching alliance entries in top 100';
 return <section style={{padding:'20px',color:C.white,minWidth:0}}>
 <h2 style={{fontSize:24,margin:'0 0 7px'}}>SvS comparison</h2><p style={{fontSize:14,color:C.icy,lineHeight:1.55,marginTop:0}}>Compare leaderboard strength before choosing rally leaders, garrisons and battle priorities.</p>
 <div role="group" aria-label="Comparison type" style={{display:'flex',gap:8,marginBottom:16}}>{[['state','State vs state'],['alliance','Alliance vs alliance']].map(([key,label])=><button key={key} aria-pressed={mode===key} onClick={()=>setMode(key)} style={{...btn,flex:1,background:mode===key?C.gold:C.section,color:mode===key?C.bg:C.white,fontSize:13}}>{label}</button>)}</div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
 <label style={{fontSize:13,color:C.icy}}>Our state<input aria-label="Our state" inputMode="numeric" style={{...style,marginTop:6}} value={ourState} onChange={e=>setOurState(e.target.value.trim())}/></label>
 <label style={{fontSize:13,color:C.icy}}>Opponent state<input aria-label="Opponent state" inputMode="numeric" placeholder="e.g. 3556" style={{...style,marginTop:6}} value={enemyState} onChange={e=>setEnemyState(e.target.value.trim())}/></label>
 {mode==='alliance'&&<><label style={{fontSize:13,color:C.icy}}>Our alliance<input aria-label="Our alliance tag" style={{...style,marginTop:6}} value={ourTag} onChange={e=>setOurTag(e.target.value.toUpperCase())}/></label><label style={{fontSize:13,color:C.icy}}>Opponent alliance<input aria-label="Opponent alliance tag" style={{...style,marginTop:6}} value={enemyTag} onChange={e=>setEnemyTag(e.target.value.toUpperCase())}/></label></>}
 </div>
 <button disabled={busy||!ready} onClick={compare} style={{...btn,width:'100%',marginTop:12,background:ready?C.gold:C.section,color:ready?C.bg:C.muted}}>{busy?'Loading rankings…':snapshots?'Refresh comparison':'Compare'}</button>
 {!ready&&<p style={{fontSize:13,color:C.muted}}>Enter both state numbers{mode==='alliance'?' and alliance tags':''} to compare.</p>}
 {errors.length>0&&<div role="alert" style={{padding:12,border:'1px solid '+C.border,borderRadius:12,marginTop:12,color:C.icy,fontSize:13}}><strong>Some rankings could not be loaded.</strong><p style={{marginBottom:0}}>{errors.length} of 2 requests failed for this leaderboard. Missing values are not treated as zero.</p><details><summary>Show issues</summary>{errors.map((e,i)=><p key={i}>{e}</p>)}</details></div>}
 {snapshots&&<>
 <p style={{fontSize:12,color:C.muted,margin:'16px 0 8px'}}>Leaderboard snapshot · {new Date(snapshots.at).toLocaleString()} · Results may be cached</p>
 <p style={{fontSize:12,color:C.icy,lineHeight:1.5}}>All 16 ranking categories are available below. Select a category to load its top 100 for both sides. Previously viewed categories stay cached until you start a new comparison.</p>
 <label style={{display:'block',color:C.icy,fontSize:13,marginBottom:12}}>Compare metric<select aria-label="Comparison metric" style={{...style,marginTop:6}} value={board} onChange={e=>chooseBoard(e.target.value)}>{groups.map(group=><optgroup key={group.label} label={group.label}>{group.items.map(([key,label])=><option key={key} value={key}>{label}</option>)}</optgroup>)}</select></label>
 <article style={{background:C.card,borderRadius:14,padding:16,marginBottom:12}}>
 <h3 style={{fontSize:16,margin:'0 0 12px'}}>{boards.find(x=>x[0]===board)?.[1]}</h3>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>{[a,b].map((item,i)=><div key={i} style={{minWidth:0}}><div style={{color:i?C.blue:C.gold,fontSize:12,fontWeight:700}}>{i?'OPPONENT':'OUR SIDE'}</div><div style={{fontSize:23,fontWeight:750,overflowWrap:'anywhere',margin:'6px 0'}}>{isFurnace?furnaceHighest(item?.rows):format(item?.top10)}</div><div style={{color:C.icy,fontSize:12}}>{isFurnace?'Highest listed furnace':'Top 10 recorded score'}</div><div style={{fontSize:12,color:C.muted,marginTop:5}}>{item?.count??'—'} {label.toLowerCase()}</div></div>)}</div>
 {!isFurnace&&<><CompareBar a={a?.top10} b={b?.top10}/><p style={{fontSize:13,color:C.icy,marginBottom:0}}>Top 10 gap: <strong style={{color:C.white}}>{delta(a?.top10,b?.top10)}</strong></p></>}
 {isFurnace&&<p style={{fontSize:13,color:C.icy,marginBottom:0}}>Furnace rankings are levels, not additive power. Compare individual leaders below.</p>}
 </article>
 <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginBottom:12}}>
 {[a,b].map((item,i)=><article key={i} style={{background:C.section,padding:13,borderRadius:12}}><div style={{fontSize:12,color:C.icy}}>{i?'Opponent':'Our side'} · {label}</div><strong style={{fontSize:21}}>{item?.count??'—'}</strong><div style={{fontSize:12,color:C.muted,marginTop:5}}>Recorded in this leaderboard</div></article>)}</div>
 <article style={{background:C.card,borderRadius:14,padding:14}}>
 <h3 style={{margin:'0 0 10px',fontSize:16}}>Leaderboard detail</h3>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>{ranks.map((rows,i)=><div key={i} style={{minWidth:0}}><strong style={{fontSize:13,color:i?C.blue:C.gold}}>{i?'Opponent':'Our side'}</strong>{rows.length?rows.map(row=><div key={row.key} style={{padding:'9px 0',borderBottom:'1px solid '+C.border,overflowWrap:'anywhere'}}><div style={{fontSize:13}}>#{row.rank} {row.username}</div><div style={{fontSize:12,color:C.icy}}>{row.allianceTag?'['+row.allianceTag+'] · ':''}{rankingScore(row,board)}</div></div>):<p style={{fontSize:13,color:C.muted}}>No matching published entries</p>}</div>)}</div>
 </article>
 <article style={{background:C.card,borderRadius:14,padding:14,marginTop:12}}>
 <h3 style={{fontSize:16,margin:'0 0 8px'}}>What this means for the battle</h3>
 <div style={{fontSize:13,color:C.icy,lineHeight:1.65}}>
 {(!a?.rows?.length||!b?.rows?.length)?<p>There is not enough matching ranking data to assess the two sides. Check the state numbers or alliance tags before planning.</p>:
 isFurnace?<p>Compare your highest-furnace players against theirs, then verify rally stats and troop tiers individually. Furnace level alone does not determine who wins a rally.</p>:
 <><p>{a.top10!=null&&b.top10!=null?(a.top10>b.top10?'Your listed top 10 score is higher. Do not assume an automatic battle advantage; compare buffs and rally composition next.':a.top10<b.top10?'Their listed top 10 score is higher. Prioritise coordinated garrisons, rally timing and identifying viable counters.':'The two sides have similar top-10 scores. Look to activity, heroes, troop matchups and execution for differences.'):'The score comparison is incomplete. Avoid assigning an advantage.'}</p><p>Before lock-in: confirm rally leaders, defensive leads, battle attendance, march speeds and replacement teams. A ranking snapshot is reconnaissance, not a prediction.</p></>}
 </div></article>
 <button style={{...btn,width:'100%',marginTop:12}} onClick={copy}>Copy comparison summary</button>
 <p style={{fontSize:12,lineHeight:1.6,color:C.muted}}>Interpretation: Top 10 compares the strongest recorded leaderboard entries, not the full state. A missing alliance or player may fall outside the published top 100. These scores do not predict an SvS result: rally coordination, attendance, buffs, hero skills and troop composition matter. Furnace leaderboard scores may be non-numeric and are best inspected in the player list rather than added together.</p>
 </>}
 </section>;
}
