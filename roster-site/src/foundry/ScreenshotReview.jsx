import { useEffect, useMemo, useState } from 'react';
import { normaliseBulkName } from '../components/bulkImportModel.js';
import { eventAssignments, plannerSlot, EVENT_LIMITS } from '../../../src/services/eventPlanner.js';
import { readScreenshotPower } from './rosterScreenshotModel.js';
import { assignmentLabel, proposeScreenshotRegistration, prepareScreenshotImport, roleName, createScreenshotMatcher, suspiciousPowerChange } from './screenshotImportPlan.js';

import {createCurrentAvatarEvidence} from './currentAvatarEvidence.js';
import {screenshotAvatarEvidence} from './screenshotAvatarEvidence.js';
import {reviewAvatarSuggestions} from './reviewAvatarSuggestions.js';

const roles = { combatant: 'Combatant', substitute: 'Substitute', unassigned: 'Unassigned', 'other-legion': 'Other legion', unknown: 'Unknown' };
const modeLabels = { powers: 'troop powers', roles: 'registrations', both: 'troop powers and registrations' };

export function ScreenshotReview({ context, rows, sources, players, preferredIds, storage, counts, onClose, onSave, Evidence, PreloadEvidence, initialMode = 'powers', powerOnly = false, initialEdits = {}, onDraftChange, onContinueTeams, avatarAssist = false, onRetryUsername, onRememberOcrAlias }) {
  const [mode, setMode] = useState(powerOnly ? 'powers' : initialMode);
  const [edits, setEdits] = useState(initialEdits);
  const [filter, setFilter] = useState('all');
  const [preview, setPreview] = useState(null);
  const [working, setWorking] = useState(false);
  const [pendingSave,setPendingSave]=useState(false);
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editMatched,setEditMatched] = useState(false);
  const [aliasError,setAliasError]=useState(null);
  const [retrying,setRetrying]=useState(null);
  async function retryUsername(row){
    if(retrying)return;
    const evidence=row.evidence?.[0];if(!evidence)return;
    setRetrying(row.rowId);
    try{
      const name=await onRetryUsername(sources[evidence.sourceIndex]?.file,evidence.bounds);
      update(row.rowId,{retryNote:name?{name}:{message:'No additional username found.'}});
    }catch{update(row.rowId,{retryNote:{message:'Could not reread username. Search the roster manually.'}});}
    finally{setRetrying(null);}
  }
  const { alliance, legion, kind } = context;
  const target = plannerSlot(storage, kind, alliance, legion);
  const projected = { ...target.registrations };
  for (const change of preview?.action.roleChanges ?? []) projected[change.id] = change.role;
  const capacity = EVENT_LIMITS[kind];
  const assignments = useMemo(() => eventAssignments(storage, kind), [storage, kind]);
  const registeredIds=useMemo(()=>Object.keys(target.registrations).filter(id=>['join','sub'].includes(target.registrations[id])),[target.registrations]);
  const matcher=useMemo(()=>createScreenshotMatcher(players,alliance,preferredIds,registeredIds),[players,alliance,preferredIds,registeredIds]);
  const matches=useMemo(()=>rows.map(row=>{
    const original=matcher(row.name,{fid:row.fid,source:row.source});
    const names=[...new Set([...(row.nameAlternatives??[]),edits[row.rowId]?.retryNote?.name].filter(Boolean))];
    if(original.player || !names.length) return original;
    const alternatives=names.map(name=>matcher(name));
    const exactAlternatives=alternatives.flatMap(match=>match.player?[match.player]:[]);
    const candidates=[...new Map([...exactAlternatives,...original.candidates,...alternatives.flatMap(match=>match.candidates)].map(p=>[p.id,p])).values()].slice(0,8);
    return {...original,candidates,suggested:null};
  }),[rows,matcher,edits]);
  const playerById = useMemo(() => new Map(players.map(player => [player.id, player])), [players]);
  const evaluated = useMemo(()=>rows.map((row, index) => {
    const edit = edits[row.rowId] ?? {};
    const match = matches[index];
    const player = edit.playerId === undefined ? match.player : playerById.get(edit.playerId);
    const powerConflict = row.powerConflict?.length > 1;
    const powerText = edit.keepPower ? '' : edit.power ?? (powerConflict ? '' : String(row.power ?? ''));
    const power = powerText.trim() ? readScreenshotPower(powerText) : null;
    const conflict = row.conflict || mode !== 'roles' && powerConflict;
    const previousPower = target.powerByPlayer?.[player?.id] ?? (player?.hasPower ? player.power : null);
    const unusualPower = mode !== 'roles' && suspiciousPowerChange(previousPower,power);
    const powerPending = mode !== 'roles' && !edit.keepPower && (edit.power !== undefined && !edit.powerConfirmed || unusualPower && (edit.powerApproval?.previous !== previousPower || edit.powerApproval?.next !== power));
    const here=target.registrations[player?.id];
    const elsewhere=(assignments.get(player?.id)??[]).some(a=>a.alliance!==alliance||a.legion!==legion);
    const {proposedRole,registrationPending}=proposeScreenshotRegistration({row,player,here,elsewhere,alliance,edit,mode});
    const needsReview = powerPending || !player || conflict && !edit.checked || mode !== 'roles' && power === null && !edit.keepPower || registrationPending;
    return { row, edit, match, player, powerText, power, conflict, needsReview, powerPending, previousPower, unusualPower, registrationPending, proposedRole };
  }),[rows,edits,matches,playerById,target.powerByPlayer,target.registrations,mode,assignments,alliance,legion]);
  useEffect(() => { onDraftChange?.({ mode, edits }); }, [mode, edits]);
  const active = evaluated.filter(item => !item.edit.skip);
  const confirmed = active.filter(item => item.player);
  const destinations = new Map();
  const fidCounts = new Map();
  for (const {player,row} of active) {
    if (player) destinations.set(player.id, (destinations.get(player.id) ?? 0) + 1);
    if (row.fid) fidCounts.set(row.fid, (fidCounts.get(row.fid) ?? 0) + 1);
  }
  const duplicate = ({player,row}) => destinations.get(player?.id) > 1 || fidCounts.get(row.fid) > 1;
  const exceptions = active.filter(item => item.needsReview || duplicate(item));
  const visible = filter === 'all' ? evaluated : exceptions;
  const upcomingFiles = [...new Set(exceptions.slice(0,3).flatMap(item => item.row.evidence.slice(0,1).map(e => sources[e.sourceIndex]?.file)).filter(Boolean))];
  const avatarCache = useMemo(()=>createCurrentAvatarEvidence(),[]);
  const [avatarSuggestion,setAvatarSuggestion]=useState(null);
  useEffect(()=>()=>avatarCache.clear(),[avatarCache]);
  const avatarItem = evaluated.find(item => item.row.rowId === openId) ?? exceptions[0];
  const avatarRow=avatarItem?.row;
  const avatarCandidates=avatarItem?.match.candidates;
  const avatarSearch=avatarItem?.edit.search;
  useEffect(()=>{
    setAvatarSuggestion(null);
    if(!avatarAssist||preview||done||avatarItem?.player||avatarSearch||!avatarRow||!avatarCandidates?.length)return;
    const controller=new AbortController();
    const evidence=avatarRow.evidence?.[0];
    if(!evidence)return;
    (async()=>{
      const fingerprint=await screenshotAvatarEvidence(sources[evidence.sourceIndex]?.file,evidence.bounds);
      const result=await reviewAvatarSuggestions({fingerprint,candidates:avatarCandidates,referenceCache:avatarCache,signal:controller.signal});
      if(!controller.signal.aborted&&result)setAvatarSuggestion({rowId:avatarRow.rowId,...result});
    })().catch(()=>{});
    return ()=>controller.abort();
  },[avatarAssist,preview,done,avatarItem?.player,avatarRow,avatarCandidates,avatarSearch,sources,avatarCache]);
  const update = (id, patch) => {
    setEdits(previous => ({ ...previous, [id]: { ...previous[id], ...patch } }));
    setPreview(null);
  };
  useEffect(() => { if(!working&&!pendingSave&&!done)setPreview(null); }, [storage]);

  function prepare() {
    if (exceptions.length || active.some(item => !item.player || item.conflict && !item.edit.checked ||
      mode !== 'roles' && (item.powerText.trim() ? item.power === null : !item.edit.keepPower && (mode === 'powers' || item.row.powerConflict?.length > 1)))) {
      setStatus('Resolve or skip each unmatched or conflicting reading and check the troop powers.');
      return;
    }
    const result = prepareScreenshotImport(storage, context, confirmed.map(({ player, power, edit, proposedRole }) => ({
      id: player.id, name: player.name, alliance: player.alliance, power,
      previousPower: player.hasPower ? player.power : null, powerApproval: edit.powerApproval,
      role: proposedRole,
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

  async function confirmIdentity(row, edit, id) {
    if (edit.remember && onRememberOcrAlias) {
      setWorking(true);
      setAliasError(null);
      try {
        const result=await onRememberOcrAlias(id,row.name);
        if(!result?.verified) throw Error(result?.error || 'Spelling save could not be verified.');
      } catch(error) {
        setAliasError({id:row.rowId,message:error.message});
        return;
      } finally { setWorking(false); }
    }
    update(row.rowId,{playerId:id,choice:null,search:'',remember:false,role:null,registrationReviewed:false,checked:false,powerApproval:null,powerConfirmed:false,keepPower:false});
    setEditing(false);
  }

  const stageHeading=done?'Roster updated':preview?'Review changes':'Review imported players';
  return <section className="ocr-review" aria-label="Review imported players">
    {PreloadEvidence && !done && !preview && <PreloadEvidence files={upcomingFiles}/>}
    <h3 className="stage9-page-title">{stageHeading}</h3>
    { done ? <div className="stage9-completion"><div className="stage9-completion-mark" aria-hidden="true">✓</div><h4>Import complete</h4><p role="status">{status}</p><div className="stage9-summary-grid"><div><strong>{receipt?.powers ?? 0}</strong><span>Troop power updates</span></div><div><strong>{receipt?.roles ?? 0}</strong><span>Registration updates</span></div></div><p>{receipt?.excluded ?? 0} readings excluded. Registrations outside the submitted changes were not included in this import.</p><div className="stage9-action-footer">{onContinueTeams && <button type="button" className="screenshot-primary" onClick={onContinueTeams}>Continue to Teams</button>}<button type="button" className={!onContinueTeams?"screenshot-primary":undefined} onClick={onClose}>Done</button></div></div> : preview ? <>
      <section aria-label="Confirm roster import">
        <h4>Import totals</h4>
        <div className="stage9-summary-grid stage9-confirmation-totals"><div><strong>{preview.action.powers.length}</strong><span>Power updates</span></div><div><strong>{preview.action.roleChanges?.length ?? 0}</strong><span>Registration changes</span></div><div><strong>{evaluated.length-active.length}</strong><span>Excluded readings</span></div></div><h4>Projected legion capacity</h4>
        <div className="stage9-summary-grid">
          {['join','sub'].map(role => <div key={role}><span>{roleName(role)}</span><strong>{Object.values(projected).filter(value=>value===role).length} / {capacity[role]}</strong><span>After import</span></div>)}
        </div>
        <p>Registration capacity is validated before saving. Existing registrations outside these changes are preserved.</p><h4>Player changes</h4>
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
      <p className="stage9-review-counts" role="status">{rows.length} imported · {destinations.size} matched · {exceptions.length} {exceptions.length===1?'needs':'need'} review{evaluated.length > active.length ? ' · '+(evaluated.length-active.length)+' skipped' : ''}</p>
      <div className="compact-methods" role="group" aria-label="Filter readings">
        <button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All</button>
        <button type="button" aria-pressed={filter==='review'} onClick={()=>setFilter('review')}>Needs review</button>
      </div>
      <fieldset className="compact-review-list" disabled={working} aria-label="Imported players">
        {visible.map(item => {
          const { row, edit, match, player, powerText, power, powerPending, previousPower, unusualPower, conflict, needsReview, registrationPending, proposedRole } = item;
          const title = row.name || 'Unread player name';
          const requiresReview = needsReview || duplicate(item);
          const showFields = !edit.skip && openId === row.rowId && (requiresReview || editing);
          const changing = showFields && editing;
          const actionable = edit.skip || requiresReview || editMatched || showFields;
          const Summary = actionable ? 'button' : 'div';
          const label = edit.skip ? 'Restore' : showFields ? 'Close details for' : requiresReview ? 'Review' : 'Edit';
          const toggle = event => {
            if (edit.skip) { update(row.rowId,{skip:false}); return; }
            setEditing(!requiresReview && !showFields);
            setOpenId(showFields ? null : row.rowId);
            const button = event.currentTarget;
            if (!showFields) requestAnimationFrame(()=>button.scrollIntoView({block:'nearest'}));
          };
          const query = String(edit.search ?? '').trim().toLocaleLowerCase();
          const normalized = normaliseBulkName(query);
          const candidates = query ? players.filter(candidate =>
            [candidate.name, candidate.playerId, candidate.id, ...(candidate.searchFields ?? [])].some(value =>
              String(value ?? '').toLocaleLowerCase().includes(query) ||
              normalized && normaliseBulkName(value).includes(normalized))).slice(0,8) : match.candidates;
          const choice = edit.choice ?? (!query && !player ? match.suggested?.id : null);
          const here = target.registrations[player?.id];
          const current = assignments.get(player?.id) ?? [];
          return <article key={row.rowId} data-imported-name={title} className={showFields?'compact-review-item is-expanded':'compact-review-item'}>
            <Summary className="compact-review-row" {...(actionable ? {
              type:'button', 'aria-label':label+' '+title,
              'aria-expanded':edit.skip ? undefined : showFields, 'aria-describedby':'reading-power-'+row.rowId, onClick:toggle,
            } : {})}>
              <span aria-label={edit.skip?'Skipped':requiresReview?'Needs review':'Matched'} className={requiresReview?'compact-review-warning':'compact-review-check'}>{edit.skip?'↷':requiresReview?'!':'✓'}</span>
              <strong title={player?.name || title}>{player?.name || title}</strong>
              <span id={'reading-power-'+row.rowId} className="compact-review-power">{power?.toLocaleString() ?? '—'}</span>
              {actionable && <span className="compact-review-chevron" aria-hidden="true">{edit.skip?'Restore':showFields?'⌃':'›'}</span>}
            </Summary>
            {showFields && <div className="ocr-reading-fields">
              {player && player.name !== title && <p>Imported name: <strong>{title}</strong></p>}
              {match.idConflict && <p role="alert">Check player ID {row.fid} against the imported username before selecting a player.</p>}
              {duplicate(item) && <p role="alert">This player or player ID appears more than once. Keep one reading or correct the match.</p>}
              {row.evidence.map(({ sourceIndex, bounds }) => <details key={sourceIndex+':'+bounds?.top}>
                <summary>Screenshot evidence</summary><Evidence file={sources[sourceIndex].file} bounds={bounds}/>
              </details>)}
              {row.otherLegion > 0 && <p>Dispatched to Legion {row.otherLegion}</p>}
              {(row.voted || row.battleRequest) && <p>{[row.voted && 'Voted', row.battleRequest && 'Battle Request'].filter(Boolean).join(' · ')}</p>}
              {(!player || changing) ? <>
                {row.nameAlternatives?.length > 0 && <p>Alternative OCR readings: {row.nameAlternatives.join(' · ')}</p>}
                {onRetryUsername && !player && row.evidence.length > 0 && <button type="button" disabled={!!retrying} onClick={()=>retryUsername(row)}>{retrying===row.rowId?'Rereading username…':'Reread username'}</button>}
                {edit.retryNote && <p role="status">{edit.retryNote.name?'Additional reading: '+edit.retryNote.name:edit.retryNote.message}</p>}
                <label>Search roster for {title}<input type="search" value={edit.search ?? ''} onChange={event=>update(row.rowId,{search:event.target.value,choice:null,remember:false})}/></label>
                {candidates.map(candidate => <button key={candidate.id} type="button" className="stage9-candidate-card" aria-pressed={candidate.id === choice}
                  onClick={()=>update(row.rowId,{choice:candidate.id,remember:false})}>
                  <span className="stage9-candidate-identity"><strong>{candidate.name}</strong><small>{candidate.alliance || 'Alliance unknown'} · ID {candidate.playerId || candidate.id}{candidate.furnaceLevel ? ' · '+candidate.furnaceLevel : ''}</small></span>
                  {avatarAssist && !query && avatarSuggestion?.rowId===row.rowId && avatarSuggestion?.candidateId===candidate.id && <small>Avatar similarity</small>}
                </button>)}
                {choice && onRememberOcrAlias && row.name?.trim() && <label><input type="checkbox" checked={!!edit.remember} onChange={event=>update(row.rowId,{remember:event.target.checked})}/> Remember this spelling for future imports</label>}
                {aliasError?.id === row.rowId && <p role="alert">{aliasError.message}</p>}
                <button type="button" disabled={!choice} onClick={()=>confirmIdentity(row,edit,choice)}>Confirm match</button>
              </> : <button type="button" onClick={()=>setEditing(true)}>Change match</button>}
              {player && mode !== 'roles' && (powerPending || conflict || power === null || changing) && <>
                <div className="stage9-registration-comparison"><div><small>Existing troop power</small><strong>{previousPower?.toLocaleString() ?? 'Not recorded'}</strong></div><div><small>Proposed troop power</small><strong>{power?.toLocaleString() ?? 'Unreadable'}</strong></div></div>
                {unusualPower && <p className="stage9-power-warning" role="alert">Unusually large change: {previousPower.toLocaleString()} → {power.toLocaleString()}. Check the troop power units.</p>}
                <label>Troop power for {title}<input inputMode="decimal" value={powerText} onChange={event=>update(row.rowId,{power:event.target.value,keepPower:false,powerConfirmed:false})}/></label>
                {row.powerConflict?.length > 1 && <div className="ocr-power-choices" aria-label="Competing troop powers">
                  {row.powerConflict.map(value=><button type="button" key={value} aria-pressed={powerText===String(value)} onClick={()=>update(row.rowId,{power:String(value),keepPower:false,powerConfirmed:false})}>{value.toLocaleString()}</button>)}
                </div>}
                <button type="button" disabled={power===null} onClick={()=>{update(row.rowId,{powerConfirmed:true,powerApproval:{previous:previousPower,next:power}});setEditing(false);}}>Confirm troop power</button>
                {row.source==='paste' && <button type="button" onClick={()=>{update(row.rowId,{keepPower:true});setEditing(false);}}>Keep existing troop power</button>}
              </>}
              {player && mode !== 'powers' && (registrationPending || changing) && <>
                <div className="stage9-registration-comparison"><div><small>Imported registration</small><strong>{roles[row.registration] || 'Unknown'}</strong></div><div><small>Existing registration</small><strong>{current.length ? current.map(assignmentLabel).join(' / ') : roleName(here || '')}</strong></div></div>
                <select aria-label={'Registration for '+title} value={edit.role ?? proposedRole ?? ''} onChange={event=>update(row.rowId,{role:event.target.value,registrationReviewed:false})}>
                  <option value="">Keep existing</option><option value="join">Legion {legion} combatant</option>
                  <option value="sub">Legion {legion} substitute</option>
                  {here && <option value="remove">Remove Legion {legion} registration</option>}
                </select>
                <button type="button" onClick={()=>{update(row.rowId,{role:edit.role ?? '',registrationReviewed:true});setEditing(false);}}>{edit.role?'Confirm registration':'Keep existing registration'}</button>
              </>}
              {conflict && <label><input type="checkbox" checked={!!edit.checked} onChange={event=>update(row.rowId,{checked:event.target.checked})}/> I checked the conflicting evidence for this player.</label>}
              <button type="button" onClick={()=>{update(row.rowId,{skip:true});setOpenId(null);}}>Skip this reading</button>

            </div>}
          </article>;
        })}
      </fieldset>
      {filter==='review' && !exceptions.length && <p>All readings are ready.</p>}
      <details className="stage9-review-options"><summary>Review options</summary><label>Import mode
        <select value={mode} disabled={working || powerOnly} onChange={event=>{setMode(event.target.value);setPreview(null);}}>
          <option value="powers">Troop powers only</option>
          <option value="roles">Registrations only</option>
          <option value="both">Troop powers and registrations</option>
        </select>
      </label>
      <label><input type="checkbox" checked={editMatched} onChange={event=>setEditMatched(event.target.checked)}/> Show edit controls for matched players</label>
      {counts.length>0 && <details><summary>Registration totals and coverage</summary>
        {counts.map(count=><p key={count.role}>{roles[count.role]} · Game {count.conflict?'totals conflict':count.expected??'unreadable'} · OCR {count.detected} · Matched {new Set(confirmed.filter(item=>item.row.registration===count.role&&(!item.conflict||item.edit.checked)).map(item=>item.player.id)).size}</p>)}
      </details>}
      </details>
      {status && <p role="alert">{status}</p>}
      <div className="stage9-action-footer">
        <button type="button" className="screenshot-primary" disabled={working || !active.length || !!exceptions.length} onClick={prepare}>Review {modeLabels[mode]} changes</button>
        <button type="button" disabled={working} onClick={onClose}>Back to import</button>
      </div>
    </>}
  </section>;
}
