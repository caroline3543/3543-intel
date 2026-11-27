import { useEffect, useMemo, useState } from 'react';
import { normaliseBulkName } from '../components/bulkImportModel.js';
import { eventAssignments, plannerSlot } from '../../../src/services/eventPlanner.js';
import { readScreenshotPower } from './rosterScreenshotModel.js';
import { assignmentLabel, prepareScreenshotImport, roleName, screenshotMatches } from './screenshotImportPlan.js';

const roles = { combatant: 'Combatant', substitute: 'Substitute', unassigned: 'Unassigned', 'other-legion': 'Other legion', unknown: 'Unknown' };
const modeLabels = { powers: 'troop powers', roles: 'registrations', both: 'troop powers and registrations' };

export function ScreenshotReview({ context, rows, sources, players, storage, counts, onClose, onSave, Evidence }) {
  const [mode, setMode] = useState('powers');
  const [edits, setEdits] = useState({});
  const [filter, setFilter] = useState('all');
  const [preview, setPreview] = useState(null);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);
  const { alliance, legion, kind } = context;
  const target = plannerSlot(storage, kind, alliance, legion);
  const assignments = useMemo(() => eventAssignments(storage, kind), [storage, kind]);
  const matches = useMemo(() => rows.map(row => screenshotMatches(row.name, players, alliance)), [rows, players, alliance]);
  const playerById = useMemo(() => new Map(players.map(player => [player.id, player])), [players]);
  const evaluated = rows.map((row, index) => {
    const edit = edits[row.rowId] ?? {};
    const match = matches[index];
    const player = edit.playerId === undefined ? match.player : playerById.get(edit.playerId);
    const powerConflict = row.powerConflict?.length > 1;
    const powerText = edit.power ?? (powerConflict ? '' : String(row.power ?? ''));
    const power = powerText.trim() ? readScreenshotPower(powerText) : null;
    const conflict = row.conflict || mode !== 'roles' && powerConflict;
    const needsReview = !player || conflict && !edit.checked || mode !== 'roles' && power === null || row.registration === 'unknown';
    return { row, edit, match, player, powerText, power, conflict, needsReview };
  });
  const active = evaluated.filter(item => !item.edit.skip);
  const confirmed = active.filter(item => item.player);
  const visible = evaluated.filter(({ row, edit, needsReview }) =>
    filter === 'all' || (filter === 'review' ? needsReview && !edit.skip : row.registration === filter));
  const update = (id, patch) => {
    setEdits(previous => ({ ...previous, [id]: { ...previous[id], ...patch } }));
    setPreview(null);
  };
  useEffect(() => setPreview(null), [storage]);

  function prepare() {
    if (active.some(item => !item.player || item.conflict && !item.edit.checked ||
      mode !== 'roles' && (item.powerText.trim() ? item.power === null : mode === 'powers' || item.row.powerConflict?.length > 1))) {
      setStatus('Resolve or skip each unmatched or conflicting reading and check the troop powers.');
      return;
    }
    const result = prepareScreenshotImport(storage, context, confirmed.map(({ player, power, edit }) => ({
      id: player.id, name: player.name, alliance: player.alliance, power,
      previousPower: player.hasPower ? player.power : null,
      role: edit.role === 'remove' ? '' : edit.role || null,
    })), mode);
    setStatus(result.error ?? '');
    setPreview(result.error ? null : result);
  }
  async function confirm() {
    setWorking(true);
    try {
      const result = await onSave(preview.action);
      setStatus(result?.error || result?.message || 'Import applied.');
      if (!result?.error) setDone(true);
    } catch {
      setStatus('Could not confirm the import. Check workspace sync before trying again.');
    } finally {
      setWorking(false);
    }
  }

  return <section className="ocr-review" aria-label="Review screenshot readings">
    <h3>{alliance} · Legion {legion} review</h3>
    {done ? <><p role="status">{status}</p><button type="button" onClick={onClose}>Done</button></> : <>
      <p>{rows.length} readings · {new Set(confirmed.map(item => item.player.id)).size} matched · {active.length - confirmed.length} unresolved · {active.filter(item => item.conflict && !item.edit.checked).length} conflicting</p>
      <label>Import mode
        <select value={mode} disabled={working} onChange={event => { setMode(event.target.value); setPreview(null); }}>
          <option value="powers">Troop powers only</option>
          <option value="roles">Registrations only</option>
          <option value="both">Troop powers and registrations</option>
        </select>
      </label>
      <details>
        <summary>Registration totals and coverage</summary>
        {counts.map(count => <p key={count.role}>{roles[count.role]} · Game {count.conflict ? 'totals conflict' : count.expected ?? 'unreadable'} · OCR {count.detected} · Matched {new Set(confirmed.filter(item => item.row.registration === count.role && (!item.conflict || item.edit.checked)).map(item => item.player.id)).size}</p>)}
        <p>Counts reflect the screenshots supplied. Missing, clipped or conflicting rows can affect coverage.</p>
      </details>
      <label>Filter readings
        <select value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="all">All readings</option><option value="review">Needs review</option>
          {Object.entries(roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <fieldset disabled={working}>
        {visible.map(({ row, edit, match, player, powerText, conflict, needsReview }) => {
          const current = assignments.get(player?.id) ?? [];
          const here = target.registrations[player?.id];
          const query = String(edit.search ?? '').trim().toLocaleLowerCase();
          const normalized = normaliseBulkName(query);
          const candidates = query ? players.filter(candidate =>
            [candidate.name, candidate.playerId, candidate.id, ...(candidate.searchFields ?? [])].some(value =>
              String(value ?? '').toLocaleLowerCase().includes(query) ||
              normalized && normaliseBulkName(value).includes(normalized))).slice(0, 8) : match.candidates;
          const title = row.name || 'Unread player name';
          return <details key={row.rowId} className="ocr-reading">
            <summary><strong>{title}</strong> · {powerText || 'Power missing'} · {roles[row.registration] || 'Unknown'}
              {edit.skip ? ' · Skipped' : conflict && !edit.checked ? ' · Conflicting readings' : needsReview ? ' · Review' : ''}
              {player && <small>{player.name} · {player.alliance || 'Alliance unknown'}</small>}
            </summary>
            <div className="ocr-reading-fields">
              {row.otherLegion > 0 && <p>Dispatched to Legion {row.otherLegion}</p>}
              {(row.voted || row.battleRequest) && <p>{[row.voted && 'Voted', row.battleRequest && 'Battle Request'].filter(Boolean).join(' · ')}</p>}
              {row.evidence.map(({ sourceIndex, bounds }) => <details key={sourceIndex + ':' + bounds?.top}>
                <summary>{sources[sourceIndex].file.name} · Screenshot evidence</summary>
                <Evidence file={sources[sourceIndex].file} bounds={bounds}/>
              </details>)}
              <label><input type="checkbox" checked={!!edit.skip} onChange={event => update(row.rowId, { skip: event.target.checked })}/> Skip this reading</label>
              {!edit.skip && <>
                <label>Search roster for {title}<input type="search" value={edit.search ?? ''} onChange={event => update(row.rowId, { search: event.target.value })}/></label>
                {candidates.map(candidate => <button key={candidate.id} type="button" aria-pressed={candidate.id === player?.id}
                  onClick={() => update(row.rowId, { playerId: candidate.id, ...(candidate.id !== player?.id ? { role: null } : {}) })}>
                  {candidate.name} · {candidate.alliance || 'Alliance unknown'} · ID {candidate.playerId || candidate.id}
                </button>)}
                {mode !== 'roles' && <label>Troop power for {title}<input inputMode="decimal" value={powerText} onChange={event => update(row.rowId, { power: event.target.value, checked: false })}/></label>}
                {mode !== 'roles' && row.powerConflict?.length > 1 && <div className="ocr-power-choices" aria-label="Competing troop powers">
                  {row.powerConflict.map(value => <button type="button" key={value} aria-pressed={powerText === String(value)}
                    onClick={() => update(row.rowId, { power: String(value), checked: false })}>{value.toLocaleString()}</button>)}
                </div>}
                {player && player.alliance !== alliance && <p role="status">Alliance membership mismatch: {player.alliance || 'Unknown'}. Verify membership in Members before registering. Troop powers can still be saved.</p>}
                {mode !== 'powers' && <>
                  <p>Existing registration: {current.length ? current.map(assignmentLabel).join(' / ') : roleName(here || '')}.</p>
                  <label>Registration for {title}
                    <select disabled={!!player && player.alliance !== alliance} value={edit.role ?? ''} onChange={event => update(row.rowId, { role: event.target.value })}>
                      <option value="">Keep existing</option><option value="join">Legion {legion} combatant</option>
                      <option value="sub">Legion {legion} substitute</option>
                      {here && <option value="remove">Remove Legion {legion} registration</option>}
                    </select>
                  </label>
                </>}
                {conflict && <label><input type="checkbox" checked={!!edit.checked} onChange={event => update(row.rowId, { checked: event.target.checked })}/> I checked the conflicting evidence for this player.</label>}
              </>}
            </div>
          </details>;
        })}
      </fieldset>
      {preview ? <section aria-label="Confirm screenshot import">
        <h4>Confirm {modeLabels[mode]}</h4>
        <ul>{preview.changes.map(change => <li key={change.id + ':' + (change.after ? 'role' : 'power')}>
          <strong>{change.name}</strong> · {change.after
            ? assignmentLabel(change.before) + ' → ' + assignmentLabel(change.after)
            : (change.previousPower?.toLocaleString() ?? 'No power recorded') + ' → ' + change.power.toLocaleString()}
        </li>)}</ul>
        <button type="button" disabled={working} onClick={confirm}>{working ? 'Applying changes…' : preview.changes.some(change => change.destructive) ? 'Confirm registration moves or removals and save' : 'Save ' + modeLabels[mode]}</button>
        <button type="button" disabled={working} onClick={() => setPreview(null)}>Keep reviewing</button>
      </section> : <button type="button" className="screenshot-primary" onClick={prepare}>Review {modeLabels[mode]} changes</button>}
      {status && <p role="alert">{status}</p>}
      <button type="button" disabled={working} onClick={onClose}>Back to screenshots</button>
    </>}
  </section>;
}
