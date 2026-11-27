import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { normaliseBulkName } from '../components/bulkImportModel.js';
import { eventAssignments, plannerSlot, EVENT_LIMITS } from '../../../src/services/eventPlanner.js';
import { readScreenshotPower } from './rosterScreenshotModel.js';
import { assignmentLabel, prepareScreenshotImport, roleName, createScreenshotMatcher, suspiciousPowerChange } from './screenshotImportPlan.js';

import {createCurrentAvatarEvidence} from './currentAvatarEvidence.js';
import {screenshotAvatarEvidence} from './screenshotAvatarEvidence.js';
import {reviewAvatarSuggestions} from './reviewAvatarSuggestions.js';

const roles = { combatant: 'Combatant', substitute: 'Substitute', unassigned: 'Unassigned', 'other-legion': 'Other legion', unknown: 'Unknown' };
const modeLabels = { powers: 'troop powers', roles: 'registrations', both: 'troop powers and registrations' };

export function ScreenshotReview({ context, rows, sources, players, preferredIds, storage, counts, onClose, onSave, Evidence, PreloadEvidence, initialMode = 'powers', initialEdits = {}, onDraftChange, onContinueTeams, avatarAssist = false }) {
  const [mode, setMode] = useState(initialMode);
  const [edits, setEdits] = useState(initialEdits);
  const [filter, setFilter] = useState('review');
  const [preview, setPreview] = useState(null);
  const [working, setWorking] = useState(false);
  const [pendingSave,setPendingSave]=useState(false);
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [summary, setSummary] = useState(true);
  const [focusedId, setFocusedId] = useState(null);
  const [identityChoice,setIdentityChoice]=useState(null);
  const reviewRef=useRef(null);
  const { alliance, legion, kind } = context;
  const target = plannerSlot(storage, kind, alliance, legion);
  const projected = { ...target.registrations };
  for (const change of preview?.action.roleChanges ?? []) projected[change.id] = change.role;
  const capacity = EVENT_LIMITS[kind];
  const assignments = useMemo(() => eventAssignments(storage, kind), [storage, kind]);
  const registeredIds=useMemo(()=>Object.keys(target.registrations).filter(id=>['join','sub'].includes(target.registrations[id])),[target.registrations]);
  const matcher=useMemo(()=>createScreenshotMatcher(players,alliance,preferredIds,registeredIds),[players,alliance,preferredIds,registeredIds]);
  const matches=useMemo(()=>rows.map(row=>matcher(row.name)),[rows,matcher]);
  const playerById = useMemo(() => new Map(players.map(player => [player.id, player])), [players]);
  const evaluated = useMemo(()=>rows.map((row, index) => {
    const edit = edits[row.rowId] ?? {};
    const match = matches[index];
    const player = edit.playerId === undefined ? match.player : playerById.get(edit.playerId);
    const powerConflict = row.powerConflict?.length > 1;
    const powerText = edit.power ?? (powerConflict ? '' : String(row.power ?? ''));
    const power = powerText.trim() ? readScreenshotPower(powerText) : null;
    const conflict = row.conflict || mode !== 'roles' && powerConflict;
    const previousPower = target.powerByPlayer?.[player?.id] ?? (player?.hasPower ? player.power : null);
    const unusualPower = mode !== 'roles' && suspiciousPowerChange(previousPower,power);
    const powerPending = mode !== 'roles' && (edit.power !== undefined && !edit.powerConfirmed || unusualPower && (edit.powerApproval?.previous !== previousPower || edit.powerApproval?.next !== power));
    const detectedRole={combatant:'join',substitute:'sub'}[row.registration];
    const registrationPending=mode!=='powers' && ['unknown','other-legion','combatant','substitute'].includes(row.registration) && !edit.registrationReviewed && !(player && detectedRole && target.registrations[player.id]===detectedRole && !conflict && !edit.role);
    const needsReview = powerPending || !player || conflict && !edit.checked || mode !== 'roles' && power === null || registrationPending;
    return { row, edit, match, player, powerText, power, conflict, needsReview, powerPending, previousPower, unusualPower, registrationPending };
  }),[rows,edits,matches,playerById,target.powerByPlayer,target.registrations,mode]);
  useEffect(() => { onDraftChange?.({ mode, edits }); }, [mode, edits]);
  const active = evaluated.filter(item => !item.edit.skip);
  const confirmed = active.filter(item => item.player);
  const priority = item => !item.player ? 0 : mode !== 'roles' && (item.powerPending || item.power === null || item.conflict && !item.edit.checked) ? 1 : 2;
  const exceptions = active.filter(item => item.needsReview).sort((a,b)=>priority(a)-priority(b));
  const issueCounts = [
    ['Identity matches', exceptions.filter(item=>!item.player).length],
    ['Troop power checks', exceptions.filter(item=>mode!=='roles'&&(item.powerPending||item.power===null||item.row.powerConflict?.length>1&&!item.edit.checked)).length],
    ['Registration checks', exceptions.filter(item=>item.registrationPending).length],
    ['Conflicting evidence', exceptions.filter(item=>item.conflict&&!item.edit.checked).length],
  ];
  const focused = evaluated.find(item => item.row.rowId === focusedId) ?? exceptions[0];
  useLayoutEffect(()=>{const node=reviewRef.current; if(!node)return; let parent=node.parentElement; while(parent){if(parent.scrollHeight>parent.clientHeight && /auto|scroll/.test(getComputedStyle(parent).overflowY)){parent.scrollTop=0;break;}parent=parent.parentElement;}},[focused?.row.rowId]);
  const upcomingFiles=useMemo(()=>[...new Set([focused,...exceptions.filter(item=>item!==focused).slice(0,2)].filter(Boolean).flatMap(item=>item.row.evidence.slice(0,1).map(e=>sources[e.sourceIndex]?.file)).filter(Boolean))],[focused,exceptions,sources]);
  const selectedIdentity=identityChoice && focused && identityChoice.rowId===focused.row.rowId ? identityChoice.id : !focused?.edit.search ? focused?.match?.suggested?.id : null;
  const focusedStage = !focused?.player ? 4 : mode !== "roles" && (focused.powerPending || focused.power === null || focused.conflict && !focused.edit.checked) ? 5 : 6;
  useEffect(() => {
    if (filter === 'review' && focusedId && (!focused || focused.edit.skip || !focused.needsReview)) setFocusedId(null);
  }, [filter, focusedId, focused?.needsReview, focused?.edit.skip]);
  const avatarCache = useMemo(()=>createCurrentAvatarEvidence(),[]);
  const [avatarSuggestion,setAvatarSuggestion]=useState(null);
  useEffect(()=>()=>avatarCache.clear(),[avatarCache]);
  const avatarRow=focused?.row;
  const avatarCandidates=focused?.match.candidates;
  const avatarSearch=focused?.edit.search;
  useEffect(()=>{
    setAvatarSuggestion(null);
    if(!avatarAssist||summary||preview||done||filter!=='review'||focusedStage!==4||avatarSearch||!avatarRow||!avatarCandidates?.length)return;
    const controller=new AbortController();
    const evidence=avatarRow.evidence?.[0];
    if(!evidence)return;
    (async()=>{
      const fingerprint=await screenshotAvatarEvidence(sources[evidence.sourceIndex]?.file,evidence.bounds);
      const result=await reviewAvatarSuggestions({fingerprint,candidates:avatarCandidates,referenceCache:avatarCache,signal:controller.signal});
      if(!controller.signal.aborted&&result)setAvatarSuggestion({rowId:avatarRow.rowId,...result});
    })().catch(()=>{});
    return ()=>controller.abort();
  },[avatarAssist,summary,preview,done,filter,focusedStage,avatarRow,avatarCandidates,avatarSearch,sources,avatarCache]);
  const visible = evaluated.filter(({ row, edit, needsReview }) =>
    filter === 'all' || (filter === 'review' ? row.rowId === focused?.row.rowId : row.registration === filter));
  const update = (id, patch) => {
    setEdits(previous => ({ ...previous, [id]: { ...previous[id], ...patch } }));
    setPreview(null);
  };
  useEffect(() => { if(!working&&!pendingSave&&!done)setPreview(null); }, [storage]);

  function prepare() {
    if (exceptions.length || active.some(item => !item.player || item.conflict && !item.edit.checked ||
      mode !== 'roles' && (item.powerText.trim() ? item.power === null : mode === 'powers' || item.row.powerConflict?.length > 1))) {
      setStatus('Resolve or skip each unmatched or conflicting reading and check the troop powers.');
      return;
    }
    const result = prepareScreenshotImport(storage, context, confirmed.map(({ player, power, edit }) => ({
      id: player.id, name: player.name, alliance: player.alliance, power,
      previousPower: player.hasPower ? player.power : null, powerApproval: edit.powerApproval,
      role: edit.role === 'remove' ? '' : edit.role || null,
    })), mode);
    setStatus(result.error ?? '');
    setPreview(result.error ? null : result);
  }
  async function confirm() {
    setWorking(true);
    try {
      const result = await onSave(preview.action);
      setPendingSave(!!result?.pending);
      setStatus(result?.error || result?.message || 'Import applied.');
      if (!result?.error && result?.message) { setReceipt({ powers: preview.action.powers.length, roles: preview.action.roleChanges?.length ?? 0, excluded: evaluated.length-active.length }); setDone(true); }
      else if (!result?.error) setStatus('Save outcome could not be verified. Check roster before retrying.');
    } catch {
      setStatus('Could not confirm the import. Check workspace sync before trying again.');
    } finally {
      setWorking(false);
    }
  }

  const stage = done ? 8 : summary ? 3 : preview ? 7 : focusedStage;
  return <section ref={reviewRef} className="ocr-review" aria-label="Review screenshot readings">
    {PreloadEvidence && !done && !preview && <PreloadEvidence files={upcomingFiles}/>}
    <div className="stage9-step-strip" aria-label={`Step ${stage} of 8`}>{Array.from({length:8},(_,i)=><span key={i} className={i+1===stage?"current":i+1<stage?"complete":""}/>)}</div>

    {summary && !done ? <div className="stage9-summary"><h4>Import summary</h4><div className="stage9-summary-grid"><div><strong>{rows.length}</strong><span>Readings</span></div><div><strong>{new Set(confirmed.map(item => item.player.id)).size}</strong><span>Matched</span></div><div><strong>{active.length-confirmed.length}</strong><span>Unresolved</span></div><div><strong>{active.filter(item => item.conflict && !item.edit.checked).length}</strong><span>Conflicting</span></div></div><p>{exceptions.length ? exceptions.length + ' readings need your attention before saving.' : 'No outstanding reading exceptions.'}</p>{exceptions.length>0&&<section className="stage9-issue-breakdown" aria-label="Exception breakdown"><h5>What needs attention</h5>{issueCounts.filter(([,count])=>count>0).map(([label,count])=><div key={label}><span>{label}</span><strong>{count}</strong></div>)}<small>A reading may have more than one issue.</small></section>}<div className="stage9-action-footer"><button type="button" className="screenshot-primary" onClick={() => { setSummary(false); if (!exceptions.length) prepare(); }}>{exceptions.length ? 'Resolve ' + exceptions.length + ' readings' : 'Review changes'}</button><button type="button" onClick={onClose}>Back to screenshots</button></div></div> : done ? <div className="stage9-completion"><div className="stage9-completion-mark" aria-hidden="true">✓</div><h4>Import complete</h4><p role="status">{status}</p><div className="stage9-summary-grid"><div><strong>{receipt?.powers ?? 0}</strong><span>Troop power updates</span></div><div><strong>{receipt?.roles ?? 0}</strong><span>Registration updates</span></div></div><p>{receipt?.excluded ?? 0} readings excluded. Registrations outside the submitted changes were not included in this import.</p><div className="stage9-action-footer">{onContinueTeams && <button type="button" className="screenshot-primary" onClick={onContinueTeams}>Continue to Teams</button>}<button type="button" className={!onContinueTeams?"screenshot-primary":undefined} onClick={onClose}>Done</button></div></div> : preview ? <>
      <section aria-label="Confirm screenshot import">
        <h4>Review proposed changes</h4>
        <p>{preview.action.powers.length} power updates · {preview.action.roleChanges?.length ?? 0} registration changes · {evaluated.length-active.length} excluded</p>
        <div className="stage9-summary-grid">
          {['join','sub'].map(role => <div key={role}><span>{roleName(role)}</span><strong>{Object.values(projected).filter(value=>value===role).length} / {capacity[role]}</strong><span>After import</span></div>)}
        </div>
        <p>Registration capacity is validated before saving.</p>
        <div className="stage9-change-list">{Array.from(new Set(preview.changes.map(change=>change.id))).map(id=>{
          const changes=preview.changes.filter(change=>change.id===id);
          return <article className="stage9-change-card" key={id}><h5>{changes[0].name}</h5>
            {changes.map((change,i)=><div className="stage9-change-values" key={i}><small>{change.after?'Registration':'Troop power'}</small><span>{change.after?assignmentLabel(change.before):change.previousPower?.toLocaleString()??'Not recorded'}</span><span aria-hidden="true">→</span><strong>{change.after?assignmentLabel(change.after):change.power.toLocaleString()}</strong></div>)}
            <button type="button" disabled={working} onClick={()=>{const item=confirmed.find(entry=>entry.player.id===id);if(item){update(item.row.rowId,{skip:true});setFilter('all');}}}>Exclude player</button>
          </article>;
        })}</div>
        <div className="stage9-action-footer"><button type="button" className="screenshot-primary" disabled={working} onClick={confirm}>{working ? 'Verifying shared save…' : pendingSave ? 'Check save status' : preview.changes.some(change => change.destructive) ? 'Confirm registration moves or removals and save' : 'Save ' + modeLabels[mode]}</button>
        <button type="button" disabled={working||pendingSave} onClick={() => setPreview(null)}>Keep reviewing</button></div>
      </section>
      {status && <p role="alert">{status}</p>}
    </> : <>
      <p className="stage9-review-counts" hidden={filter==="review" && !!focused}>{rows.length} readings · {new Set(confirmed.map(item => item.player.id)).size} matched · {active.length - confirmed.length} unresolved · {active.filter(item => item.conflict && !item.edit.checked).length} conflicting</p>
      {filter === "review" && focused && <h4 className="stage9-exception-title">{stage===4?"Confirm player identity":stage===5?"Confirm troop power":"Review registration"}</h4>}
      <fieldset disabled={working}>
        {visible.map(({ row, edit, match, player, powerText, power, powerPending, previousPower, unusualPower, conflict, needsReview }) => {
          const current = assignments.get(player?.id) ?? [];
          const here = target.registrations[player?.id];
          const query = String(edit.search ?? '').trim().toLocaleLowerCase();
          const normalized = normaliseBulkName(query);
          const candidates = query ? players.filter(candidate =>
            [candidate.name, candidate.playerId, candidate.id, ...(candidate.searchFields ?? [])].some(value =>
              String(value ?? '').toLocaleLowerCase().includes(query) ||
              normalized && normaliseBulkName(value).includes(normalized))).sort((a,b)=>{const rank=p=>{const n=normaliseBulkName(p.name);return n===normalized?0:n.startsWith(normalized)?1:n.includes(normalized)?2:3;};return rank(a)-rank(b)||Number(b.alliance===alliance)-Number(a.alliance===alliance);}).slice(0, 8) : match.candidates;
          const title = row.name || 'Unread player name';
          return <details key={row.rowId} className="ocr-reading" open={filter === 'review' ? true : undefined}>
            <summary><strong>{title}</strong>{filter!=="review" && <> · {powerText || 'Power missing'} · {roles[row.registration] || 'Unknown'}</>}
              {filter!=="review" && (edit.skip ? ' · Skipped' : conflict && !edit.checked ? ' · Conflicting readings' : needsReview ? ' · Review' : '')}
              {player && (filter!=="review" || player.name!==title) && <small>{player.name} · {player.alliance || 'Alliance unknown'}</small>}
              {player && player.alliance !== alliance && <p role="status">Home alliance: {player.alliance || 'Unknown'}. Registration context: {alliance}.</p>}
            </summary>
            <div className="ocr-reading-fields">
              {row.otherLegion > 0 && <p>Dispatched to Legion {row.otherLegion}</p>}
              {(row.voted || row.battleRequest) && <p>{[row.voted && 'Voted', row.battleRequest && 'Battle Request'].filter(Boolean).join(' · ')}</p>}
              {row.evidence.map(({ sourceIndex, bounds }) => <details key={sourceIndex + ':' + bounds?.top} open={filter === 'review' ? true : undefined}>
                <summary>{filter==="review"?"Screenshot evidence":sources[sourceIndex].file.name+" · Screenshot evidence"}</summary>
                <Evidence file={sources[sourceIndex].file} bounds={bounds}/>
              </details>)}
              {filter !== "review" && <label><input type="checkbox" checked={!!edit.skip} onChange={event => update(row.rowId, { skip: event.target.checked })}/> Skip this reading</label>}
              {!edit.skip && <>
                {(filter !== "review" || stage === 4) && <><label>Search roster for {title}<input type="search" value={edit.search ?? ''} onChange={event => update(row.rowId, { search: event.target.value })}/></label>
                {filter==='review' && stage===4 && match.suggested && !query && <p>Suggested match selected. Check the screenshot before confirming.</p>}
                {candidates.map(candidate => <button key={candidate.id} type="button" style={candidate.id === (filter === 'review' ? selectedIdentity ?? player?.id : player?.id)?{borderColor:'#4ade80',background:'#172e29'}:undefined} aria-pressed={candidate.id === (filter === 'review' ? selectedIdentity ?? player?.id : player?.id)}
                  onClick={() => filter === 'review' ? setIdentityChoice({rowId:row.rowId,id:candidate.id}) : update(row.rowId, { playerId: candidate.id, ...(candidate.id !== player?.id ? { role: null, registrationReviewed: false, checked: false } : {}) })}>
                  {candidate.name} · {candidate.alliance || 'Alliance unknown'} · ID {candidate.playerId || candidate.id}
                  {candidate.id === (filter === 'review' ? selectedIdentity ?? player?.id : player?.id) && <span aria-hidden="true" style={{color:'#4ade80',marginInlineStart:8}}>✓</span>}
                  {avatarAssist && !query && avatarSuggestion?.rowId===row.rowId && avatarSuggestion.candidateId===candidate.id && <small> · Avatar similarity (advisory)</small>}
                </button>)}</>}
                {unusualPower && (filter !== "review" || stage === 5) && <p className="stage9-power-warning" role="alert">Unusually large change: {previousPower.toLocaleString()} → {power.toLocaleString()}. Check the screenshot and power units before confirming.</p>}
                {mode !== 'roles' && (filter !== "review" || stage === 5) && <label>Troop power for {title}<input inputMode="decimal" value={powerText} onChange={event => update(row.rowId, { power: event.target.value, checked: false, powerConfirmed: filter !== 'review' })}/></label>}
                {mode !== 'roles' && (filter !== "review" || stage === 5) && row.powerConflict?.length > 1 && <div className="ocr-power-choices" aria-label="Competing troop powers">
                  {row.powerConflict.map(value => <button type="button" key={value} aria-pressed={powerText === String(value)}
                    onClick={() => update(row.rowId, { power: String(value), checked: false, powerConfirmed: filter !== 'review' })}>{value.toLocaleString()}</button>)}
                </div>}

                {mode !== 'powers' && (filter !== "review" || stage === 6) && <>
                  <div className="stage9-registration-comparison"><div><small>Detected in screenshot</small><strong>{row.registration==='other-legion'&&row.otherLegion?'Legion '+row.otherLegion+' · Other legion':roles[row.registration]||'Unknown'}</strong></div><div><small>Existing registration</small><strong>{current.length ? current.map(assignmentLabel).join(' / ') : roleName(here || '')}</strong></div></div>
                  <label><span aria-hidden="true">Proposed registration</span>
                    <select aria-label={"Registration for "+title} value={edit.role ?? ''} onChange={event => update(row.rowId, { role: event.target.value, registrationReviewed: filter !== 'review' })}>
                      <option value="">Keep existing</option><option value="join">Legion {legion} combatant</option>
                      <option value="sub">Legion {legion} substitute</option>
                      {here && <option value="remove">Remove Legion {legion} registration</option>}
                    </select>
                  </label>
                  {filter !== 'review' && <button type="button" onClick={() => update(row.rowId, { role: null, registrationReviewed: true })}>Keep existing registration</button>}
                </>}
                {conflict && (filter !== "review" || stage !== 4) && <label><input type="checkbox" checked={!!edit.checked} onChange={event => update(row.rowId, { checked: event.target.checked })}/> I checked the conflicting evidence for this player.</label>}
              </>}

            </div>
          </details>;
        })}
      </fieldset>
      <details className="stage9-review-options"><summary>Review options</summary><label>Import mode
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
      {filter === 'review' && focused && exceptions.length > 0 && <button type="button" onClick={prepare}>Review {modeLabels[mode]} changes</button>}
      {filter === 'review' && focused && <nav className="stage9-queue" aria-label="Exception navigation"><button type="button" disabled={working} onClick={() => { const i=evaluated.indexOf(focused); setFilter('all'); setFocusedId(evaluated[Math.max(0,i-1)].row.rowId); }}>Review earlier readings</button><button type="button" disabled={working} onClick={() => { const next=exceptions.find(item=>item.row.rowId!==focused.row.rowId); if(next)setFocusedId(next.row.rowId); }}>Next exception</button></nav>}
      </details>

      <div className="stage9-action-footer">{filter === 'review' && focused && exceptions.length > 0 && <div className="stage9-footer-meta"><span role="status">{exceptions.length} remaining</span><button type="button" className="stage9-skip-action" disabled={working} onClick={()=>update(focused.row.rowId,{skip:true})}>Skip this reading</button></div>}{filter === 'review' && focused && exceptions.length > 0 ? <><button type="button" className="screenshot-primary" style={stage===4&&selectedIdentity!=null?{background:"#16834a",color:"#fff"}:undefined} disabled={working || (stage===4 ? !selectedIdentity : stage===5 ? focused.power===null || focused.conflict && !focused.edit.checked : focused.conflict && !focused.edit.checked)} onClick={()=>{
        if(stage===4){update(focused.row.rowId,{playerId:selectedIdentity,role:null,registrationReviewed:false,checked:false});setIdentityChoice(null);}
        else if(stage===5)update(focused.row.rowId,{powerConfirmed:true,powerApproval:{previous:focused.previousPower,next:focused.power}});
        else update(focused.row.rowId,{registrationReviewed:true});
      }}>{stage===4?'Confirm match':stage===5?'Confirm troop power':focused.edit.role?'Confirm registration':'Keep existing registration'}</button></> : <button type="button" className="screenshot-primary" onClick={prepare}>Review {modeLabels[mode]} changes</button>}</div>
      {status && <p role="alert">{status}</p>}
      <button type="button" disabled={working} onClick={onClose}>Back to screenshots</button>
    </>}
  </section>;
}
