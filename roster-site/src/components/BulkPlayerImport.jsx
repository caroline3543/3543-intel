import {useMemo,useState} from 'react';
import {parseBulkPlayers,resolveBulkRows,normaliseBulkName} from './bulkImportModel.js';
const palette={surface:'#1A293D',elevated:'#26384D',border:'#364B62',text:'#F5F7FA',secondary:'#A8B8CA',success:'#83B8A0',warning:'#F0C17A',accent:'#8FA8D8'};
const card={border:'1px solid '+palette.border,borderRadius:16,padding:12,background:palette.surface};
const control={background:palette.elevated,border:'1px solid '+palette.border,borderRadius:12,color:palette.text,minHeight:44,padding:'9px 12px',fontSize:14,boxSizing:'border-box'};
const button={...control,fontWeight:650,cursor:'pointer'};
const secondary={fontSize:12,color:palette.secondary};
export function BulkPlayerImport({players=[],alliance='',roleLabel='Combatants',onConfirm,onClose,initialText='',title='Import players',context='Foundry',requirePower=false,verifyReadings=false,startWithMatches=false,parsePower}){
 const [expanded,setExpanded]=useState(null),[searching,setSearching]=useState({}),[source,setSource]=useState(initialText),[stage,setStage]=useState(startWithMatches?'review':'paste'),[choices,setChoices]=useState({}),[powers,setPowers]=useState({}),[filter,setFilter]=useState('review'),[search,setSearch]=useState({}),[status,setStatus]=useState('');
 const rows=useMemo(()=>parseBulkPlayers(source,parsePower),[source,parsePower]);
 const evaluated=useMemo(()=>resolveBulkRows(rows,players,choices,powers,alliance),[rows,players,choices,powers,alliance]);
 const matched=evaluated.filter(r=>r.status==='exact'||r.status==='approved');
 const pending=evaluated.filter(r=>r.status==='review');
 const newPlayers=evaluated.filter(r=>r.status==='new');
 const selected=evaluated.filter(r=>r.player);
 const duplicates=selected.filter((r,i)=>selected.findIndex(x=>x.player.id===r.player.id)!==i);
 const invalid=selected.filter(r=>r.power!==null&&(!Number.isSafeInteger(r.power)||r.power<0));
 const ready=!pending.length&&!duplicates.length&&!invalid.length&&(!requirePower||selected.every(r=>r.power!==null))&&selected.length>0;
 const activeFilter=startWithMatches&&filter==='review'&&!pending.length?'matched':filter;
 const visibleReview=evaluated.filter(r=>r.status==='review');
 const visibleMatched=evaluated.filter(r=>r.status!=='review');
 const reset=()=>{setSource(initialText);setStage('paste');setChoices({});setPowers({});setFilter('review');setStatus('')};
 const resolve=(key,id)=>setChoices(p=>({...p,[key]:id}));
 const editSource=value=>{setSource(value);setChoices({});setPowers({});setStatus('')};
 const submit=()=>{if(!ready)return;const result=onConfirm?.(selected.map(r=>({id:r.player.id,name:r.player.name,power:r.power,source:r.raw})));if(result?.error){setStatus(result.error);return;}setStage('done');setStatus(result?.message||'Import prepared');};
 return <section aria-label={title} style={{...card,padding:14,display:'grid',gap:12,color:palette.text}}>
  <header style={{display:'flex',justifyContent:'space-between',alignItems:'start',gap:8}}>
   <div><h2 style={{fontSize:18,margin:0}}>{title}</h2><div style={secondary}>{context} · {alliance||'All alliances'} · {roleLabel}</div></div>
   <button type="button" onClick={reset} style={{...button,fontSize:12,minHeight:44}}>↻ Reset</button>
  </header>
  <div aria-label="Import progress" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
   {[verifyReadings?'1. Check OCR':'1. Paste','2. Review','3. Confirm'].map((label,i)=><div key={label}><div style={{height:4,borderRadius:9,background:(stage==='paste'?i===0:stage==='review'?i===1:i===2)?palette.accent:palette.border}}/><div style={{...secondary,marginTop:6}}>{label}</div></div>)}
  </div>
  {stage==='paste'&&<>
   <label style={{fontSize:14,fontWeight:650}}>{verifyReadings?'Check each name and power against the screenshot. Edit any mistakes here.':'Paste names and troop power'}<textarea aria-label={verifyReadings?'Screenshot names and troop power':'Paste names and troop power'} value={source} onChange={e=>editSource(e.target.value)} rows={10} placeholder={'Username, power\nPlayer One, 3500\nPlayer Two, 4.2M'} style={{...control,width:'100%',marginTop:8,resize:'vertical',lineHeight:1.6,fontFamily:'inherit'}}/></label>
   <div style={{...secondary,display:'flex',justifyContent:'space-between'}}><span>{rows.length} players detected</span><span>Name, power · One per line</span></div>
   <button type="button" disabled={!rows.length} onClick={()=>{setStage('review');setFilter(verifyReadings&&!pending.length?'matched':'review');setExpanded(evaluated.find(r=>r.status==='review')?.key??null)}} style={{...button,background:palette.accent,color:'#0B1525',opacity:rows.length?1:.5}}>Find roster matches →</button>
  </>}
  {stage==='review'&&<>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,fontSize:13}}>
    <strong>{pending.length} to review</strong><span style={secondary}>{matched.length} matched · {evaluated.length} total</span>
   </div>
   <div aria-label="Match progress" style={{height:5,borderRadius:8,background:palette.border,overflow:'hidden'}}><div style={{width:(evaluated.length?100*(evaluated.length-pending.length)/evaluated.length:0)+'%',height:'100%',background:palette.success}}/></div>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
    <button type="button" aria-pressed={activeFilter==='review'} onClick={()=>setFilter('review')} style={{...button,background:activeFilter==='review'?palette.elevated:'transparent',border:0,fontSize:12}}>Needs review ({pending.length})</button>
    <button type="button" aria-pressed={activeFilter==='matched'} onClick={()=>setFilter(activeFilter==='matched'?'review':'matched')} style={{...button,background:activeFilter==='matched'?palette.elevated:'transparent',border:0,fontSize:12}}>Matched ({visibleMatched.length}) {activeFilter==='matched'?'⌃':'⌄'}</button>
   </div>
   <div style={{borderTop:'1px solid '+palette.border,borderBottom:'1px solid '+palette.border}}>
   {(activeFilter==='matched'?visibleMatched:visibleReview).map((r,i)=>{
    const open=expanded===r.key||(startWithMatches&&expanded===null&&pending[0]?.key===r.key),top=r.candidates[0],current=r.player||top;
    const metadata=p=>[p?.alliance||'Alliance unknown',p?.furnaceLevel?'FC '+p.furnaceLevel:'FC unknown',p?.cityPower!=null?'City '+Number(p.cityPower).toLocaleString():'City power unknown'].join(' · ');
    const advance=()=>{const next=evaluated.find(x=>x.key!==r.key&&x.status==='review');setExpanded(next?.key??null);};
    const choose=id=>{resolve(r.key,id);advance();};
    const q=String(search[r.key]||'').trim().toLocaleLowerCase();
    const normalizedQuery=normaliseBulkName(q);
    const alternatives=players.filter(p=>q.length>=1&&[p.name,p.playerId,p.fid,p.id,...(p.searchFields||[])].some(value=>{
     const text=String(value||'');
     return text.toLocaleLowerCase().includes(q)||(normalizedQuery&&normaliseBulkName(text).includes(normalizedQuery));
    })).slice(0,8);
    return <div key={r.key} style={{borderBottom:i<(activeFilter==='matched'?visibleMatched:visibleReview).length-1?'1px solid '+palette.border:'none'}}>
     <button type="button" aria-expanded={open} onClick={()=>setExpanded(open?(startWithMatches?false:null):r.key)} style={{width:'100%',border:0,background:'transparent',color:palette.text,padding:'9px 2px',display:'flex',gap:9,alignItems:'center',textAlign:'left',cursor:'pointer',minHeight:56}}>
      <span style={{color:r.player?palette.success:palette.warning,fontSize:17,width:18}}>{r.player?'✓':'○'}</span>
      <span style={{flex:1,minWidth:0}}><strong style={{display:'block',fontSize:13,overflowWrap:'anywhere'}}>{r.username}</strong><span style={secondary}>{r.power===null?'Power missing':Number(r.power).toLocaleString()+' troop power'}{r.player?' · '+(r.player.alliance||'Alliance unknown'):''}{startWithMatches&&r.player&&r.username!==r.player.name?' · Matched to '+r.player.name:''}</span></span>
      <span style={{...secondary,fontSize:11}}>{r.status==='review'?'Review':r.status==='new'?'New':r.status==='skip'?'Skipped':'Matched'}</span><span aria-hidden="true" style={{color:palette.secondary}}>{open?'⌃':'⌄'}</span>
     </button>
     {open&&<div style={{padding:'0 2px 12px 27px',display:'grid',gap:8}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><span style={secondary}>Troop power</span><input aria-label={'Troop power for '+r.username} value={powers[r.key]===undefined?String(r.power??''):powers[r.key]} onChange={e=>setPowers(p=>({...p,[r.key]:e.target.value}))} inputMode="numeric" style={{...control,width:112}}/></div>
      {current&&alliance&&current.alliance!==alliance&&<p style={{color:palette.warning,fontSize:12}}>Alliance membership mismatch. Verify membership in Members before registering.</p>}
      {current&&<div style={{borderTop:'1px solid '+palette.border,padding:'9px 0',display:'flex',alignItems:'center',gap:8}}>
       <div style={{minWidth:0,flex:1}}><span style={{...secondary,fontSize:11}}>{r.player?'Matched player':'Suggested roster match'}</span><strong style={{display:'block',fontSize:13,overflowWrap:'anywhere'}}>{current.name}</strong><span style={{...secondary,display:'block'}}>{metadata(current)}</span><span style={{...secondary,display:'block'}}>ID {current.playerId||current.fid||current.searchFields?.find(x=>/^\\d{7,}$/.test(String(x)))||current.id}</span></div>
       {r.status==='review'?<button type="button" onClick={()=>choose(current.id)} style={{...button,background:palette.accent,color:'#0B1525'}}>{startWithMatches?'Use this player':'Match'}</button>:<span style={{color:palette.success}}>✓</span>}
      </div>}
      {!startWithMatches&&<button type="button" aria-expanded={!!searching[r.key]} onClick={()=>setSearching(p=>({...p,[r.key]:!p[r.key]}))} style={{...button,background:'transparent',textAlign:'left',fontSize:12}}>Other matches {searching[r.key]?'⌃':'⌄'}</button>}
      {(startWithMatches||searching[r.key])&&<><label style={{display:'grid',gap:4}}>{startWithMatches&&<span style={secondary}>Match to a player</span>}<input aria-label={'Search roster for '+r.username} value={search[r.key]||''} onChange={e=>setSearch(p=>({...p,[r.key]:e.target.value}))} placeholder="Search username or Player ID" style={{...control,width:'100%'}}/></label>
       {alternatives.map(p=><button type="button" key={p.id} onClick={()=>choose(p.id)} style={{...button,background:'transparent',textAlign:'left',fontSize:12,display:'grid',gap:3}}><strong>{p.name}</strong><span style={secondary}>{metadata(p)} · ID {p.playerId||p.fid||p.id}</span></button>)}
       {q.length>=1&&!alternatives.length&&<span style={secondary}>No roster matches. Try another name or Player ID.</span>}
      </>}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{!r.candidates.some(p=>p.score>=90)&&<button type="button" onClick={()=>choose('new')} style={{...button,background:'transparent',fontSize:12}}>New player</button>}<button type="button" onClick={()=>choose('skip')} style={{...button,background:'transparent',fontSize:12}}>Skip</button>{r.status!=='review'&&<button type="button" onClick={()=>{resolve(r.key,null);setFilter('review');setExpanded(r.key)}} style={{...button,background:'transparent',fontSize:12}}>Change match</button>}</div>
     </div>}
    </div>;
   })}
   {activeFilter==='review'&&!pending.length&&<div style={{padding:12,...secondary}}>All names resolved. Expand Matched to inspect or change any selection.</div>}
   </div>
   {newPlayers.length>0&&<p style={{...secondary,margin:0}}>New profiles must be created separately. Only matched players are imported.</p>}
   {duplicates.length>0&&<p role="alert" style={{color:palette.warning,fontSize:13}}>Duplicate player IDs. Change the matches before confirming.</p>}
   {invalid.length>0&&<p role="alert" style={{color:palette.warning,fontSize:13}}>Invalid troop power. Enter a non-negative whole number.</p>}
   <div style={{display:'grid',gap:8}}><button type="button" disabled={!ready} onClick={submit} style={{...button,background:palette.accent,color:'#0B1525',opacity:ready?1:.45}}>{verifyReadings?'Save '+selected.length+(selected.length===1?' power reading':' power readings'):'Confirm '+selected.length+' matched players'}</button>{!ready&&<span style={secondary}>Resolve {pending.length} entries and any missing power or duplicate identities first.</span>}<button type="button" onClick={()=>setStage('paste')} style={{...button,background:'transparent',minHeight:38}}>{verifyReadings?'Edit screenshot readings':'Edit pasted text'}</button></div>
  </>}
  {stage==='done'&&<div style={{textAlign:'center',padding:'24px 8px',display:'grid',gap:12}}><div style={{fontSize:32,color:palette.success}}>✓</div><h3 style={{fontSize:18,margin:0}}>Import complete</h3><p style={{...secondary,margin:0}}>{status}</p><button type="button" onClick={onClose} style={{...button,background:palette.accent,color:'#0B1525'}}>Done</button></div>}
  {status&&stage!=='done'&&<p role="alert" style={{fontSize:13,color:palette.warning,margin:0}}>{status}</p>}
 </section>;
}
