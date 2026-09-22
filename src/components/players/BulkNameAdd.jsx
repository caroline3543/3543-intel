import { useState, useRef } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newPlayer } from '../../data/playerSchema.js';
import { parseNames, findCloseMatches } from '../../utils/nameList.js';
import { parseCsvRows } from '../../services/batchAddService.js';

// Dedupes the pasted list case-insensitively (first occurrence wins)
// and separates out any name that already exists on the roster. See
// PlayerSheet.jsx for the single-add version of this same rule, which
// offers a one-tap link into the existing record — bulk add just skips
// duplicates automatically instead, since there's no single profile to
// link an entire pasted list into.
//
// Also flags NEAR-duplicates among what's left (closeMatches) — a
// likely typo of an existing player's name, e.g. "Jonh" vs "John".
// Unlike an exact match, these aren't auto-skipped — they might
// genuinely be a different person — just surfaced as a suggestion.
function classifyNames(raw, existingPlayers) {
  const seen = new Set();
  const existingLower = new Set(
    existingPlayers.map(p => (p.username || p.alias || '').trim().toLowerCase()).filter(Boolean)
  );
  const toAdd = [];
  const skipped = [];
  parseNames(raw).forEach(name => {
    const key = name.toLowerCase();
    if (seen.has(key) || existingLower.has(key)) { skipped.push(name); return; }
    seen.add(key);
    toAdd.push(name);
  });
  const closeMatches = toAdd
    .map(name => ({ name, matches: findCloseMatches(name, existingPlayers) }))
    .filter(({ matches }) => matches.length > 0);
  return { toAdd, skipped, closeMatches };
}

// Normalize a name for use as a fidIndex key — trims and collapses
// whitespace before lowercasing, so a CSV name stored here still
// matches after it round-trips through the raw textarea and back out
// via parseNames (utils/nameList.js — not available to confirm its
// exact behavior, so this only assumes it trims/normalizes
// whitespace, never that it changes the name's actual content).
function fidKey(name) {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// ── "Names + FC + ID" mode ──────────────────────────────────────
// A different shape of bulk operation from plain name-add above: each
// line already carries the two fields ("Name, FC Level, User ID")
// that make it useful to UPDATE an existing player's profile, not
// just create new ones. Reuses the same match/fuzzy/new resolution
// pattern already established for CSV import here and for
// AddParticipantPanel's troop-power paste — one line per row, FID
// checked first (authoritative), then exact name/nickname, then a
// fuzzy suggestion the officer has to confirm before it can submit.
function parseDetailLines(raw) {
  return (raw || '').split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.split(',').map(s => s.trim());
    return { name: parts[0] || '', fc: parts[1] || '', fid: parts[2] || '' };
  }).filter(r => r.name);
}

function resolveDetailRows(lines, pool, decisions) {
  return lines.map(row => {
    const byFid = row.fid ? pool.find(p => p.fid && String(p.fid).trim() === row.fid) : null;
    if (byFid) return { status: 'matched', ...row, player: byFid };

    const exact = pool.find(p =>
      (p.username || '').toLowerCase() === row.name.toLowerCase() ||
      (p.alias || '').toLowerCase() === row.name.toLowerCase()
    );
    if (exact) return { status: 'matched', ...row, player: exact };

    const decision = decisions[row.name];
    if (decision === 'new') return { status: 'new', ...row };
    if (decision) {
      const linked = pool.find(p => p.id === decision);
      if (linked) return { status: 'matched', ...row, player: linked };
    }

    const fuzzy = findCloseMatches(row.name, pool);
    if (fuzzy.length > 0) return { status: 'fuzzy', ...row, suggestion: fuzzy[0].player };
    return { status: 'new', ...row };
  });
}

