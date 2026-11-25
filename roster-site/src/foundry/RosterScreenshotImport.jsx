import { useEffect, useRef, useState } from 'react';
import { BulkPlayerImport } from '../components/BulkPlayerImport.jsx';
import { combineScreenshotRows, readScreenshotPower } from './rosterScreenshotModel.js';
import './rosterScreenshot.css';

const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxFiles = 25;
const fileKey = file => JSON.stringify([file.name, file.size, file.lastModified]);

function ScreenshotImage({ file }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  return url && <img src={url} alt={'Roster screenshot ' + file.name}/>;
}

function ScreenshotResult({ reading, locked, onLegion }) {
  const [open, setOpen] = useState(false);
  return <li>
    <details onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>{reading.file.name} · {reading.rows.length} player rows
        {reading.legion ? ' · Legion ' + reading.legion : ''}</summary>
      {open && <ScreenshotImage file={reading.file}/>}
    </details>
    {reading.error && <p className="screenshot-error">{reading.error}</p>}
    {!reading.legion && reading.rows.length > 0 && <label>
      Legion for {reading.file.name}
      <select value={reading.destination ?? ''} disabled={locked} onChange={event => onLegion(Number(event.target.value))}>
        <option value="">Choose a legion</option>
        <option value="1">Legion 1</option>
        <option value="2">Legion 2</option>
      </select>
    </label>}
  </li>;
}

export function RosterScreenshotImport({ kind, title, alliance, players, occurrenceIds, onSave, children }) {
  const [files, setFiles] = useState([]);
  const [batch, setBatch] = useState(null);
  const [job, setJob] = useState('');
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);
  const [saved, setSaved] = useState([]);
  const run = useRef(null);
  const picker = useRef(null);

  useEffect(() => () => {
    if (run.current) {
      run.current.cancelled = true;
      void run.current.worker?.terminate();
    }
  }, []);

  function clearResults() {
    setBatch(null);
    setReview(null);
    setSaved([]);
    setError('');
  }

  function chooseFiles(event) {
    const incoming = [...event.target.files];
    event.target.value = '';
    if (!incoming.length) return;
    clearResults();
    const valid = incoming.filter(file => allowedTypes.has(file.type) && file.size <= 15 * 1024 * 1024);
    const unique = [...new Map([...files, ...valid].map(file => [fileKey(file), file])).values()];
    setFiles(unique.slice(0, maxFiles));
    const warnings = [];
    if (incoming.length !== valid.length) warnings.push('Some files were skipped. Choose PNG, JPEG or WebP screenshots up to 15 MB each.');
    if (unique.length > maxFiles) warnings.push('A batch can contain up to ' + maxFiles + ' screenshots.');
    setError(warnings.join(' '));
  }

  async function scan() {
    const task = { cancelled: false, worker: null };
    run.current = task;
    clearResults();
    setJob('Loading multilingual screenshot reader…');
    try {
      const { createRosterReader, readRosterScreenshot } = await import('./readRosterScreenshot.js');
      if (task.cancelled) return;
      task.worker = await createRosterReader();
      const readings = [];
      for (const [index, file] of files.entries()) {
        if (task.cancelled) return;
        setJob('Scanning screenshot ' + (index + 1) + ' of ' + files.length + '…');
        try {
          const reading = await readRosterScreenshot(task.worker, file, kind);
          const rows = reading.rows.filter(row => row.name || row.power !== null);
          readings.push({ file, ...reading, rows, error: rows.length ? '' : 'No readable player rows found.' });
        } catch (failure) {
          readings.push({ file, rows: [], error: failure.message?.startsWith('Use ')
            ? failure.message : 'Could not read this screenshot.' });
        }
      }
      if (!task.cancelled) setBatch({ readings, occurrenceIds });
    } catch {
      if (!task.cancelled) setError('Could not load the screenshot reader. Try scanning again.');
    } finally {
      if (task.worker) await task.worker.terminate();
      if (run.current === task) run.current = null;
      if (!task.cancelled) setJob('');
    }
  }

  const readings = batch?.readings ?? [];
  const groups = [1, 2].map(legion => ({
    legion, rows: combineScreenshotRows(readings.filter(item => (item.legion ?? item.destination) === legion)),
  })).filter(group => group.rows.length);
  const pendingLegion = readings.some(item => item.rows.length && !(item.legion || item.destination));

  function beginReview(group) {
    const source = group.rows.map(({ name, power }) => {
      const player = name || 'Unread player name';
      return power === null ? player : player + '\t' + power;
    }).join('\n');
    setReview({ legion: group.legion, source, occurrenceId: batch.occurrenceIds[group.legion] });
  }

  return <section className="screenshot-import" aria-label="Troop power upload">
    <input ref={picker} type="file" hidden multiple accept="image/png,image/jpeg,image/webp" aria-label="Troop power screenshots"
      disabled={!!job || !!review} onChange={chooseFiles}/>
    {!files.length && <>
      <button type="button" className="screenshot-primary" onClick={() => picker.current?.click()}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><path d="m3 17 5-4 4 3 4-5 5 5"/>
        </svg>Upload troop power
      </button>
      <p>Select up to 25 screenshots. Include the legion heading.</p>
    </>}
    {files.length > 0 && <>
      <p>{files.length} {files.length === 1 ? 'screenshot' : 'screenshots'} selected</p>
      {!batch && <button type="button" className="screenshot-primary" disabled={!!job} onClick={scan}>Scan screenshots</button>}
      <div className="screenshot-secondary">
        <button type="button" disabled={!!job || !!review} onClick={() => picker.current?.click()}>Add screenshots</button>
        <button type="button" disabled={!!job || !!review} onClick={() => { setFiles([]); clearResults(); }}>Clear screenshots</button>
        {batch && <button type="button" disabled={!!review || !!saved.length} onClick={scan}>Scan again</button>}
      </div>
    </>}
    {job && <p role="status">{job}</p>}
    {error && <p role="alert" className="screenshot-error">{error}</p>}
    {batch && <>
      <p role="status">{readings.filter(item => item.rows.length).length} of {readings.length} screenshots read</p>
      <ul className="screenshot-results">{readings.map((reading, index) =>
        <ScreenshotResult key={fileKey(reading.file)} reading={reading} locked={!!review || !!saved.length}
          onLegion={destination => setBatch(current => ({ ...current, readings: current.readings.map((item, position) =>
            position === index ? { ...item, destination } : item) }))}/>
      )}</ul>
      {pendingLegion && <p>Choose a legion for each screenshot with an unreadable heading.</p>}
      {groups.map(group => saved.includes(group.legion)
        ? <p key={group.legion} role="status">Legion {group.legion} readings saved</p>
        : <button type="button" className="screenshot-primary" key={group.legion} disabled={!!review || pendingLegion} onClick={() => beginReview(group)}>
          Review Legion {group.legion} · {group.rows.length} {group.rows.length === 1 ? 'reading' : 'readings'}
        </button>)}
    </>}
    {review && <BulkPlayerImport title="Review screenshot readings" players={players} alliance={alliance}
      context={title} roleLabel={'Legion ' + review.legion} initialText={review.source} requirePower verifyReadings startWithMatches parsePower={readScreenshotPower}
      onConfirm={rows => {
        const result = onSave(review.legion, review.occurrenceId, rows);
        if (!result?.error) setSaved(current => [...current, review.legion]);
        return result;
      }}
      onClose={() => setReview(null)}/>}
    {review && !saved.includes(review.legion) && <button type="button" onClick={() => setReview(null)}>Back to screenshots</button>}
    {children}
  </section>;
}
