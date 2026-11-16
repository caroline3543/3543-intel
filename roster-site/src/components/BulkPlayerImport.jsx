import {useMemo,useState} from 'react';
import {parseBulkPlayers,resolveBulkRows,normaliseBulkName} from './bulkImportModel.js';
const palette={surface:'#1A293D',elevated:'#26384D',border:'#364B62',text:'#F5F7FA',secondary:'#A8B8CA',success:'#83B8A0',warning:'#F0C17A',accent:'#8FA8D8'};
const card={border:'1px solid '+palette.border,borderRadius:16,padding:12,background:palette.surface};
const control={background:palette.elevated,border:'1px solid '+palette.border,borderRadius:12,color:palette.text,minHeight:44,padding:'9px 12px',fontSize:14,boxSizing:'border-box'};
const button={...control,fontWeight:650,cursor:'pointer'};
const secondary={fontSize:12,color:palette.secondary};
export function BulkPlayerImport({players=[],alliance='',roleLabel='Combatants',onConfirm,onClose,initialText='',title='Import players',context='Foundry',requirePower=false}){
 const [expanded,setExpanded]=useState(null),[searching,setSearching]=useState({}),[source,setSource]=useState(initialText),[stage,setStage]=useState('paste'),[choices,setChoices]=useState({}),[powers,setPowers]=useState({}),[filter,setFilter]=useState('review'),[search,setSearch]=useState({}),[status,setStatus]=useState('');
 const rows=useMemo(()=>parseBulkPlayers(source),[source]);
 const evaluated=useMemo(()=>resolveBulkRows(rows,players,choices,powers,alliance),[rows,players,choices,powers,alliance]);
 const matched=evaluated.filter(r=>r.status==='exact'||r.status==='approved');
 const pending=evaluated.filter(r=>r.status==='review');
 const newPlayers=evaluated.filter(r=>r.status==='new');
 const selected=evaluated.filter(r=>r.player);
 const duplicates=selected.filter((r,i)=>selected.findIndex(x=>x.player.id===r.player.id)!==i);
 const invalid=selected.filter(r=>r.power!==null&&(!Number.isSafeInteger(r.power)||r.power<0));
 const ready=!pending.length&&!duplicates.length&&!invalid.length&&(!requirePower||selected.every(r=>r.power!==null))&&selected.length>0;
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
   {['1. Paste','2. Review','3. Confirm'].map((label,i)=><div key={label}><div style={{height:4,borderRadius:9,background:(stage==='paste'?i===0:stage==='review'?i===1:i===2)?palette.accent:palette.border}}/><div style={{...secondary,marginTop:6}}>{label}</div></div>)}
  </div>
  {stage==='paste'&&<>
   <label style={{fontSize:14,fontWeight:650}}>Paste names and troop power<textarea aria-label="Paste names and troop power" value={source} onChange={e=>editSource(e.target.value)} rows={10} placeholder={'Username, power\nPlayer One, 3500\nPlayer Two, 4.2M'} style={{...control,width:'100%',marginTop:8,resize:'vertical',lineHeight:1.6,fontFamily:'inherit'}}/></label>
   <div style={{...secondary,display:'flex',justifyContent:'space-between'}}><span>{rows.length} players detected</span><span>Name, power · One per line</span></div>
   <button type="button" disabled={!rows.length} onClick={()=>{setStage('review');setFilter('review');setExpanded(null)}} style={{...button,background:palette.accent,color:'#0B1525',opacity:rows.length?1:.5}}>Find roster matches →</button>
  </>}
  {stage==='review'&&<>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,fontSize:13}}>
    <strong>{pending.length} to review</strong><span style={secondary}>{matched.length} matched · {evaluated.length} total</span>
   </div>
   <div aria-label="Match progress" style={{height:5,borderRadius:8,background:palette.border,overflow:'hidden'}}><div style={{width:(evaluated.length?100*(evaluated.length-pending.length)/evaluated.length:0)+'%',height:'100%',background:palette.success}}/></div>
   <div role="group" aria-label="Filter matches" style={{display:'flex',gap:4}}>
    {[['review','Needs review'],['matched','Matched'],['all','All']].map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)} style={{...button,flex:1,minHeight:38,padding:'7px 4px',fontSize:12,border:0,background:filter===id?palette.elevated:'transparent'}}>{label}</button>)}
   </div>
   <div style={{border:'1px solid '+palette.border,borderRadius:12,overflow:'hidden'}}>
   {evaluated.filter(r=>filter==='all'||filter==='review'&&r.status==='review'||filter==='matched'&&r.status!=='review').map((r,i)=>{
    const open=expanded===r.key,top=r.candidates[0];
    const metadata=p=>[p?.alliance||'Alliance unknown',p?.furnaceLevel?'FC '+p.furnaceLevel:'FC unknown',p?.cityPower!=null?'City '+Number(p.cityPower).toLocaleString():'City power unknown'].join(' · ');
    return <div key={r.key} style={{borderBottom:i<evaluated.length-1?'1px solid '+palette.border:'none'}}>
     <button type="button" aria-expanded={open} onClick={()=>setExpanded(open?null:r.key)} style={{width:'100%',border:0,background:'transparent',color:palette.text,padding:'11px 12px',display:'flex',gap:10,alignItems:'center',textAlign:'left',cursor:'pointer',minHeight:54}}>
      <span style={{color:r.player?palette.success:r.status==='review'?palette.warning:palette.secondary,fontSize:17}}>{r.player?'✓':r.status==='review'?'○':'–'}</span>
      <span style={{flex:1,minWidth:0}}><strong style={{display:'block',fontSize:13,overflowWrap:'anywhere'}}>{r.username}</strong><span style={secondary}>{r.power===null?'Power missing':Number(r.power).toLocaleString()+' troop power'}{r.player?' · '+r.player.alliance:''}</span></span>
      <span style={{...secondary,fontSize:12}}>{r.status==='review'?'Review':r.status==='new'?'New':r.status==='skip'?'Skipped':'Matched'}</span><span aria-hidden="true" style={{color:palette.secondary}}>{open?'⌃':'⌄'}</span>
     </button>
     {open&&<div style={{padding:'0 12px 12px 36px',display:'grid',gap:9}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><span style={secondary}>Troop power</span><input aria-label={'Troop power for '+r.username} value={powers[r.key]===undefined?String(r.power??''):powers[r.key]} onChange={e=>setPowers(p=>({...p,[r.key]:e.target.value}))} inputMode="numeric" style={{...control,width:105,minHeight:40}}/></div>
      {(r.status==='review'?r.candidates.slice(0,3):r.player?[r.player]:[]).map(p=><div key={p.id} style={{background:palette.elevated,borderRadius:10,padding:10,display:'flex',alignItems:'center',gap:8}}>
       <div style={{minWidth:0,flex:1}}><strong style={{display:'block',fontSize:13,overflowWrap:'anywhere'}}>{p.name}</strong><span style={{...secondary,display:'block',overflowWrap:'anywhere'}}>{metadata(p)}</span><span style={{...secondary,display:'block'}}>ID {p.searchFields?.find(x=>/^\d{7,}$/.test(String(x)))||p.id}</span></div>
       {r.status==='review'?<button type="button" onClick={()=>{resolve(r.key,p.id);const next=evaluated.find(x=>x.key!==r.key&&x.status==='review');setExpanded(next?.key??null)}} style={{...button,minHeight:40,padding:'8px 11px',background:palette.accent,color:'#0B1525'}}>Match</button>:<span style={{color:palette.success}}>✓</span>}
      </div>)}
      <button type="button" onClick={()=>setSearching(p=>({...p,[r.key]:!p[r.key]}))} style={{...button,minHeight:38,fontSize:12,textAlign:'left'}}>Search other matches {searching[r.key]?'⌃':'⌄'}</button>
      {searching[r.key]&&<><input aria-label={'Search roster for '+r.username} value={search[r.key]||''} onChange={e=>setSearch(p=>({...p,[r.key]:e.target.value}))} placeholder="Username or Player ID" style={{...control,width:'100%'}}/>{String(search[r.key]||'').length>=2&&players.filter(p=>[p.name,p.id,...(p.searchFields||[])].some(v=>normaliseBulkName(v).includes(normaliseBulkName(search[r.key])))).slice(0,5).map(p=><button type="button" key={p.id} onClick={()=>{resolve(r.key,p.id);setExpanded(null)}} style={{...button,textAlign:'left',fontSize:12}}>{p.name} · {metadata(p)}</button>)}</>}
      <div style={{display:'flex',gap:8}}><button type="button" onClick={()=>resolve(r.key,'new')} style={{...button,flex:1,minHeight:38,fontSize:12}}>New player</button><button type="button" onClick={()=>resolve(r.key,'skip')} style={{...button,flex:1,minHeight:38,fontSize:12}}>Skip</button>{r.status!=='review'&&<button type="button" onClick={()=>resolve(r.key,null)} style={{...button,minHeight:38,fontSize:12}}>Change</button>}</div>
     </div>}
    </div>;
   })}
   </div>
   {newPlayers.length>0&&<p style={{...secondary,margin:0}}>New profiles must be created separately. Only matched players are imported.</p>}
   {duplicates.length>0&&<p role="alert" style={{color:palette.warning,fontSize:13}}>Duplicate player IDs. Change the matches before confirming.</p>}
   {invalid.length>0&&<p role="alert" style={{color:palette.warning,fontSize:13}}>Invalid troop power. Enter a non-negative whole number.</p>}
   <div style={{display:'grid',gap:8}}><button type="button" disabled={!ready} onClick={submit} style={{...button,background:palette.accent,color:'#0B1525',opacity:ready?1:.45}}>Confirm {selected.length} matched players</button>{!ready&&<span style={secondary}>Resolve {pending.length} entries and any missing power or duplicate identities first.</span>}<button type="button" onClick={()=>setStage('paste')} style={{...button,background:'transparent',minHeight:38}}>Edit pasted text</button></div>
  </>}
  {stage==='done'&&<div style={{textAlign:'center',padding:'24px 8px',display:'grid',gap:12}}><div style={{fontSize:32,color:palette.success}}>✓</div><h3 style={{fontSize:18,margin:0}}>Import complete</h3><p style={{...secondary,margin:0}}>{status}</p><button type="button" onClick={onClose} style={{...button,background:palette.accent,color:'#0B1525'}}>Done</button></div>}
  {status&&stage!=='done'&&<p role="alert" style={{fontSize:13,color:palette.warning,margin:0}}>{status}</p>}
 </section>;
}