// Replaces the old multi-step Batch Add wizard (Names → Review →
// Details). Details — languages, troop tiers, joiner heroes, roles —
// are now filled in afterward via Field Registry, which is faster for
// assigning one value to many people than the old per-member carousel.
// After adding, this screen offers a direct one-tap handoff into Field
// Registry rather than closing silently — that's almost always the
// very next thing you want to do with names you just bulk-added.
export default function BulkNameAdd({ onAddPlayers, onUpdatePlayers, onClose, showToast, onGoToFieldRegistry, existingPlayers = [] }) {
  const [mode, setMode] = useState('names'); // 'names' | 'details'
  const [raw, setRaw] = useState('');
  const [addedCount, setAddedCount] = useState(null); // null = still entering names
  // CSV/ID support — kept separate from `raw` so a player ID survives
  // the round trip through the plain-text name list below:
  //   fidIndex   — { [lowercasedName]: fid } for any name currently in
  //                `raw` that came from a CSV row with an ID attached
  //   fidSkipped — CSV rows whose ID already matched an existing
  //                player outright; that player's fid is already
  //                correct, so these never enter `raw` at all — shown
  //                separately as "already on roster."
  const [fidIndex, setFidIndex]     = useState({});
  const [fidSkipped, setFidSkipped] = useState([]);
  const csvInputRef = useRef(null);

  // "Names + FC + ID" mode state — entirely separate from the plain
  // name-add state above so switching modes never mixes the two
  // formats together.
  const [detailText, setDetailText] = useState('');
  const [detailDecisions, setDetailDecisions] = useState({});

  const { toAdd: names, skipped, closeMatches } = classifyNames(raw, existingPlayers);

  // A name/nickname EXACT match (already skipped as a duplicate by
  // classifyNames above) whose CSV row carried an ID that the existing
  // record doesn't have on file yet — the one case worth silently
  // backfilling on Add rather than just discarding: same person,
  // confirmed by an exact name match, ID just never got recorded.
  const pendingFidBackfills = skipped
    .map(name => {
      const fid = fidIndex[fidKey(name)];
      if (!fid) return null;
      const existing = existingPlayers.find(p => (p.username || p.alias || '').trim().toLowerCase() === name.toLowerCase());
      return (existing && !existing.fid) ? { ...existing, fid } : null;
    })
    .filter(Boolean);

  // "Remove from list" on a flagged close match — rebuilds the
  // textarea one name per line rather than trying to preserve the
  // original comma/newline mix, which isn't worth the complexity here.
  function removeNameFromRaw(nameToRemove) {
    const remaining = parseNames(raw).filter(n => n.toLowerCase() !== nameToRemove.toLowerCase());
    setRaw(remaining.join('\n'));
  }

  // A flagged near-duplicate that DID come with a CSV ID gets a second
  // option beyond "Remove from list": confirm it's the same person and
  // write that ID onto the existing record, rather than just dropping
  // the row and losing the ID entirely.
  function linkCloseMatchToExisting(name, existingPlayer) {
    const fid = fidIndex[fidKey(name)];
    removeNameFromRaw(name);
    if (fid && onUpdatePlayers) onUpdatePlayers([{ ...existingPlayer, fid }]);
    vibe(8);
  }

  // CSV upload — "ID, username" per line (header row optional, same
  // parser the old Batch Add sheet used). A row whose ID matches an
  // existing player is recognized as already-on-roster and never
  // re-added (fidSkipped). Everything else's username joins the same
  // textarea flow typed names use — the ID just rides along in
  // fidIndex so it can be attached wherever that name ends up: a new
  // player, or an exact-name match that had no ID recorded (see
  // pendingFidBackfills above).
  function handleCsvFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const rows = parseCsvRows(evt.target.result);
      const newIndex = {};
      const matched = [];
      const toAppend = [];
      rows.forEach(row => {
        if (!row.text) return;
        const existing = row.fid ? existingPlayers.find(p => p.fid && String(p.fid).trim() === String(row.fid).trim()) : null;
        if (existing) { matched.push({ name: row.text, fid: row.fid, existingPlayer: existing }); return; }
        toAppend.push(row.text);
        if (row.fid) newIndex[fidKey(row.text)] = row.fid;
      });
      setFidIndex(prev => ({ ...prev, ...newIndex }));
      setFidSkipped(prev => [...prev, ...matched]);
      if (toAppend.length) setRaw(prev => (prev ? prev + '\n' : '') + toAppend.join('\n'));
      vibe(8);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleAdd() {
    if (names.length === 0 && pendingFidBackfills.length === 0) return;
    if (pendingFidBackfills.length && onUpdatePlayers) onUpdatePlayers(pendingFidBackfills);

    if (names.length === 0) {
      showToast?.(`Matched ${pendingFidBackfills.length} existing player${pendingFidBackfills.length !== 1 ? 's' : ''} by ID`, 'success');
      vibe(10);
      onClose();
      return;
    }
    const players = names.map(name => newPlayer({
      username: name,
      ...(fidIndex[fidKey(name)] ? { fid: fidIndex[fidKey(name)] } : {}),
    }));
    onAddPlayers(players);
    const skippedNote = skipped.length ? ` · skipped ${skipped.length} duplicate${skipped.length !== 1 ? 's' : ''}` : '';
    showToast?.(`Added ${players.length} player${players.length !== 1 ? 's' : ''}${skippedNote}`, 'success');
    vibe(10);
    setAddedCount(players.length);
  }

  // "Names + FC + ID" — updates matched players' furnaceLevel/fid
  // directly (the whole point of this mode is correcting/setting
  // those fields from an authoritative list, so a provided value
  // overwrites rather than only filling a blank), creates the rest as
  // new players carrying the same fields. No interstitial success
  // screen here (that one's worded around brand-new names only) —
  // just a toast summarizing update vs. create counts, then close.
  function handleDetailSubmit() {
    const pool = existingPlayers;
    const lines = parseDetailLines(detailText);
    const resolved = resolveDetailRows(lines, pool, detailDecisions);
    const toUpdate = [];
    const toCreate = [];
    resolved.forEach(r => {
      if (r.status === 'matched') {
        toUpdate.push({
          ...r.player,
          ...(r.fc ? { furnaceLevel: r.fc } : {}),
          ...(r.fid ? { fid: r.fid } : {}),
        });
      } else if (r.status === 'new') {
        toCreate.push(newPlayer({
          username: r.name,
          ...(r.fc ? { furnaceLevel: r.fc } : {}),
          ...(r.fid ? { fid: r.fid } : {}),
        }));
      }
    });
    if (toUpdate.length && onUpdatePlayers) onUpdatePlayers(toUpdate);
    if (toCreate.length) onAddPlayers(toCreate);
    showToast?.(`Updated ${toUpdate.length}, added ${toCreate.length} new`, 'success');
    vibe(10);
    setDetailText('');
    setDetailDecisions({});
    onClose();
  }

  if (addedCount !== null) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,-apple-system,sans-serif', color: C.white }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Added {addedCount} player{addedCount !== 1 ? 's' : ''}</div>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 32, maxWidth: 320 }}>
            They have no languages, troop tiers, or joiner heroes set yet. Field Registry is the fastest way to fill those in for everyone.
          </div>
          <button
            onClick={() => onGoToFieldRegistry?.()}
            style={{ width: '100%', maxWidth: 320, height: 52, borderRadius: 12, background: C.gold, border: 'none', color: C.bg, fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 12 }}
          >
            📋 Assign Details Now
          </button>
          <button
            onClick={onClose}
            style={{ width: '100%', maxWidth: 320, height: 44, borderRadius: 12, background: 'none', border: `1px solid ${C.border}`, color: C.muted, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Resolved rows for detail mode — computed here (not just inside
  // handleDetailSubmit) since the render below needs them too, for
  // the per-row chips and the fuzzy-match decision buttons.
  const resolvedDetail = mode === 'details' ? resolveDetailRows(parseDetailLines(detailText), existingPlayers, detailDecisions) : [];
  const detailReadyCount = resolvedDetail.filter(r => r.status === 'matched' || r.status === 'new').length;
  const detailPendingCount = resolvedDetail.filter(r => r.status === 'fuzzy').length;
  function decideDetail(name, value) {
    setDetailDecisions(prev => ({ ...prev, [name]: value }));
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,-apple-system,sans-serif', color: C.white }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0 }}>← Back</button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>➕ Bulk Add</div>
            <div style={{ fontSize: 12, color: C.muted }}>{mode === 'names' ? 'Comma/newline separated, or upload a CSV' : 'Matches and updates existing players, adds the rest'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setMode('names')} style={{ flex: 1, height: 40, borderRadius: 10, background: mode==='names'?C.gold+'22':C.section, border: `1px solid ${mode==='names'?C.gold:C.border}`, color: mode==='names'?C.gold:C.muted, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>👤 Names only</button>
          <button onClick={() => setMode('details')} style={{ flex: 1, height: 40, borderRadius: 10, background: mode==='details'?C.gold+'22':C.section, border: `1px solid ${mode==='details'?C.gold:C.border}`, color: mode==='details'?C.gold:C.muted, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>📋 Names + FC + ID</button>
        </div>
      </div>

      {mode === 'names' ? (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              placeholder={'Paste or type names, e.g.\nAlice\nBob, Charlie\nDana'}
              rows={10}
              style={{ width: '100%', background: C.section, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, color: C.white, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
            />
            <input type="file" accept=".csv" ref={csvInputRef} onChange={handleCsvFile} style={{ display: 'none' }} />
            <button onClick={() => csvInputRef.current?.click()} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: C.gold, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              📄 Upload CSV (ID, username)
            </button>
            <div style={{ fontSize: 13, color: C.muted }}>
              {names.length} new name{names.length !== 1 ? 's' : ''} detected{skipped.length > 0 ? ` · ${skipped.length} skipped (duplicate)` : ''}
            </div>
            {(names.length > 0 || skipped.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {names.map((n, i) => {
                  const flagged = closeMatches.some(cm => cm.name === n);
                  return (
                    <span key={`a${i}`} style={{ padding: '6px 12px', borderRadius: 16, background: C.card, border: `1px solid ${flagged?C.gold:C.border}`, color: flagged?C.gold:C.icy, fontSize: 13 }}>
                      {flagged ? '≈ ' : ''}{n}
                    </span>
                  );
                })}
                {skipped.map((n, i) => (
                  <span key={`s${i}`} title="Already on the roster, or repeated in this list — won't be added again" style={{ padding: '6px 12px', borderRadius: 16, background: C.gold+'14', border: `1px solid ${C.gold}55`, color: C.gold, fontSize: 13 }}>⚠ {n}</span>
                ))}
              </div>
            )}

            {closeMatches.length > 0 && (
              <div style={{ background: C.gold+'14', border: `1px solid ${C.gold}55`, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, color: C.gold, fontWeight: 700, marginBottom: 6 }}>⚠ Possible typos — similar to names already on the roster</div>
                {closeMatches.map(({ name, matches }) => (
                  <div key={name} style={{ fontSize: 12, color: C.icy, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>"{name}" looks like <strong style={{ color: C.white }}>{matches[0].player.username || matches[0].player.alias}</strong> — same person?</span>
                    {fidIndex[fidKey(name)] && (
                      <button onClick={() => linkCloseMatchToExisting(name, matches[0].player)} style={{ fontSize: 11, color: C.green, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>🔗 Yes — link their ID</button>
                    )}
                    <button onClick={() => removeNameFromRaw(name)} style={{ fontSize: 11, color: C.gold, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Remove from list</button>
                  </div>
                ))}
              </div>
            )}

            {fidSkipped.length > 0 && (
              <div style={{ background: C.green+'14', border: `1px solid ${C.green}55`, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, color: C.green, fontWeight: 700, marginBottom: 6 }}>🔗 Already on roster — matched by ID, won't be re-added</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {fidSkipped.map((m, i) => (
                    <span key={i} style={{ padding: '6px 12px', borderRadius: 16, background: C.card, border: `1px solid ${C.green}55`, color: C.icy, fontSize: 13 }}>
                      {m.name} → {m.existingPlayer.username || m.existingPlayer.alias}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {pendingFidBackfills.length > 0 && (
              <div style={{ fontSize: 12, color: C.icy }}>
                🔗 {pendingFidBackfills.length} existing player{pendingFidBackfills.length !== 1 ? 's' : ''} matched by name will have their ID added on Add.
              </div>
            )}
          </div>

          <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <button
              onClick={handleAdd}
              disabled={names.length === 0 && pendingFidBackfills.length === 0}
              style={{ width: '100%', height: 48, borderRadius: 12, background: (names.length > 0 || pendingFidBackfills.length > 0) ? C.gold : C.section, border: 'none', color: (names.length > 0 || pendingFidBackfills.length > 0) ? C.bg : C.muted, fontWeight: 800, fontSize: 15, cursor: (names.length > 0 || pendingFidBackfills.length > 0) ? 'pointer' : 'default' }}
            >
              {names.length > 0 ? `Add ${names.length} Player${names.length !== 1 ? 's' : ''}` : pendingFidBackfills.length > 0 ? `Match ${pendingFidBackfills.length} by ID` : 'Add Players'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              value={detailText}
              onChange={e => setDetailText(e.target.value)}
              placeholder={'Name, FC Level, User ID — one per line, e.g.\nAlice, FC7, 632707622\nBob, Helios, 636115844'}
              rows={10}
              style={{ width: '100%', background: C.section, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, color: C.white, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ fontSize: 13, color: C.muted }}>
              FC and ID are both optional per line — leave a field blank and it's just not touched for that person.
            </div>
            {resolvedDetail.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {resolvedDetail.map((r, i) => {
                  if (r.status === 'matched') {
                    return (
                      <span key={i} style={{ padding: '6px 12px', borderRadius: 14, background: C.green+'18', border: `1px solid ${C.green}44`, color: C.green, fontSize: 12 }}>
                        ✓ {r.name} → {r.player.username || r.player.alias}{r.fc ? ` · ${r.fc}` : ''}{r.fid ? ` · ID ${r.fid}` : ''}
                      </span>
                    );
                  }
                  if (r.status === 'new') {
                    return (
                      <span key={i} style={{ padding: '6px 12px', borderRadius: 14, background: C.gold+'14', border: `1px solid ${C.gold}44`, color: C.gold, fontSize: 12 }}>
                        ➕ {r.name} — new player{r.fc ? ` · ${r.fc}` : ''}{r.fid ? ` · ID ${r.fid}` : ''}
                      </span>
                    );
                  }
                  return (
                    <div key={i} style={{ padding: '8px 10px', borderRadius: 10, background: C.red+'0f', border: `1px solid ${C.red}33`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: C.icy }}>
                        "{r.name}" looks like <strong style={{ color: C.white }}>{r.suggestion.username || r.suggestion.alias}</strong> — same person?
                      </span>
                      <button onClick={() => decideDetail(r.name, r.suggestion.id)} style={{ fontSize: 11, color: C.green, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>🔗 Yes, link them</button>
                      <button onClick={() => decideDetail(r.name, 'new')} style={{ fontSize: 11, color: C.gold, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>➕ No, add as new</button>
                    </div>
                  );
                })}
              </div>
            )}
            {detailPendingCount > 0 && (
              <div style={{ fontSize: 12, color: C.red+'cc' }}>⚠ {detailPendingCount} name{detailPendingCount!==1?'s':''} need a decision above before submitting.</div>
            )}
          </div>

          <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <button
              onClick={handleDetailSubmit}
              disabled={detailReadyCount === 0 || detailPendingCount > 0}
              style={{ width: '100%', height: 48, borderRadius: 12, background: (detailReadyCount>0 && detailPendingCount===0) ? C.gold : C.section, border: 'none', color: (detailReadyCount>0 && detailPendingCount===0) ? C.bg : C.muted, fontWeight: 800, fontSize: 15, cursor: (detailReadyCount>0 && detailPendingCount===0) ? 'pointer' : 'default' }}
            >
              {detailReadyCount > 0 ? `Save ${detailReadyCount} Player${detailReadyCount !== 1 ? 's' : ''}` : 'Save'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
