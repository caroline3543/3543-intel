import {useMemo,useState} from 'react';
import {parseBulkPlayers,resolveBulkRows,normaliseBulkName} from './bulkImportModel.js';
const palette={surface:'#1A293D',elevated:'#26384D',border:'#364B62',text:'#F5F7FA',secondary:'#A8B8CA',success:'#83B8A0',warning:'#F0C17A',accent:'#8FA8D8'};
const card={border:'1px solid '+palette.border,borderRadius:16,padding:12,background:palette.surface};
const control={background:palette.elevated,border:'1px solid '+palette.border,borderRadius:12,color:palette.text,minHeight:44,padding:'9px 12px',fontSize:14,boxSizing:'border-box'};
const button={...control,fontWeight:650,cursor:'pointer'};
const secondary={fontSize:12,color:palette.secondary};
export function BulkPlayerImport({players=[],alliance='',roleLabel='Combatants',onConfirm,onClose,initialText='',title='Import players'}){
 const [source,setSource]=useState(initialText),[stage,setStage]=useState('paste'),[choices,setChoices]=useState({}),[powers,setPowers]=useState({}),[filter,setFilter]=useState('review'),[search,setSearch]=useState({}),[status,setStatus]=useState('');
 const rows=useMemo(()=>parseBulkPlayers(source),[source]);
 const evaluated=useMemo(()=>resolveBulkRows(rows,players,choices,powers,alliance),[rows,players,choices,powers,alliance]);
 const matched=evaluated.filter(r=>r.status==='exact'||r.status==='approved');
 const pending=evaluated.filter(r=>r.status==='review');
 const newPlayers=evaluated.filter(r=>r.status==='new');
 const selected=evaluated.filter(r=>r.player);
 const duplicates=selected.filter((r,i)=>selected.findIndex(x=>x.player.id===r.player.id)!==i);
 const invalid=selected.filter(r=>r.power!==null&&(!Number.isSafeInteger(r.power)||r.power<0));
 const ready=!pending.length&&!duplicates.length&&!invalid.length&&selected.length>0;
 const reset=()=>{setSource(initialText);setStage('paste');setChoices({});setPowers({});setFilter('review');setStatus('')};
 const resolve=(key,id)=>setChoices(p=>({...p,[key]:id}));
 const editSource=value=>{setSource(value);setChoices({});setPowers({});setStatus('')};
 const submit=()=>{if(!ready)return;const result=onConfirm?.(selected.map(r=>({id:r.player.id,name:r.player.name,power:r.power,source:r.raw})));if(result?.error){setStatus(result.error);return;}setStage('done');setStatus(result?.message||'Import prepared');};
 return <section aria-label={title} style={{...card,padding:14,display:'grid',gap:12,color:palette.text}}>
  <header style={{display:'flex',justifyContent:'space-between',alignItems:'start',gap:8}}>
   <div><h2 style={{fontSize:18,margin:0}}>{title}</h2><div style={secondary}>Foundry · {alliance||'All alliances'} · {roleLabel}</div></div>
   <button type="button" onClick={reset} style={{...button,fontSize:12,minHeight:44}}>↻ Reset</button>
  </header>
  <div aria-label="Import progress" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
   {['1. Paste','2. Review','3. Confirm'].map((label,i)=><div key={label}><div style={{height:4,borderRadius:9,background:(stage==='paste'?i===0:stage==='review'?i===1:i===2)?palette.accent:palette.border}}/><div style={{...secondary,marginTop:6}}>{label}</div></div>)}
  </div>
  {stage==='paste'&&<>
   <label style={{fontSize:14,fontWeight:650}}>Paste names and troop power<textarea aria-label="Paste names and troop power" value={source} onChange={e=>editSource(e.target.value)} rows={10} placeholder={'Username, power\nPlayer One, 3500\nPlayer Two, 4.2M'} style={{...control,width:'100%',marginTop:8,resize:'vertical',lineHeight:1.6,fontFamily:'inherit'}}/></label>
   <div style={{...secondary,display:'flex',justifyContent:'space-between'}}><span>{rows.length} players detected</span><span>Name, power · One per line</span></div>
   <button type="button" disabled={!rows.length} onClick={()=>{setStage('review');setFilter('review')}} style={{...button,background:palette.accent,color:'#0B1525',opacity:rows.length?1:.5}}>Find roster matches →</button>
  </>}
  {stage==='review'&&<>
   <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
    {[[matched.length,'Matched','matched'],[pending.length,'Review','review'],[evaluated.length,'Total','all']].map(([count,label,value])=><button key={value} type="button" onClick={()=>setFilter(value)} style={{...card,textAlign:'center',cursor:'pointer',borderColor:filter===value?palette.accent:palette.border}}><strong style={{fontSize:24,display:'block',fontVariantNumeric:'tabular-nums'}}>{count}</strong><span style={secondary}>{label}</span></button>)}
   </div>
   <div role="group" aria-label="Filter matches" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4,background:palette.elevated,padding:4,borderRadius:12}}>
    {[['review','Needs review'],['matched','Matched'],['all','All']].map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)} style={{border:0,borderRadius:9,padding:'10px 3px',background:filter===id?palette.surface:'transparent',color:palette.text,fontSize:12,fontWeight:filter===id?700:400}}>{label}</button>)}
   </div>
   {pending.length===0&&<p style={{fontSize:13,color:palette.success,margin:0}}>✓ All names resolved. Review power values before confirming.</p>}
   {evaluated.filter(r=>filter==='all'||filter==='review'&&r.status==='review'||filter==='matched'&&r.status!=='review').map(r=><div key={r.key} style={{...card,display:'grid',gap:10}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',gap:8}}><div style={{minWidth:0,overflowWrap:'anywhere'}}><strong style={{fontSize:14}}>{r.username}</strong><div style={secondary}>From pasted text</div></div><span style={{...secondary,color:r.status==='review'?palette.warning:r.player?palette.success:palette.secondary,whiteSpace:'nowrap'}}>{r.status==='review'?'Review':r.status==='exact'?'Exact':r.status==='approved'?'Approved':r.status==='new'?'New player':'Skipped'}</span></div>
    <label style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,...secondary}}>Troop power<input aria-label={'Troop power for '+r.username} inputMode="decimal" value={powers[r.key]===undefined?String(r.power??''):powers[r.key]} onChange={e=>setPowers(p=>({...p,[r.key]:e.target.value}))} style={{...control,width:115}} placeholder="Power"/></label>
    {r.status==='review'?<>
     <span style={secondary}>{r.candidates.length?'Suggested roster matches':'No confident match found'}</span>
     {r.candidates.slice(0,3).map(p=><button type="button" key={p.id} onClick={()=>resolve(r.key,p.id)} style={{...card,background:palette.elevated,textAlign:'left',minHeight:52,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}><span aria-hidden="true">◯</span><span style={{flex:1,minWidth:0}}><strong style={{fontSize:13,overflowWrap:'anywhere'}}>{p.name}</strong><span style={{display:'block',...secondary}}>{p.alliance} · {p.score>=100?'Exact':p.score>=90?'Formatting variation':'Possible match'}</span></span><span aria-hidden="true">✓</span></button>)}
     <input aria-label={'Search roster for '+r.username} value={search[r.key]||''} onChange={e=>setSearch(p=>({...p,[r.key]:e.target.value}))} placeholder="Search another username or Player ID" style={{...control,width:'100%'}}/>
     {String(search[r.key]||'').length>=2&&players.filter(p=>[p.name,p.id,...(p.searchFields||[])].some(v=>normaliseBulkName(v).includes(normaliseBulkName(search[r.key])))).slice(0,5).map(p=><button type="button" key={p.id} onClick={()=>resolve(r.key,p.id)} style={{...button,textAlign:'left',minHeight:44}}>{p.name} · {p.alliance}</button>)}
     <div style={{display:'flex',gap:8}}><button type="button" onClick={()=>resolve(r.key,'new')} style={{...button,flex:1}}>New player</button><button type="button" onClick={()=>resolve(r.key,'skip')} style={{...button,flex:1}}>Skip</button></div>
    </>:<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><span style={{...secondary,overflowWrap:'anywhere'}}>{r.player?r.player.name:r.status==='new'?'New profile requires separate creation':'Not imported'}</span><button type="button" onClick={()=>{resolve(r.key,null);setFilter('all')}} style={{...button,fontSize:12}}>Change</button></div>}
   </div>)}
   {newPlayers.length>0&&<p style={{...secondary,margin:0}}>New players are not registered automatically. Create their profiles separately; this import will include matched players only.</p>}
   {duplicates.length>0&&<p role="alert" style={{color:palette.warning,fontSize:13}}>Duplicate player IDs detected. Change the matches before confirming.</p>}
   {invalid.length>0&&<p role="alert" style={{color:palette.warning,fontSize:13}}>Check troop power. Use a non-negative whole number.</p>}
   <div style={{...card,background:palette.elevated,display:'grid',gap:8}}><div style={{display:'flex',justifyContent:'space-between',fontSize:14,fontWeight:650}}><span>Ready to import</span><span>{selected.length} of {evaluated.length}</span></div><button type="button" disabled={!ready} onClick={submit} style={{...button,background:palette.accent,color:'#0B1525',opacity:ready?1:.45}}>Review and confirm →</button>{!ready&&<div style={secondary}>Resolve {pending.length} unmatched names, invalid power values or duplicate identities first.</div>}<button type="button" onClick={()=>setStage('paste')} style={{...button,background:'transparent'}}>Edit pasted text</button></div>
  </>}
  {stage==='done'&&<div style={{textAlign:'center',padding:'24px 8px',display:'grid',gap:12}}><div style={{fontSize:32,color:palette.success}}>✓</div><h3 style={{fontSize:18,margin:0}}>Import complete</h3><p style={{...secondary,margin:0}}>{status}</p><button type="button" onClick={onClose} style={{...button,background:palette.accent,color:'#0B1525'}}>Done</button></div>}
  {status&&stage!=='done'&&<p role="alert" style={{fontSize:13,color:palette.warning,margin:0}}>{status}</p>}
 </section>;
}
