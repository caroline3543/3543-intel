import {useEffect,useRef,useState} from 'react';
import {C} from '../../../utils/constants.js';
import {fetchMightpulseAlliance} from '../../../services/mightpulseService.js';
import {ALLIANCE_SNAPSHOT_LIMIT,ALLIANCE_WATCH_LIMIT,newAllianceWatch,allianceSnapshot,appendAllianceSnapshot,allianceChanges,allianceSummary} from '../../../services/allianceWatchService.js';
const control={minHeight:44,padding:10,borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.white,fontSize:14,boxSizing:'border-box'};
const button={...control,color:C.gold,cursor:'pointer'};
const fmt=value=>value==null?'Unknown':typeof value==='number'?value.toLocaleString('en-US'):String(value);
const utc=value=>new Date(value).toISOString().slice(0,16).replace('T',' ')+' UTC';
const types=[['all','All changes'],['furnaceLevel','Furnace changes'],['powerSpike','Power spikes'],['powerDrop','Power drops'],['power','Other power gains'],['kills','Kill changes'],['appeared','Newly returned members'],['missing','Members not returned'],['username','Name changes'],['allianceRank','Rank changes']];
const labels={power:'Power',furnaceLevel:'Furnace',kills:'Kills',appeared:'Newly returned',missing:'Not returned',username:'Name',allianceRank:'Alliance rank'};

