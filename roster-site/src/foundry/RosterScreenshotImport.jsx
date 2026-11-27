import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { registrationCountReview, combineScreenshotRows } from './rosterScreenshotModel.js';
import { readScreenshotSession, writeScreenshotSession } from './screenshotSession.js';
import { ScreenshotReview } from './ScreenshotReview.jsx';
import './rosterScreenshot.css';

const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxFiles = 25;
const sameEvent = (first, second) => !!first && !!second && first[1] === second[1] && first[2] === second[2];

async function screenshotId(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function ScreenshotImage({ file, bounds }) {
  const [expanded, setExpanded] = useState(false);
  const crop = bounds && Number.isFinite(bounds.top) && Number.isFinite(bounds.bottom) && bounds.top >= 0 && bounds.bottom <= 1 && bounds.bottom > bounds.top;
  const [ratio,setRatio] = useState(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  return url && <figure className="screenshot-evidence">
    <div style={crop && !expanded && ratio ? {position:'relative',overflow:'hidden',aspectRatio:ratio/(bounds.bottom-bounds.top),width:'100%'} : undefined}><img src={url} onLoad={e=>{const img=e.currentTarget; if(img.naturalHeight)setRatio(img.naturalWidth/img.naturalHeight);}} style={crop && !expanded && ratio ? {position:'absolute',width:'100%',maxWidth:'none',top:-(bounds.top/(bounds.bottom-bounds.top))*100+'%',left:0} : undefined} alt={'Roster screenshot ' + file.name}/></div>
    {crop && expanded && <span aria-hidden="true" style={{ top: bounds.top * 100 + '%', height: (bounds.bottom - bounds.top) * 100 + '%' }}/>}
    {crop && <button type="button" onClick={()=>setExpanded(v=>!v)}>{expanded?'Show player row':'Show full screenshot'}</button>}
  </figure>;
}

function ScreenshotResult({ item, locked, onLegion }) {
  const [open, setOpen] = useState(false);
  const reading = item.reading;
  return <li>
    <details onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>{item.file.name} {reading && '· ' + reading.rows.length + ' player rows'}
        {(reading?.partial ?? item.partial)?.length > 0 && ' · ' + (reading?.partial ?? item.partial).length + ' incomplete'}
        {reading?.legion && ' · Legion ' + reading.legion}</summary>
      {open && <ScreenshotImage file={item.file}/>}
    </details>
    {item.error && <p className="screenshot-error">{item.error}</p>}
    {!reading?.legion && reading?.rows.length > 0 && <label>
      Legion for {item.file.name}
      <select value={item.destination ?? ''} disabled={locked} onChange={event => onLegion(Number(event.target.value))}>
        <option value="">Choose a legion</option><option value="1">Legion 1</option><option value="2">Legion 2</option>
      </select>
    </label>}
  </li>;
}

export function RosterScreenshotImport({ kind, title, alliance, activeLegion, storage, players, occurrenceIds, onSave, children, onContinueTeams }) {
  const sessionKey = kind + ':' + alliance;
  const [session, setSession] = useState(null);
  const latest = useRef(null);
  const eventIds = useRef(occurrenceIds);
  eventIds.current = occurrenceIds;
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState('');
  const [error, setError] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [review, setReview] = useState(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceRef = useRef(null);
  const launchRef = useRef(null);
  useEffect(() => {
    if (!workspaceOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    workspaceRef.current?.focus();
    const trap = event => {
      if (event.key !== 'Tab') return;
      const controls = [...(workspaceRef.current?.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled):not([hidden]),summary,[tabindex="0"]') ?? [])].filter(node => node.getClientRects().length);
      if (!controls.length) { event.preventDefault(); return; }
      const first=controls[0], last=controls.at(-1);
      if (!workspaceRef.current.contains(document.activeElement) || document.activeElement===workspaceRef.current || (event.shiftKey && document.activeElement===first) || (!event.shiftKey && document.activeElement===last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown',trap);
    return () => { document.removeEventListener('keydown',trap); document.body.style.overflow = previous; launchRef.current?.focus(); };
  }, [workspaceOpen]);
  const [mode, setMode] = useState(() => {
    try { const value = localStorage.getItem('3573-ocr-import-mode'); return ['powers','roles','both'].includes(value) ? value : 'powers'; }
    catch { return 'powers'; }
  });
  function chooseMode(value) {
    setMode(value);
    try { localStorage.setItem('3573-ocr-import-mode', value); } catch {}
    if (latest.current) checkpoint({ ...latest.current, mode: value });
  }
  const run = useRef(null);
  const warmReader=useRef(null);
  useEffect(()=>{
    if(!workspaceOpen)return;
    return ()=>{
      const pending=warmReader.current;
      warmReader.current=null;
      if(pending)void pending.then(worker=>worker?.terminate()).catch(()=>{});
    };
  },[workspaceOpen,sessionKey]);
  function prewarmReader(){
    if(warmReader.current||run.current)return;
    warmReader.current=import('./readRosterScreenshot.js').then(m=>m.createRosterReader()).catch(()=>null);
  }
  const picker = useRef(null);
  const mounted = useRef(false);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    mounted.current = true;
    readScreenshotSession(sessionKey).then(value => {
      if (mounted.current) {
        latest.current = value || null;
        setSession(value || null);
        if (['powers','roles','both'].includes(value?.mode)) setMode(value.mode);
      }
    }).catch(() => {
      if (mounted.current) setRecoveryError('Batch recovery is unavailable in this browser.');
    }).finally(() => {
      if (mounted.current) setLoading(false);
    });
    return () => {
      mounted.current = false;
      if (run.current) run.current.stopped = true;
    };
  }, [sessionKey]);

  function checkpoint(next) {
    latest.current = next;
    if (mounted.current) setSession(next);
    writes.current = writes.current.catch(() => {}).then(() => writeScreenshotSession(sessionKey, next));
    writes.current.catch(() => {
      if (mounted.current) setRecoveryError('Could not store this batch on this device. Keep this tab open to continue.');
    });
  }

  async function chooseFiles(event) {
    const incoming = [...event.target.files];
    event.target.value = '';
    if (!incoming.length || run.current) return;
    prewarmReader();
    const files = latest.current?.items ?? [];
    const valid = incoming.filter(file => allowedTypes.has(file.type) && file.size <= 15 * 1024 * 1024);
    const warnings = [];
    if (valid.length !== incoming.length) warnings.push('Choose PNG, JPEG or WebP screenshots up to 15 MB each.');
    const byId = new Map(files.map(item => [item.id, item]));
    setJob('Checking screenshots…');
    try {
      for (const file of valid) {
        const id = await screenshotId(file);
        if (byId.has(id)) continue;
        if (byId.size >= maxFiles) { warnings.push('A batch can contain up to 25 screenshots.'); break; }
        byId.set(id, { id, file });
      }
      if (byId.size < files.length + valid.length && byId.size < maxFiles) warnings.push('Duplicate screenshots were skipped.');
      if (mounted.current && byId.size) {
        checkpoint({ ...latest.current, items: [...byId.values()], mode, occurrenceIds: latest.current?.occurrenceIds ?? eventIds.current });
      }
    } catch {
      warnings.push('Could not read the selected files.');
    } finally {
      if (mounted.current) {
        setError(warnings.join(' '));
        setJob('');
      }
    }
  }

  async function scan(restart = false) {
    if (run.current || !latest.current) return;
    const task = { stopped: false };
    run.current = task;
    let batch = latest.current;
    if (restart) {
      batch = { mode, items: batch.items.map(({ id, file }) => ({ id, file })), occurrenceIds: eventIds.current };
      checkpoint(batch);
    }
    const todo = batch.items.filter(item => !item.reading);
    const workers=[];
    setError('');
    setJob('Loading multilingual screenshot reader…');
    try {
      const { createRosterReader, readRosterScreenshot } = await import('./readRosterScreenshot.js');
      if (task.stopped) return;
      const cores=navigator.hardwareConcurrency||2;
      const mobile=matchMedia('(pointer: coarse)').matches;
      const count=Math.min(todo.length,cores<=2?1:mobile?2:3);
      const warm=count?warmReader.current:null;
      if(warm)warmReader.current=null;
      const initialised=await Promise.allSettled(Array.from({length:count},(_,i)=>i===0&&warm?warm.then(worker=>worker||createRosterReader()):createRosterReader()));
      for(const result of initialised)if(result.status==='fulfilled')workers.push(result.value);
      if(todo.length&&!workers.length)throw new Error('No reader available');
      let next=0;
      await Promise.all(workers.map(async worker=>{
        while(next<todo.length){
          if(task.stopped||!mounted.current||!sameEvent(batch.occurrenceIds,eventIds.current))break;
          const item=todo[next++];
          const complete=batch.items.filter(candidate=>candidate.reading).length;
          setJob('Scanning screenshots · '+complete+' of '+batch.items.length+' read');
          let outcome;
          try {
            const reading=await readRosterScreenshot(worker,item.file);
            outcome=reading.rows.length?{reading,error:''}:{reading:null,partial:reading.partial,error:'No complete player rows found.'};
          }catch(failure){
            outcome={error:failure.message?.startsWith('Use ')?failure.message:'Could not read this screenshot.'};
          }
          if(!mounted.current||!sameEvent(batch.occurrenceIds,eventIds.current))break;
          batch={...batch,items:batch.items.map(candidate=>candidate.id===item.id?{...item,...outcome}:candidate)};
          checkpoint(batch);
          await writes.current.catch(()=>{});
        }
      }));
    }catch{
      if(mounted.current&&!task.stopped)setError('Could not load the screenshot reader. Try scanning again.');
    }finally{
      if(workers.length&&!task.stopped&&mounted.current&&sameEvent(batch.occurrenceIds,eventIds.current)&&!warmReader.current){
        warmReader.current=Promise.resolve(workers.shift());
      }
      await Promise.allSettled(workers.map(worker=>worker.terminate()));
      run.current=null;
      if(mounted.current)setJob('');
    }
  }

  const saving = useRef(false);
  const [checkingPending,setCheckingPending]=useState(false);
  const [pendingStatus,setPendingStatus]=useState('');
  async function checkPending(){
    if(checkingPending||!latest.current?.pendingImport)return;
    setCheckingPending(true);
    try{const result=await saveOnce(latest.current.pendingImport);setPendingStatus(result?.error||result?.message||'Shared confirmation unavailable.');}
    catch{setPendingStatus('Could not verify the shared save. Check again later.');}
    finally{setCheckingPending(false);}
  }
  async function saveOnce(action) {
    const pending=latest.current?.pendingImport;
    if(pending&&JSON.stringify(pending)!==JSON.stringify(action))return {error:'A previous import is awaiting verification. Check its save status first.',pending:true};
    if (saving.current) return { error: 'An import is already being saved.' };
    if (!sameEvent(latest.current?.occurrenceIds, eventIds.current)) return { error: 'The event changed. Re-scan before importing.' };
    const ids = [...new Set([...action.powers, ...(action.roleChanges ?? [])].map(row => row.id))];
    if (ids.some(id => latest.current?.savedIds?.includes(id))) {
      return { error: 'A selected player was already imported from this batch. Skip the duplicate reading.' };
    }
    saving.current = true;
    try {
    checkpoint({...latest.current,pendingImport:action});
    await writes.current;
    const result = await onSave(action,{verifyOnly:!!pending});
    if (!result?.error && result?.message && latest.current && mounted.current) {
      checkpoint({ ...latest.current, pendingImport:null, savedIds: [...(latest.current.savedIds ?? []), ...ids] });
      await writes.current.catch(() => {});
    }
    if(result?.error&&!result.pending&&!pending){checkpoint({...latest.current,pendingImport:null});await writes.current;}
    return result;
    } finally { saving.current = false; }
  }

  const items = session?.items ?? [];
  const stale = session && !sameEvent(session.occurrenceIds, occurrenceIds);
  const groups = [activeLegion, activeLegion === 1 ? 2 : 1].map(legion => {
    const sources = items.filter(item => (item.reading?.legion ?? item.destination) === legion && item.reading);
    const readings = sources.map(item => item.reading);
    const rows = combineScreenshotRows(readings);
    return { legion, sources, rows, counts: registrationCountReview(readings, rows) };
  }).filter(group => group.rows.length);
  const read = items.filter(item => item.reading).length;

  return <section className="screenshot-import" aria-label="Troop power upload">
    <button ref={launchRef} type="button" className="screenshot-primary" onClick={() => setWorkspaceOpen(true)}>Open screenshot import</button>
    {workspaceOpen && createPortal(<section ref={workspaceRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Screenshot import workspace" className="stage9-import-workspace">
      <header className="stage9-import-header"><div><small>{title} · {alliance} · Legion {review?.legion ?? activeLegion}</small><h2>Import roster</h2></div><button type="button" disabled={!!job} onClick={() => { setReview(null); setWorkspaceOpen(false); }}>Close</button></header>
      <div className="stage9-import-content">
    {session?.pendingImport && !review ? <div className="stage9-summary"><h4>Awaiting confirmation</h4><p>Import changes retained. Check the shared save before submitting another import.</p><p>{title} · {alliance} · Legion {session.pendingImport.legion}</p><div role="status">{pendingStatus}</div><div className="stage9-action-footer"><button type="button" className="screenshot-primary" disabled={checkingPending} onClick={checkPending}>{checkingPending?'Checking shared save…':'Check save status'}</button></div></div> : <>
    <input ref={picker} type="file" hidden multiple accept="image/png,image/jpeg,image/webp" aria-label="Troop power screenshots"
      disabled={loading || !!job || !!review} onChange={chooseFiles}/>
    {!review && <div className="stage9-step-strip" aria-label={`Step ${run.current ? 2 : 1} of 8`}>{Array.from({length:8},(_,i)=><span key={i} className={i===(run.current?1:0)?"current":run.current&&i===0?"complete":""}/>)}</div>}
    {!loading && !review && !run.current && <fieldset className="stage9-mode-options" disabled={!!job}><legend>What would you like to import?</legend>{[['powers','Troop powers only','Update troop powers without changing registrations.'],['roles','Registrations only','Review combatant and substitute assignments.'],['both','Troop powers and registrations','Review both types of changes together.']].map(([value,label,description])=><label key={value} className={mode===value?'selected':''}><input type="radio" name="screenshot-import-mode" value={value} checked={mode===value} onChange={()=>chooseMode(value)}/><span><strong>{label}</strong><small>{description}</small></span></label>)}</fieldset>}
    {!loading && !review && !run.current && <p className="stage9-protection">Your roster will not change until you review and confirm the import.</p>}
    {loading && <p role="status">Checking for a previous batch…</p>}
    {!loading && !items.length && <>

      <p>Select up to 25 screenshots. Include the legion heading.</p>
    </>}
    {!!items.length && !review && <>
      
      <div className="stage9-progress-panel"><h3>{job ? 'Processing screenshots' : read === items.length ? 'Screenshots ready' : 'Ready to scan'}</h3><p role="status">{read} of {items.length} screenshots read</p><progress aria-label="Screenshot processing progress" value={read} max={items.length}/>{job&&<p role="status">{job.startsWith("Scanning ")?"Reading player information…":job}</p>}</div>

      <div className="screenshot-secondary">
        <button type="button" disabled={!!job || !!review || stale || items.length >= maxFiles} onClick={() => picker.current?.click()}>Add screenshots</button>
        <button type="button" disabled={!!job || !!review} onClick={() => { checkpoint(null); setError(''); }}>Clear screenshots</button>
        {stale && <button type="button" disabled={!!job || !!review} onClick={() => scan(true)}>Scan for current event</button>}
      </div>
      {stale && <p role="alert">An event changed. Scan this batch again before importing.</p>}
      <details className="stage9-source-list"><summary>Screenshot details · {items.length} files</summary><ul className="screenshot-results">{items.map(item => <ScreenshotResult key={item.id} item={item} locked={!!review || !!job || stale}
        onLegion={destination => checkpoint({ ...session, items: items.map(candidate => candidate.id === item.id ? { ...candidate, destination } : candidate) })}/>)}</ul></details>
      {groups.map(group => <button key={group.legion} type="button" className="screenshot-primary" disabled={!!job || !!review || stale}
        onClick={() => setReview({ ...group, context: { kind, alliance, legion: group.legion, expectedOccurrenceId: session.occurrenceIds[group.legion] } })}>
        Review Legion {group.legion} · {group.rows.length} readings
      </button>)}
    </>}
    {job && !review && !items.length && <p role="status">{job}</p>}
    {!loading && !review && (!items.length || run.current || read < items.length && !stale) && <div className="stage9-action-footer">
      {run.current ? <button type="button" className="screenshot-primary" disabled={run.current.stopped} onClick={() => { run.current.stopped = true; setJob('Stopping after current screenshot…'); }}>Stop scan</button> : !items.length ? <button type="button" className="screenshot-primary" disabled={!!job} onClick={() => picker.current?.click()}>Upload troop power</button> : <button type="button" className="screenshot-primary" disabled={!!job} onClick={() => scan()}>{read || items.some(item => item.error) ? 'Resume or retry unread screenshots' : 'Scan screenshots'}</button>}
    </div>}
    {error && <p role="alert" className="screenshot-error">{error}</p>}
    {recoveryError && <p role="alert">{recoveryError}</p>}
    {review && <ScreenshotReview {...review} players={players} storage={storage} onSave={saveOnce} Evidence={ScreenshotImage}
      initialMode={session?.drafts?.[review.legion]?.mode ?? mode}
      initialEdits={session?.drafts?.[review.legion]?.edits ?? {}}
      onDraftChange={draft => {
        if (!latest.current) return;
        const previous = latest.current.drafts?.[review.legion];
        if (JSON.stringify(previous) === JSON.stringify(draft)) return;
        checkpoint({ ...latest.current, mode: draft.mode, drafts: { ...latest.current.drafts, [review.legion]: draft } });
        setMode(draft.mode);
        try { localStorage.setItem('3573-ocr-import-mode', draft.mode); } catch {}
      }}
      onContinueTeams={review.legion === activeLegion && onContinueTeams ? () => { setReview(null); setWorkspaceOpen(false); onContinueTeams(); } : undefined}
      onClose={() => setReview(null)}/>}
    </>}
      {!session?.pendingImport && pendingStatus && !review && <p role="status">{pendingStatus}</p>}
      </div>
    </section>, document.body)}
    {children}
  </section>;
}
