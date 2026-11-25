import { useEffect, useRef, useState } from 'react';
import { BulkPlayerImport } from '../components/BulkPlayerImport.jsx';
import { readScreenshotPower } from './rosterScreenshotModel.js';
import './rosterScreenshot.css';

const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function RosterScreenshotImport({ kind, title, alliance, players, occurrenceIds, onSave }) {
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [language, setLanguage] = useState('eng');
  const [result, setResult] = useState(null);
  const [destination, setDestination] = useState('');
  const [job, setJob] = useState('');
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);
  const run = useRef(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => {
    if (run.current) {
      run.current.cancelled = true;
      void run.current.worker?.terminate();
    }
  }, []);

  function chooseFile(event) {
    const next = event.target.files?.[0];
    setResult(null);
    setDestination('');
    setReview(null);
    setImageUrl('');
    if (next && (!allowedTypes.has(next.type) || next.size > 15 * 1024 * 1024)) {
      setError('Choose a PNG, JPEG or WebP screenshot under 15 MB.');
      setFile(null);
      event.target.value = '';
      return;
    }
    setError('');
    setFile(next ?? null);
  }

  async function scan() {
    const task = { cancelled: false, worker: null };
    run.current = task;
    setJob('Loading screenshot reader…');
    setResult(null);
    setDestination('');
    setError('');
    try {
      const { createRosterReader, readRosterScreenshot } = await import('./readRosterScreenshot.js');
      if (task.cancelled) return;
      task.worker = await createRosterReader(language, status => {
        if (!task.cancelled && status === 'recognizing text') setJob('Reading legion and player rows…');
      });
      if (task.cancelled) return;
      const reading = await readRosterScreenshot(task.worker, file, kind);
      if (task.cancelled) return;
      const rows = reading.rows.filter(row => row.name || row.power !== null);
      setResult({ ...reading, rows, occurrenceIds });
      if (!rows.length) setError('No player rows found. Try a full screenshot of the in-game roster with names and power visible.');
    } catch (failure) {
      if (!task.cancelled) setError(failure.message?.startsWith('Use ')
        ? failure.message : 'Could not read this screenshot. Try again or paste the player names and power.');
    } finally {
      if (task.worker) await task.worker.terminate();
      if (run.current === task) run.current = null;
      if (!task.cancelled) setJob('');
    }
  }

  function beginReview() {
    const legion = Number(destination);
    const source = result.rows.map(row => {
      const player = row.name || 'Unread player name';
      return row.power === null ? player : player + '\t' + row.power;
    }).join('\n');
    setReview({ legion, source, occurrenceId: result.occurrenceIds[legion] });
  }

  return <section className="screenshot-import" aria-label="Screenshot import">
    <h3>Read roster screenshot</h3>
    <p>Choose the full in-game roster with its legion heading visible. The image stays on this device.</p>
    <label>Roster screenshot
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!!job} onChange={chooseFile}/>
    </label>
    <label>Player name language
      <select value={language} disabled={!!job || !!review} onChange={event => setLanguage(event.target.value)}>
        <option value="eng">English / Latin characters</option>
        <option value="kor">English and Korean</option>
      </select>
    </label>
    <button type="button" disabled={!file || !!job || !!review} onClick={scan}>Scan screenshot</button>
    {job && <p role="status">{job}</p>}
    {error && <p role="alert" className="screenshot-error">{error}</p>}
    {result && <>
      <p role="status">{result.legion ? 'Legion ' + result.legion + ' detected' : 'Legion could not be read'} · {result.rows.length} player {result.rows.length === 1 ? 'row' : 'rows'}</p>
      {imageUrl && <details><summary>View source screenshot</summary>
        <img src={imageUrl} alt="Selected in-game roster screenshot" />
      </details>}
    </>}
    {result?.rows.length > 0 && !review && <>
      <label>Confirm the legion shown in the screenshot
        <select value={destination} onChange={event => setDestination(event.target.value)}>
          <option value="">Choose a legion</option>
          {[1, 2].filter(legion => !result.legion || result.legion === legion).map(legion =>
            <option key={legion} value={legion}>Legion {legion}</option>)}
        </select>
      </label>
      <button type="button" disabled={!destination} onClick={beginReview}>Review names and power</button>
    </>}
    {review && <BulkPlayerImport title="Review screenshot readings" players={players} alliance={alliance}
      context={title} roleLabel={'Legion ' + review.legion} initialText={review.source} requirePower verifyReadings parsePower={readScreenshotPower}
      onConfirm={rows => onSave(review.legion, review.occurrenceId, rows)}
      onClose={() => { setReview(null); setResult(null); setDestination(''); }}/>
    }
  </section>;
}
