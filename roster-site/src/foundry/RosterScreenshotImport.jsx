import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { readScreenshotSession, writeScreenshotSession } from './screenshotSession.js';
import { parseRosterPaste, buildExtractionPrompt, defaultExtractionInstructions, rosterPasteHeader } from './parseRosterPaste.js';
import { ScreenshotReview } from './ScreenshotReview.jsx';
import './rosterScreenshot.css';

function restorePaste(session, kind, alliance) {
  if (!session?.paste?.rows?.length || session.pasteGroups?.length) return session;
  const { rows, legion } = session.paste;
  const rawRows = rows.map(row => [
    row.name, row.power, row.legion ?? legion,
    row.registration === 'unknown' ? '' : row.registration,
    row.fid,
  ].join('\t'));
  return {
    ...session,
    pasteText: session.pasteText ?? [rosterPasteHeader + '\tPlayer ID', ...rawRows].join('\n'),
    pasteGroups: [{ legion, rows, context: { kind, alliance, legion, expectedOccurrenceId: session.occurrenceIds?.[legion] } }],
    pasteDrafts: session.pasteDrafts ?? session.drafts,
  };
}

export function RosterScreenshotImport({ kind, title, alliance, activeLegion, storage, players, preferredIds, occurrenceIds, onSave, onRememberOcrAlias, children, onContinueTeams, extractionInstructions, onSaveExtractionInstructions }) {
  const sessionKey = kind + ':' + alliance;
  const [session, setSession] = useState(null);
  const latest = useRef(null);
  const eventIds = useRef(occurrenceIds);
  eventIds.current = occurrenceIds;
  const [loading, setLoading] = useState(true);
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [review, setReview] = useState(null);
  const [pasteErrors, setPasteErrors] = useState([]);
  const [promptDraft, setPromptDraft] = useState(null);
  const [promptSaving, setPromptSaving] = useState(false);
  const prompt = buildExtractionPrompt(extractionInstructions);
  async function savePrompt(value) {
    setPromptSaving(true);
    try {
      const result = await onSaveExtractionInstructions(value);
      if (!result || result.error) throw Error(result?.error || 'Could not save instructions.');
      setPromptDraft(null);
      setPasteStatus('Instructions saved on this device. Shared workspace sync will update other devices.');
    } catch (error) { setPasteStatus(error.message || 'Could not save instructions.'); }
    finally { setPromptSaving(false); }
  }
  const [pasteStatus, setPasteStatus] = useState('');
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [powerOnly,setPowerOnly]=useState(false);
  const workspaceRef = useRef(null);
  const launchRef = useRef(null);
  const mounted = useRef(false);
  const writes = useRef(Promise.resolve());
  const saving = useRef(false);
  const [checkingPending, setCheckingPending] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');

  useEffect(() => {
    mounted.current = true;
    let active = true;
    readScreenshotSession(sessionKey).then(value => {
      if (!active) return;
      latest.current = restorePaste(value, kind, alliance) ?? null;
      setSession(latest.current);
    }).catch(() => {
      if (!active) return;
      setRecoveryFailed(true);
      setRecoveryError('Could not read saved imports on this device. Reload before importing.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [sessionKey, kind, alliance]);

  useEffect(() => {
    if (!workspaceOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    workspaceRef.current?.focus();
    const trap = event => {
      if (event.key !== 'Tab') return;
      const controls = [...(workspaceRef.current?.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled):not([hidden]),textarea:not(:disabled),summary,[tabindex="0"]') ?? [])].filter(node => node.getClientRects().length);
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0];
      const last = controls.at(-1);
      if (!workspaceRef.current.contains(document.activeElement) || document.activeElement === workspaceRef.current || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      document.body.style.overflow = previous;
      launchRef.current?.focus();
    };
  }, [workspaceOpen]);

  function checkpoint(next) {
    latest.current = next;
    if (mounted.current) setSession(next);
    writes.current = writes.current.catch(() => {}).then(() => writeScreenshotSession(sessionKey, next));
    writes.current.catch(() => {
      if (mounted.current) setRecoveryError('Could not store this import on this device. Keep this tab open to continue.');
    });
    return writes.current;
  }

  async function returnToReview() {
    if (saving.current || !latest.current?.pendingImport) return;
    if (!window.confirm('Stop checking this save? It may already have been applied. Review the current roster before importing again. Your draft will be retained.')) return;
    const previous = latest.current;
    saving.current = true;
    setCheckingPending(true);
    try {
      await checkpoint({ ...previous, pendingImport: null });
      setPendingStatus('Previous save status is unknown. Check current roster values before importing again.');
    } catch {
      latest.current = previous;
      if (mounted.current) setSession(previous);
      setPendingStatus('Could not update the saved import receipt.');
    } finally {
      saving.current = false;
      setCheckingPending(false);
    }
  }

  async function checkPending() {
    const pending = latest.current?.pendingImport;
    if (saving.current || !pending) return;
    setCheckingPending(true);
    try {
      const result = await saveOnce(pending);
      setPendingStatus(result?.error || result?.message || 'Shared confirmation unavailable.');
    } catch {
      setPendingStatus('Could not verify the shared save. Check again later.');
    } finally {
      setCheckingPending(false);
    }
  }

  async function saveOnce(action) {
    if(powerOnly && action.roleChanges?.length) return {error:'Power-only imports cannot change registration.'};
    const previous = latest.current;
    const pending = previous?.pendingImport;
    if (pending && JSON.stringify(pending) !== JSON.stringify(action)) return { error: 'A previous import is awaiting verification. Check its save status first.', pending: true };
    if (saving.current) return { error: 'An import is already being saved.' };
    if (!pending && action.expectedOccurrenceId !== eventIds.current[action.legion]) return { error: 'The event changed. Match the list for the current event before importing.' };
    const ids = [...new Set([...action.powers, ...(action.roleChanges ?? [])].map(row => row.id))];
    const savedField = pending && previous.pendingImportMethod !== 'paste' ? 'savedIds' : 'pastedSavedIds';
    if (!pending && ids.some(id => previous?.[savedField]?.includes(id))) return { error: 'A selected player was already imported from this batch. Skip the duplicate reading.' };

    saving.current = true;
    try {
      if (!pending) {
        try {
          await checkpoint({ ...previous, pendingImport: action, pendingImportMethod: 'paste' });
        } catch {
          latest.current = previous;
          if (mounted.current) setSession(previous);
          return { error: 'Could not store the import receipt. The save was not submitted.' };
        }
      }

      let result;
      try {
        result = await onSave(action, { verifyOnly: !!pending });
      } catch {
        return { error: 'Shared confirmation is pending. Check save status before importing again.', pending: true };
      }
      if (result?.error && (pending || result.pending)) return { ...result, pending: true };
      if (result?.error || result?.message) {
        const next = { ...latest.current, pendingImport: null };
        if (!result.error) next[savedField] = [...new Set([...(next[savedField] ?? []), ...ids])];
        const receipt = latest.current;
        try {
          await checkpoint(next);
        } catch {
          latest.current = receipt;
          if (mounted.current) setSession(receipt);
          return { error: 'Could not update the saved import receipt. Check save status before importing again.', pending: true };
        }
        return result;
      }
      return { error: 'Shared confirmation is pending. Check save status before importing again.', pending: true };
    } finally {
      saving.current = false;
    }
  }

  const paste = session?.pasteText ?? '';
  const groups = session?.pasteGroups ?? [];
  const stale = groups.some(group => group.context?.expectedOccurrenceId !== occurrenceIds[group.legion]);
  const draft = review && session?.pasteDrafts?.[review.legion];

  function reviewPaste() {
    const { rows, errors } = parseRosterPaste(paste, activeLegion);
    setPasteErrors(errors);
    setPasteStatus(!rows.length && !errors.length ? 'Paste at least one player row.' : '');
    if (errors.length || !rows.length) return;
    const byLegion = [activeLegion, activeLegion === 1 ? 2 : 1].map(legion => ({
      legion,
      rows: rows.filter(row => row.legion === legion),
      context: { kind, alliance, legion, expectedOccurrenceId: eventIds.current[legion] },
    })).filter(group => group.rows.length);
    checkpoint({ ...latest.current, paste: null, pasteGroups: byLegion, pasteDrafts: {}, pastedSavedIds: [] });
    if (byLegion.length === 1) setReview(byLegion[0]);
  }

  function closeWorkspace() {
    setReview(null);
    setWorkspaceOpen(false);
  }

  return <section className="screenshot-import" aria-label="Roster import">
    <button ref={launchRef} type="button" className="screenshot-primary" onClick={() => {setPowerOnly(false);setWorkspaceOpen(true)}}>Import roster</button>
    <button type="button" onClick={()=>{setPowerOnly(true);setWorkspaceOpen(true)}}>Paste troop power only</button>
    {workspaceOpen && createPortal(<section ref={workspaceRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Roster import workspace" className="stage9-import-workspace">
      <header className="stage9-import-header"><div><small>{title} · {alliance} · Legion {review?.legion ?? activeLegion}</small><h2>{powerOnly?'Import troop power':'Import roster'}</h2></div><button type="button" disabled={checkingPending} onClick={closeWorkspace}>Close</button></header>
      <div className="stage9-import-content">
        {loading && <p role="status">Restoring saved imports…</p>}
        {session?.pendingImport && !review ? <div className="stage9-summary">
          <h3 className="stage9-page-title">Awaiting confirmation</h3>
          <p>Check the shared save before submitting another import.</p>
          <p>{title} · {alliance} · Legion {session.pendingImport.legion}</p>
          <p role="status">{pendingStatus}</p>
          <div className="stage9-action-footer">
            <button type="button" className="screenshot-primary" disabled={checkingPending || saving.current} onClick={checkPending}>{checkingPending ? 'Checking shared save…' : 'Check save status'}</button>
            <button type="button" disabled={checkingPending || saving.current} onClick={returnToReview}>Return to review</button>
          </div>
        </div> : !review && <section className="compact-paste">
          <label>Player list<textarea rows={6} value={paste} placeholder={rosterPasteHeader} disabled={loading || recoveryFailed || saving.current} onChange={event => {
            checkpoint({ ...latest.current, paste: null, pasteText: event.target.value, pasteGroups: null, pasteDrafts: {}, pastedSavedIds: [] });
            setPasteErrors([]);
            setPasteStatus('');
          }}/></label>
          <p>Use tabs, commas, pipes, or one username and troop power per line. Rows without a legion use Legion {activeLegion}.</p>
          <details><summary>Extract a list with AI</summary>
            <textarea readOnly rows={6} aria-label="AI extraction prompt" value={prompt}/>
            <button type="button" onClick={async () => {
              try { await navigator.clipboard.writeText(prompt); setPasteStatus('Extraction prompt copied.'); }
              catch { setPasteStatus('Select the extraction prompt and copy it manually.'); }
            }}>Copy extraction prompt</button>
            {onSaveExtractionInstructions && (promptDraft === null ? <button type="button" onClick={() => setPromptDraft(extractionInstructions || defaultExtractionInstructions)}>Edit instructions</button> : <div><label>Custom extraction instructions<textarea rows={10} maxLength={12000} value={promptDraft} onChange={e => setPromptDraft(e.target.value)}/></label><p>The TSV header and output requirements are protected.</p><button type="button" disabled={promptSaving || !promptDraft.trim()} onClick={() => savePrompt(promptDraft.trim())}>Save prompt</button><button type="button" disabled={promptSaving} onClick={() => setPromptDraft(null)}>Cancel</button><button type="button" disabled={promptSaving} onClick={() => savePrompt(null)}>Reset to default</button></div>)}
          </details>
          {stale && <p role="alert">This draft is from a different event. Match the list again to review it for the current event.</p>}
          {pasteErrors.length > 0 && <ul role="alert">{pasteErrors.map(({ line, message }) => <li key={line}>Line {line}: {message}</li>)}</ul>}
          {pasteStatus && <p role="status">{pasteStatus}</p>}
          {!stale && groups.length > 0 ? groups.map(group => <button key={group.legion} type="button" className="screenshot-primary" onClick={() => setReview(group)}>
            Review Legion {group.legion} · {group.rows.length} readings
          </button>) : <button type="button" className="screenshot-primary" disabled={loading || recoveryFailed || saving.current || !paste.trim()} onClick={reviewPaste}>{stale ? 'Match list for current event' : 'Match players'}</button>}
        </section>}
        {recoveryError && <p role="alert">{recoveryError}</p>}
        {review && <ScreenshotReview key={String(powerOnly)+':'+review.legion} powerOnly={powerOnly} {...review} sources={[]} counts={[]} players={players} preferredIds={preferredIds} storage={storage} onSave={saveOnce} onRememberOcrAlias={onRememberOcrAlias}
          initialMode={draft?.mode ?? (review.rows.some(row => row.power !== null) ? review.rows.some(row => row.registration !== 'unknown') ? 'both' : 'powers' : 'roles')}
          initialEdits={draft?.edits}
          onDraftChange={next => {
            if (!latest.current || JSON.stringify(latest.current.pasteDrafts?.[review.legion]) === JSON.stringify(next)) return;
            checkpoint({ ...latest.current, pasteDrafts: { ...latest.current.pasteDrafts, [review.legion]: next } });
          }}
          onContinueTeams={review.legion === activeLegion && onContinueTeams ? () => { closeWorkspace(); onContinueTeams(); } : undefined}
          onClose={() => setReview(null)}/>}
        {!session?.pendingImport && pendingStatus && !review && <p role="status">{pendingStatus}</p>}
      </div>
    </section>, document.body)}
    {children}
  </section>;
}
