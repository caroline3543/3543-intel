import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { generateTalRallyDraft } from '../../services/talRallyTeamGenerator.js';

const control = { width:'100%', boxSizing:'border-box', background:C.bg, border:`1px solid ${C.border}`, color:C.white, borderRadius:10, minHeight:44, padding:'8px 10px', fontSize:16 };
const label = { display:'block', color:C.icy, fontSize:12, marginBottom:5 };
const fmt = n => Number(n || 0).toLocaleString();
export function TalRallyTeamGenerator({ team, config, players, event, locked, onSave }) {
  const [mode,setMode] = useState(team.rallyTeamDraft?.mode || 'strongest');
  const [count,setCount] = useState(8);
  const [size,setSize] = useState(5);
  const [maxJoiners,setMaxJoiners] = useState(29);
  const [ratio,setRatio] = useState(['50','0','50']);
  const [draft,setDraft] = useState(null);
  const [error,setError] = useState('');
  const [showDetails,setShowDetails] = useState({});
  const [overrides,setOverrides] = useState(team.rallyMatchOverrides || {});
  const [overridePlayer,setOverridePlayer] = useState('');
  const combatants=(team.members||[]).filter(m=>m.role==='combatant').map(m=>players.find(p=>String(p.id)===String(m.id))).filter(Boolean);
  const selectedPlayer=combatants.find(p=>String(p.id)===overridePlayer);
  const activeOverride=overrides[overridePlayer] || {};
  function updateOverride(field,type,tier,value) {
    const parsed=value===''?undefined:Number(value);
    if(value!=='' && (!Number.isSafeInteger(parsed)||parsed<0))return;
    setOverrides(prev=>{
      const current={...(prev[overridePlayer]||{})};
      if(field==='troopInventory'){
        const troops={...(current.troopInventory||{})};const category={...(troops[type]||{})};
        if(parsed===undefined)delete category[tier];else category[tier]=parsed;
        if(Object.keys(category).length)troops[type]=category;else delete troops[type];
        if(Object.keys(troops).length)current.troopInventory=troops;else delete current.troopInventory;
      }else if(parsed===undefined)delete current[field];else current[field]=parsed;
      const next={...prev};if(Object.keys(current).length)next[overridePlayer]=current;else delete next[overridePlayer];return next;
    });
    setDraft(null);
  }
  const saved=team.rallyTeamDraft;
  function generate() {
    try {
      const result=generateTalRallyDraft({team,config,players,event,settings:{mode,teamCount:count,preferredSize:size,maxJoiners,ratio:ratio.map(Number)},overrides});
      setDraft(result);setError('');
    } catch (e) {setError(e.message);setDraft(null);}
  }
  const result=draft || saved;
  function copyPlan() {
    if(!result) return;
    const message=result.teams.map(t=>[
      `Team ${t.id.split('-').at(-1)} · ${t.leader.name} (${t.status})`,
      ...t.players.filter(p=>!p.leader).map(p=>`${p.name}${p.norah?' · Norah'+(p.norah.skillLevel?' Lv.'+p.norah.skillLevel:''):''}`),
    ].join('\n')).join('\n\n');
    navigator.clipboard?.writeText(message).then(()=>setError('Team names copied.')).catch(()=>setError('Copy unavailable on this device.'));
  }
  return <section aria-label="TAL rally team generator" style={{background:C.section,border:`1px solid ${C.border}`,borderRadius:14,padding:14,margin:'16px 0'}}>
    <h4 style={{color:C.white,margin:'0 0 6px',fontSize:18}}>Rally team generator</h4>
    <p style={{color:C.icy,fontSize:13,lineHeight:1.5}}>Build up to eight rally teams. Your building assignments are not changed.</p>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
      {['strongest','balanced'].map(m=><button key={m} type="button" onClick={()=>{setMode(m);setDraft(null);}} aria-pressed={mode===m} style={{...control,background:mode===m?C.gold+'22':C.card,color:mode===m?C.gold:C.icy,borderColor:mode===m?C.gold:C.border,fontWeight:700,textTransform:'capitalize'}}>{m}</button>)}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
      <div><label style={label} htmlFor={team.id+'-talcount'}>Number of teams</label><select id={team.id+'-talcount'} style={control} value={count} onChange={e=>setCount(Number(e.target.value))}>{Array.from({length:8},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></div>
      <div><label style={label} htmlFor={team.id+'-talsize'}>Preferred team size</label><input id={team.id+'-talsize'} style={control} type="number" min="2" max="50" value={size} onChange={e=>setSize(Math.max(2,Number(e.target.value)||2))}/></div>
    </div>
    <div style={{marginBottom:12}}><label style={label} htmlFor={team.id+'-talmax'}>Maximum joiners per rally (check game limit)</label><input id={team.id+'-talmax'} style={control} type="number" min="1" max="49" value={maxJoiners} onChange={e=>setMaxJoiners(Math.max(1,Number(e.target.value)||1))}/></div>
    <div style={{marginBottom:12}}>
      <p style={{color:C.icy,fontSize:13,margin:'0 0 8px'}}>Combined rally troop ratio (must total 100%)</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}>
        {['Infantry','Lancer','Marksman'].map((name,i)=><label key={name} style={label}>{name} %<input style={{...control,marginTop:5}} type="number" min="0" max="100" value={ratio[i]} onChange={e=>setRatio(p=>p.map((v,j)=>i===j?e.target.value:v))}/></label>)}
      </div>
    </div>
    <details style={{background:C.card,borderRadius:12,padding:12,marginBottom:12}}>
      <summary style={{color:C.white,fontSize:14,fontWeight:700,cursor:'pointer',minHeight:36}}>Match-day capacity & troop overrides</summary>
      <p style={{color:C.icy,fontSize:12,lineHeight:1.5}}>Optional. Blank fields inherit the saved profile. Changes here only affect this legion's rally draft.</p>
      <label style={label}>Player
        <select style={{...control,marginTop:5}} value={overridePlayer} onChange={e=>setOverridePlayer(e.target.value)}>
          <option value="">Select a player…</option>
          {combatants.map(p=><option key={p.id} value={String(p.id)}>{p.username||p.alias||p.fid||p.id}</option>)}
        </select>
      </label>
      {selectedPlayer&&<>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,margin:'12px 0'}}>
          {[['marchCapacity','March capacity'],['rallyCapacity','Rally capacity']].map(([key,title])=><label key={key} style={label}>{title}<input type="number" min="0" disabled={locked} style={{...control,marginTop:5}} placeholder={String(key==='marchCapacity'?(selectedPlayer.marchCapacity??'Unknown'):(selectedPlayer.leaderProfile?.rallyCapacity??'Unknown'))} value={activeOverride[key]??''} onChange={e=>updateOverride(key,null,null,e.target.value)}/></label>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:8,color:C.icy,fontSize:12}}><span>Type</span><span>T11</span><span>T10</span></div>
        {['infantry','lancer','marksman'].map(type=><div key={type} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:8,alignItems:'center'}}>
          <span style={{color:C.icy,fontSize:12,textTransform:'capitalize'}}>{type}</span>
          {['t11','t10'].map(tier=><input key={tier} type="number" min="0" disabled={locked} aria-label={type+' '+tier+' match-day override'} style={control} placeholder={String(selectedPlayer.talTroopInventory?.[type]?.[tier]??'Unknown')} value={activeOverride.troopInventory?.[type]?.[tier]??''} onChange={e=>updateOverride('troopInventory',type,tier,e.target.value)}/>)}
        </div>)}
        <p style={{color:C.muted,fontSize:12}}>0 means zero available troops. Blank means use the saved profile value.</p>
      </>}
    </details>
    <button type="button" disabled={locked} onClick={generate} style={{...control,background:locked?C.card:C.gold,color:locked?C.muted:C.bg,fontWeight:700,marginBottom:8}}>Preview teams</button>
    {error&&<p role="status" style={{color:C.gold,fontSize:13}}>{error}</p>}
    {result&&<>
      <div style={{display:'flex',gap:8,justifyContent:'space-between',alignItems:'center',margin:'12px 0'}}>
        <strong style={{color:C.white}}>{result.teams.length} rally teams</strong>
        <span style={{fontSize:12,color:C.icy}}>{draft?'Unsaved preview':'Saved draft'}</span>
      </div>
      {result.warnings?.map((warning,i)=><p key={i} style={{fontSize:12,color:C.gold}}>{warning}</p>)}
      {result.teams.map(t=><div key={t.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:12,marginBottom:10}}>
        <button type="button" aria-expanded={!!showDetails[t.id]} onClick={()=>setShowDetails(p=>({...p,[t.id]:!p[t.id]}))} style={{background:'none',border:0,color:C.white,padding:0,width:'100%',textAlign:'left',cursor:'pointer'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong>{t.id.replace('rally-','Team ')} · {t.leader.name}</strong><span style={{fontSize:12,color:t.status==='confirmed-full'?C.green:C.gold}}>{t.status.replaceAll('-',' ')}</span></div>
          <p style={{color:C.icy,fontSize:12,margin:'6px 0'}}>Rally fill: {fmt(t.fill)} / {t.capacity==null?'Unknown':fmt(t.capacity)} · {t.players.length} recorded contributors</p>
          {t.capacity>0&&<div style={{height:6,background:C.border,borderRadius:8,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,t.fill/t.capacity*100)}%`,background:t.status==='confirmed-full'?C.green:C.gold}}/></div>}
          <p style={{color:C.icy,fontSize:12,margin:'8px 0 0'}}>Norah: {t.players.filter(p=>p.norah).length} · Ratio {t.ratio.join('/')} · {showDetails[t.id]?'Hide details ▲':'Show allocations ▼'}</p>
        </button>
        {showDetails[t.id]&&<>
          {t.warnings?.map((w,i)=><p key={i} style={{fontSize:12,color:C.gold}}>{w}</p>)}
          {t.players.map(p=><div key={p.id} style={{borderTop:`1px solid ${C.border}`,padding:'8px 0',fontSize:13,color:C.icy}}>
            <strong style={{color:C.white}}>{p.name}</strong>{p.leader?' · Leader':''}{p.norah?' · Norah'+(p.norah.skillLevel?' Lv.'+p.norah.skillLevel:''):''}<div>{fmt(p.total)} troops{p.estimated?' · Estimated inventory':''}</div>
            <div style={{fontSize:12}}>{['infantry','lancer','marksman'].map(type=>{const a=p.troops[type];return a.t11+a.t10+a.unknown?`${type.slice(0,3)}: ${fmt(a.t11)} T11 / ${fmt(a.t10)} T10${a.unknown?' / '+fmt(a.unknown)+' unknown':''}`:null;}).filter(Boolean).join(' · ')}</div>
          </div>)}
        </>}
      </div>)}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <button type="button" disabled={!draft||locked} onClick={()=>{onSave({rallyTeamDraft:draft,rallyMatchOverrides:overrides});setDraft(null);setError('Team draft saved without changing building assignments.');}} style={{...control,background:C.gold,color:C.bg,fontWeight:700,opacity:(!draft||locked) ? 0.5 : 1}}>Save draft</button>
        <button type="button" onClick={copyPlan} style={control}>Copy names</button>
      </div>
    </>}
    <p style={{color:C.muted,fontSize:12,marginBottom:0}}>Missing troop counts produce estimated fill. Ratio and tier allocations require recorded troop inventory. Both modes use the existing legion membership until live spreadsheet verification is connected. Rally fill with unknown troop quantities is estimated.</p>
  </section>;
}