export function AllianceWatchPanel({stateId,watches,onUpdate,onClose}) {
  const [tag,setTag]=useState(''),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[auto,setAuto]=useState(false);
  const [kind,setKind]=useState('all'),[days,setDays]=useState('7'),[query,setQuery]=useState(''),[count,setCount]=useState(50);
  const lock=useRef(false), alive=useRef(true), latest=useRef(watches);
  latest.current=watches;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const visible=watches.filter(w=>String(w.stateId)===String(stateId));
  const watch=visible.find(w=>w.id===selected) || visible[0];
  async function refresh(targets) {
    if(lock.current || !targets.length)return;
    lock.current=true;setBusy(true);setError('');
    const errors=[];
    try {
      for(const target of targets) {
        if(!alive.current)break;
        try {
          const response=await fetchMightpulseAlliance(Number(stateId),target.tag);
          const snapshot=allianceSnapshot(response,stateId,target.tag);
          if(!alive.current)break;
          onUpdate(current=>current.map(w=>w.id===target.id?appendAllianceSnapshot(w,snapshot):w));
        } catch(e) {errors.push(`[${target.tag}] ${e.message}`);if([401,403,429].includes(e.status)||[401,403,429].includes(e.providerStatus))break;}
      }
    } finally {
      lock.current=false;
      if(alive.current){setBusy(false);setError(errors.join(' · '));}
    }
  }
  useEffect(()=>{
    if(!auto)return;
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh(latest.current.filter(w=>String(w.stateId)===String(stateId)));},30*60000);
    return()=>clearInterval(timer);
  },[auto,stateId,onUpdate]); // checks only while this screen is open; no request on render
  function add(e) {
    e.preventDefault();setError('');
    try {
      const next=newAllianceWatch(stateId,tag);
      if(visible.some(w=>w.id===next.id))throw new Error('This alliance is already on your watchlist.');
      if(visible.length>=ALLIANCE_WATCH_LIMIT)throw new Error(`You can watch ${ALLIANCE_WATCH_LIMIT} alliances per state. Remove one to add another.`);
      onUpdate(current=>current.some(w=>w.id===next.id)?current:[...current,next]);setSelected(next.id);setTag('');
    } catch(e) {setError(e.message);}
  }
  const summary=watch?allianceSummary(watch):null;
  const changes=watch?allianceChanges(watch,{since:days==='all'?0:Date.now()-Number(days)*86400000,kind,query}):[];
  const current=watch?.snapshots.at(-1), previous=watch?.snapshots.at(-2);
  const members=(current?.members || []).filter(m=>!query.trim() || `${m.username || ''} ${m.fid}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div role="dialog" aria-modal="true" aria-labelledby="alliance-watch-title" style={{position:'fixed',inset:0,zIndex:600,background:C.bg,color:C.white,maxWidth:480,margin:'0 auto',padding:20,boxSizing:'border-box',overflowY:'auto'}}>
    <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><h2 id="alliance-watch-title" style={{fontSize:19}}>Alliance watch · State {stateId}</h2><button style={button} onClick={onClose}>Close</button></header>
    <p style={{fontSize:13,color:C.icy,lineHeight:1.5}}>Watch every member returned in an alliance roster. Sign in through Settings → Admin access to refresh. Watched members are kept separate from your alliance roster.</p>
    <form onSubmit={add} style={{display:'flex',gap:8,alignItems:'end'}}><label style={{flex:1,minWidth:0,fontSize:12}}>Alliance tag (case sensitive)<input aria-label="Alliance to watch" value={tag} maxLength={16} required onChange={e=>setTag(e.target.value)} placeholder="e.g. LUN" style={{...control,width:'100%',marginTop:6}}/></label><button style={button} disabled={busy}>Watch alliance</button></form>
    {error && <p role="alert" style={{color:C.red,fontSize:13}}>{error}</p>}
    <p style={{fontSize:12,color:C.muted}}>Saved on this device in this state workspace and included in JSON backups. Last {ALLIANCE_SNAPSHOT_LIMIT} snapshots per alliance retained.</p>
    {!visible.length && <p style={{color:C.icy}}>Add an alliance, then refresh to save its starting roster. Later refreshes show changes.</p>}
    {visible.length>0 && <>
      <label style={{fontSize:12}}>Watched alliance<select aria-label="Watched alliance" style={{...control,width:'100%',marginTop:6}} value={watch.id} onChange={e=>{setSelected(e.target.value);setCount(50);}}>{visible.map(w=><option key={w.id} value={w.id}>[{w.tag}] · {w.snapshots.at(-1)?.members.length ?? 'No'} members</option>)}</select></label>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}><button style={button} disabled={busy} onClick={()=>void refresh([watch])}>{busy?'Refreshing…':`Refresh [${watch.tag}]`}</button><button style={button} disabled={busy} onClick={()=>void refresh(visible)}>Refresh all alliances</button><button style={{...button,color:C.red}} disabled={busy} onClick={()=>{if(window.confirm(`Stop watching [${watch.tag}] and remove its saved watch history?`))onUpdate(current=>current.filter(w=>w.id!==watch.id));}}>Remove watch</button></div>
      <label style={{display:'flex',gap:8,alignItems:'center',minHeight:44,fontSize:12}}><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>Auto refresh every 30 minutes while this screen is open</label>
      <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Provider data may be cached. Times show when a roster was retrieved, not the exact upgrade time. Checks pause when this screen is closed or the app is hidden. No closed-app alerts.</p>
      {current?<>
        <p style={{color:C.icy,fontSize:12}}>Latest roster: {utc(current.observedAt)}{previous && <><br/>Compared with: {utc(previous.observedAt)}</>}</p>
        <section aria-label="Alliance summary" style={{padding:14,background:C.card,borderRadius:12,lineHeight:1.7,fontSize:13}}>
          <b>[{watch.tag}] · {summary.members} returned members</b><div>Reported power: {fmt(summary.power)} ({summary.powerKnown}/{summary.members} members)</div>
          {previous && <div>Power change: {summary.powerDelta>0?'+':''}{fmt(summary.powerDelta)} across {summary.comparable} members with power in both snapshots</div>}
          <div>Furnaces: {Object.entries(summary.distribution).map(([tier,n])=>`${tier}: ${n}`).join(' · ')}</div>
        </section>
      </>:<p style={{color:C.icy}}>Refresh [{watch.tag}] to establish the baseline. No earlier changes are inferred.</p>}
      <label style={{display:'block',fontSize:12,marginTop:12}}>Flag power gains of at least (%)<input aria-label="Power spike threshold percent" type="number" min="0.1" max="1000" step="0.1" style={{...control,width:'100%',marginTop:5}} value={watch.powerSpikePercent ?? 5} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>0&&n<=1000)onUpdate(current=>current.map(w=>w.id===watch.id?{...w,powerSpikePercent:n}:w));}}/></label>
      <div style={{display:'flex',gap:8,marginTop:12}}><select aria-label="Alliance change period" style={{...control,flex:1,minWidth:0}} value={days} onChange={e=>{setDays(e.target.value);setCount(50);}}><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">Retained history</option></select><select aria-label="Alliance change type" style={{...control,flex:1,minWidth:0}} value={kind} onChange={e=>{setKind(e.target.value);setCount(50);}}>{types.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
      <input aria-label="Search alliance members" placeholder="Search name or player ID" value={query} onChange={e=>{setQuery(e.target.value);setCount(50);}} style={{...control,width:'100%',marginTop:8}}/>
      <h3 style={{fontSize:15}}>Changes · {changes.length}</h3>
      {!changes.length && <p style={{fontSize:13,color:C.icy}}>{watch.snapshots.length<2?'Refresh again later to compare the whole alliance.':'No changes match this view.'}</p>}
      {changes.slice(0,count).map(item=><article key={item.id} style={{padding:'12px 0',borderBottom:`1px solid ${C.border}`}}><b style={{fontSize:14}}>{item.member.username || item.member.fid}</b><div style={{fontSize:11,color:C.muted}}>FID {item.member.fid} · {utc(item.at)}</div><div style={{fontSize:13,color:item.category==='powerDrop'?C.red:C.gold,marginTop:6}}>{labels[item.field]}: {fmt(item.before)} → {fmt(item.after)}{item.delta!=null?` (${item.delta>0?'+':''}${fmt(item.delta)}${item.percent!=null?`, ${item.percent>0?'+':''}${item.percent.toFixed(1)}%`:''})`:''}</div></article>)}
      {changes.length>count && <button style={{...button,width:'100%',marginTop:10}} onClick={()=>setCount(n=>n+50)}>Show more changes</button>}
      <details style={{marginTop:14}}><summary style={{minHeight:44,cursor:'pointer'}}>Latest members · {members.length}</summary>{members.map(m=><div key={m.fid} style={{fontSize:12,padding:'10px 0',borderBottom:`1px solid ${C.border}`}}><b>{m.username || m.fid}</b> · {m.furnaceLevel || 'Unknown furnace'}<div style={{color:C.icy}}>FID {m.fid} · Power {fmt(m.power)} · Kills {fmt(m.kills)}</div></div>)}</details>
      <p style={{fontSize:11,color:C.muted,lineHeight:1.5}}>Newly returned or missing means a difference between provider responses. It does not prove a join, departure, transfer, attack, or the reason for a power change.</p>
    </>}
  </div>;
}
