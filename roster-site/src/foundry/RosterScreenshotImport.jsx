import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { registrationCountReview, combineScreenshotRows } from './rosterScreenshotModel.js';
import { readScreenshotSession, writeScreenshotSession } from './screenshotSession.js';
import { ScreenshotReview } from './ScreenshotReview.jsx';
import './rosterScreenshot.css';

const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxFiles = 25;
const sameEvent = (first, second) => first?.[1] === second[1] && first?.[2] === second[2];

async function screenshotId(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function ScreenshotImage({ file, bounds }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  return url && <figure className="screenshot-evidence">
    <img src={url} alt={'Roster screenshot ' + file.name}/>
    {bounds && <span aria-hidden="true" style={{ top: bounds.top * 100 + '%', height: (bounds.bottom - bounds.top) * 100 + '%' }}/>}
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

export function RosterScreenshotImport({ kind, title, alliance, activeLegion, storage, players, occurrenceIds, onSave, children }) {
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
    return () => { document.body.style.overflow = previous; launchRef.current?.focus(); };
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
    let worker;
    setError('');
    setJob('Loading multilingual screenshot reader…');
    try {
      const { createRosterReader, readRosterScreenshot } = await import('./readRosterScreenshot.js');
      if (task.stopped) return;
      worker = await createRosterReader();
      for (const item of todo) {
        if (task.stopped || !sameEvent(batch.occurrenceIds, eventIds.current)) break;
        const complete = batch.items.filter(candidate => candidate.reading).length;
        setJob('Scanning ' + item.file.name + ' · ' + complete + ' of ' + batch.items.length + ' read');
        let outcome;
        try {
          const reading = await readRosterScreenshot(worker, item.file);
          outcome = reading.rows.length ? { reading, error: '' } : { reading: null, partial: reading.partial, error: 'No complete player rows found.' };
        } catch (failure) {
          outcome = { error: failure.message?.startsWith('Use ') ? failure.message : 'Could not read this screenshot.' };
        }
        batch = { ...batch, items: batch.items.map(candidate => candidate.id === item.id ? { ...item, ...outcome } : candidate) };
        if (!mounted.current) break;
        checkpoint(batch);
        await writes.current.catch(() => {});
      }
    } catch {
      if (mounted.current && !task.stopped) setError('Could not load the screenshot reader. Try scanning again.');
    } finally {
      if (worker) await worker.terminate().catch(() => {});
      run.current = null;
      if (mounted.current) setJob('');
    }
  }

  async function saveOnce(action) {
    const ids = [...new Set([...action.powers, ...(action.roleChanges ?? [])].map(row => row.id))];
    if (ids.some(id => latest.current?.savedIds?.includes(id))) {
      return { error: 'A selected player was already imported from this batch. Skip the duplicate reading.' };
    }
    const result = await onSave(action);
    if (!result?.error && latest.current && mounted.current) {
      checkpoint({ ...latest.current, savedIds: [...(latest.current.savedIds ?? []), ...ids] });
      await writes.current.catch(() => {});
    }
    return result;
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
      <header className="stage9-import-header"><div><small>{title} · {alliance} · Legion {activeLegion}</small><h2>Import roster</h2></div><button type="button" disabled={!!job} onClick={() => { setReview(null); setWorkspaceOpen(false); }}>Close</button></header>
      <div className="stage9-import-content">
    <input ref={picker} type="file" hidden multiple accept="image/png,image/jpeg,image/webp" aria-label="Troop power screenshots"
      disabled={loading || !!job || !!review} onChange={chooseFiles}/>
    {!loading && !review && <label>Import mode<select value={mode} disabled={!!job} onChange={event => chooseMode(event.target.value)}><option value="powers">Troop powers only</option><option value="roles">Registrations only</option><option value="both">Troop powers and registrations</option></select></label>}
    {loading && <p role="status">Checking for a previous batch…</p>}
    {!loading && !items.length && <>
      <button type="button" className="screenshot-primary" disabled={!!job} onClick={() => picker.current?.click()}>Upload troop power</button>
      <p>Select up to 25 screenshots. Include the legion heading.</p>
    </>}
    {!!items.length && !review && <>
      <p>{title} · {alliance} · Legion {activeLegion}</p>
      <div className="stage9-progress-panel"><h3>{job ? 'Processing screenshots' : read === items.length ? 'Screenshots ready' : 'Ready to scan'}</h3><p role="status">{read} of {items.length} screenshots read</p><progress aria-label="Screenshot processing progress" value={read} max={items.length}/></div>
      {read < items.length && !stale && <button type="button" className="screenshot-primary" disabled={!!job || !!review}
        onClick={() => scan()}>{read || items.some(item => item.error) ? 'Resume or retry unread screenshots' : 'Scan screenshots'}</button>}
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
    {job && !review && <><p role="status">{job}</p>{run.current && <button type="button" onClick={() => { run.current.stopped = true; setJob('Stopping after current screenshot…'); }}>Stop scan</button>}</>}
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
      onClose={() => setReview(null)}/>}
      </div>
    </section>, document.body)}
    {children}
  </section>;
}
