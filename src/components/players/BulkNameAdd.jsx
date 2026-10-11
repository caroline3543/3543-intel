import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newPlayer } from '../../data/playerSchema.js';
import { findCloseMatches } from '../../utils/nameList.js';

// One format only: "[Alliance] Username, FC Level, User ID" — every
// field but the username is optional, left blank when not known yet.
// The bracketed alliance tag is optional too (a line with no leading
// "[...]" just means "don't touch/set alliance for this person").
function parseDetailLines(raw) {
  return (raw || '').split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    let allianceTag = '';
    let rest = line;
    const bracketMatch = line.match(/^\[([^\]]*)\]\s*(.*)$/);
    if (bracketMatch) {
      allianceTag = bracketMatch[1].trim();
      rest = bracketMatch[2];
    }
    const parts = rest.split(',').map(s => s.trim());
    return { allianceTag, name: parts[0] || '', fc: parts[1] || '', fid: parts[2] || '' };
  }).filter(r => r.name);
}

// Resolve each row against the roster — FID checked first
// (authoritative, matches the game's own stable player ID), then
// exact username/nickname, then a fuzzy suggestion the officer has to
// explicitly confirm (link, or add as new) before it can submit.
function resolveDetailRows(lines, pool, decisions) {
  return lines.map(row => {
    const byFid = row.fid ? pool.find(p => p.fid && String(p.fid).trim() === row.fid) : null;
    if (byFid) return { status: 'matched', ...row, player: byFid, renamed: isRename(byFid, row.name) };

    const exact = pool.find(p =>
      (p.username || '').toLowerCase() === row.name.toLowerCase() ||
      (p.alias || '').toLowerCase() === row.name.toLowerCase()
    );
    if (exact) return { status: 'matched', ...row, player: exact, renamed: isRename(exact, row.name) };

    const decision = decisions[row.name];
    if (decision === 'new') return { status: 'new', ...row };
    if (decision) {
      const linked = pool.find(p => p.id === decision);
      if (linked) return { status: 'matched', ...row, player: linked, renamed: isRename(linked, row.name) };
    }

    const fuzzy = findCloseMatches(row.name, pool);
    if (fuzzy.length > 0) return { status: 'fuzzy', ...row, suggestion: fuzzy[0].player };
    return { status: 'new', ...row };
  });
}

// A genuine rename — not just a capitalization difference — worth
// logging to pastUsernames rather than silently overwritten.
function isRename(existingPlayer, incomingName) {
  const current = (existingPlayer.username || '').trim();
  return !!current && current.toLowerCase() !== incomingName.trim().toLowerCase();
}

// What changed for one matched row, vs. the player on file. Drives both
// the preview chips (so you see old → new before saving) and the
// summary counts after.
function diffRow(r) {
  const p = r.player;
  const d = {};
  if (r.renamed) d.name = [p.username, r.name];
  if (r.allianceTag && (p.allianceTag || '') !== r.allianceTag) d.alliance = [p.allianceTag || 'none', r.allianceTag];
  if (r.fc && (p.furnaceLevel || '') !== r.fc) d.fc = [p.furnaceLevel || '—', r.fc];
  if (r.fid && String(p.fid || '').trim() !== r.fid) d.fid = [p.fid || '—', r.fid];
  return d;
}

// ── BulkNameAdd ──────────────────────────────────────────────────
// One paste format, one purpose: match-and-update existing players
// (alliance, FC level, ID all overwrite what's on file when provided
// — this is explicitly a correction/bulk-edit tool, not a
// fill-if-blank one) and create the rest as new. Languages, joiner
// heroes, and roles still aren't covered by this format — Field
// Registry remains the fastest way to fill those in afterward, so the
// handoff into it stays on the success screen.
export default function BulkNameAdd({ onAddPlayers, onUpdatePlayers, onClose, showToast, onGoToFieldRegistry, existingPlayers = [] }) {
  const [detailText, setDetailText] = useState('');
  const [detailDecisions, setDetailDecisions] = useState({});
  const [result, setResult] = useState(null); // summary counts once submitted, else null
  // Verify-roster mode: anyone NOT on the pasted list is moved to "no
  // alliance". scope 'all' = whole roster; 'listed' = only players whose
  // current alliance appears in the list (for pasting one alliance's
  // list without touching the others).
  const [verifyMode, setVerifyMode] = useState(false);
  const [scope, setScope] = useState('all');
  const [armed, setArmed] = useState(false);

  const resolvedDetail = resolveDetailRows(parseDetailLines(detailText), existingPlayers, detailDecisions);
  const readyCount = resolvedDetail.filter(r => r.status === 'matched' || r.status === 'new').length;
  const pendingCount = resolvedDetail.filter(r => r.status === 'fuzzy').length;

  // Players who'd be cleared: have an alliance, aren't matched by any
  // row on the list. Fuzzy rows must be resolved first (submit is
  // blocked until then), so nobody is cleared by an unresolved guess.
  const matchedIds = new Set(resolvedDetail.filter(r => r.status === 'matched').map(r => r.player.id));
  const listedTags = new Set(resolvedDetail.map(r => r.allianceTag).filter(Boolean));
  const toClear = !verifyMode ? [] : existingPlayers.filter(p =>
    p.allianceTag && !matchedIds.has(p.id) && (scope === 'all' || listedTags.has(p.allianceTag))
  );
  const matchedCount = matchedIds.size;
  // A pasted list that matches very little of the roster usually means
  // a wrong paste (or wrong format), not 40 people leaving — say so.
  const looksWrong = verifyMode && existingPlayers.length >= 10 && toClear.length > 0 && toClear.length > matchedCount;

  function decide(name, value) {
    setDetailDecisions(prev => ({ ...prev, [name]: value }));
    setArmed(false);
  }

  function handleSubmit() {
    // Verify mode with people to clear needs a second, deliberate tap.
    if (toClear.length > 0 && !armed) { setArmed(true); return; }
    const now = new Date().toISOString();
    const toUpdate = [];
    const toCreate = [];
    const stats = { renamed: 0, moved: 0, fc: 0, cleared: 0 };
    resolvedDetail.forEach(r => {
      if (r.status === 'matched') {
        const d = diffRow(r);
        if (d.name) stats.renamed++;
        if (d.alliance) stats.moved++;
        if (d.fc) stats.fc++;
        const namePatch = r.renamed
          ? {
              username: r.name,
              // Append the OLD username to history before it's gone
              // — skip if it's already the most recent entry, so
              // re-running the same list twice doesn't pile up
              // duplicate consecutive entries.
              pastUsernames: (() => {
                const hist = r.player.pastUsernames || [];
                const outgoing = r.player.username;
                return (outgoing && hist[hist.length - 1] !== outgoing) ? [...hist, outgoing] : hist;
              })(),
            }
          : {};
        const alliancePatch = d.alliance
          ? { allianceTag: r.allianceTag, allianceHistory: [...(r.player.allianceHistory || []), { from: r.player.allianceTag || '', to: r.allianceTag, at: now }] }
          : {};
        toUpdate.push({
          ...r.player,
          ...namePatch,
          ...alliancePatch,
          ...(r.fc ? { furnaceLevel: r.fc, tiersUpdatedAt: now } : {}),
          ...(r.fid ? { fid: r.fid } : {}),
        });
      } else if (r.status === 'new') {
        toCreate.push(newPlayer({
          username: r.name,
          ...(r.allianceTag ? { allianceTag: r.allianceTag } : {}),
          ...(r.fc ? { furnaceLevel: r.fc, tiersUpdatedAt: now } : {}),
          ...(r.fid ? { fid: r.fid } : {}),
        }));
      }
    });
    // Players left off the list → no alliance (history keeps where they were)
    toClear.forEach(p => {
      stats.cleared++;
      toUpdate.push({ ...p, allianceTag: '', allianceHistory: [...(p.allianceHistory || []), { from: p.allianceTag, to: '', at: now }] });
    });
    if (toUpdate.length && onUpdatePlayers) onUpdatePlayers(toUpdate);
    if (toCreate.length) onAddPlayers(toCreate);
    showToast?.(`Updated ${toUpdate.length}, added ${toCreate.length} new`, 'success');
    vibe(10);
    setDetailText('');
    setDetailDecisions({});
    setArmed(false);
    setResult({ updated: toUpdate.length - stats.cleared, created: toCreate.length, ...stats });
  }

  if (result !== null) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,-apple-system,sans-serif', color: C.white }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Updated {result.updated}, added {result.created}
          </div>
          {(result.renamed + result.moved + result.fc + result.cleared) > 0 && (
            <div style={{ fontSize: 13, color: C.icy, marginBottom: 12, maxWidth: 320 }}>
              {[result.renamed && `${result.renamed} renamed`, result.moved && `${result.moved} changed alliance`, result.fc && `${result.fc} furnace updated`, result.cleared && `${result.cleared} set to no alliance`].filter(Boolean).join(' · ')}
            </div>
          )}
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 32, maxWidth: 320 }}>
            Languages, joiner heroes, and roles still aren't set. Field Registry is the fastest way to fill those in for everyone.
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,-apple-system,sans-serif', color: C.white }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0 }}>← Back</button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>➕ Bulk Add / Verify Roster</div>
            <div style={{ fontSize: 12, color: C.muted }}>Matches and updates existing players, adds the rest</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <textarea
          value={detailText}
          onChange={e => { setDetailText(e.target.value); setArmed(false); }}
          placeholder={'[Alliance] Username, FC Level, User ID — one per line, e.g.\n[R3K] Alice, FC7, 632707622\n[R3K] Bob, Helios, 636115844\nCharlie'}
          rows={10}
          style={{ width: '100%', background: C.section, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, color: C.white, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
        />
        <button onClick={() => { setVerifyMode(v => !v); setArmed(false); }}
          style={{ minHeight: 48, borderRadius: 10, padding: '8px 14px', textAlign: 'left', cursor: 'pointer', background: verifyMode ? C.gold + '18' : C.section, border: `1px solid ${verifyMode ? C.gold : C.border}`, color: verifyMode ? C.gold : C.icy, fontSize: 14, fontWeight: 700 }}>
          {verifyMode ? '✓ ' : ''}Verify roster — anyone not on this list → no alliance
        </button>
        {verifyMode && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all', 'Whole roster'], ['listed', 'Only alliances in this list']].map(([k, label]) => (
              <button key={k} onClick={() => { setScope(k); setArmed(false); }}
                style={{ flex: 1, minHeight: 44, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: scope === k ? C.gold + '22' : C.section, border: `1px solid ${scope === k ? C.gold : C.border}`, color: scope === k ? C.gold : C.icy }}>{label}</button>
            ))}
          </div>
        )}
        <div style={{ fontSize: 13, color: C.muted }}>
          Only the username is required — leave alliance, FC, or ID blank if you don't know it yet, and it just won't be touched for that person.
        </div>
        {resolvedDetail.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {resolvedDetail.map((r, i) => {
              if (r.status === 'matched') {
                const d = diffRow(r);
                const parts = [
                  d.name && `${d.name[0]} → ${d.name[1]} (renamed)`,
                  d.alliance && `[${d.alliance[0]}] → [${d.alliance[1]}]`,
                  d.fc && `${d.fc[0]} → ${d.fc[1]}`,
                  d.fid && `ID ${d.fid[1]}`,
                ].filter(Boolean);
                return (
                  <span key={i} style={{ padding: '6px 12px', borderRadius: 14, background: C.green+'18', border: `1px solid ${C.green}44`, color: C.green, fontSize: 12 }}>
                    ✓ {r.player.username || r.player.alias}{parts.length ? ` · ${parts.join(' · ')}` : ' · no changes'}
                  </span>
                );
              }
              if (r.status === 'new') {
                return (
                  <span key={i} style={{ padding: '6px 12px', borderRadius: 14, background: C.gold+'14', border: `1px solid ${C.gold}44`, color: C.gold, fontSize: 12 }}>
                    ➕ {r.name} — new player{r.allianceTag ? ` · [${r.allianceTag}]` : ''}{r.fc ? ` · ${r.fc}` : ''}{r.fid ? ` · ID ${r.fid}` : ''}
                  </span>
                );
              }
              return (
                <div key={i} style={{ padding: '8px 10px', borderRadius: 10, background: C.red+'0f', border: `1px solid ${C.red}33`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: C.icy }}>
                    "{r.name}" looks like <strong style={{ color: C.white }}>{r.suggestion.username || r.suggestion.alias}</strong> — same person?
                  </span>
                  <button onClick={() => decide(r.name, r.suggestion.id)} style={{ fontSize: 11, color: C.green, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>🔗 Yes, link them</button>
                  <button onClick={() => decide(r.name, 'new')} style={{ fontSize: 11, color: C.gold, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>➕ No, add as new</button>
                </div>
              );
            })}
          </div>
        )}
        {verifyMode && toClear.length > 0 && (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: C.section, border: `1px solid ${armed ? C.red : C.gold}66` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: armed ? C.red : C.gold, marginBottom: 6 }}>
              {toClear.length} not on the list → no alliance
            </div>
            <div style={{ fontSize: 12, color: C.icy, lineHeight: 1.6 }}>
              {toClear.map(p => `${p.username || p.alias}${p.allianceTag ? ` [${p.allianceTag}]` : ''}`).join(', ')}
            </div>
            {looksWrong && (
              <div style={{ fontSize: 12, color: C.gold, marginTop: 8 }}>
                ⚠ That's more people than matched ({matchedCount}). Check this is the right list and format before saving.
              </div>
            )}
          </div>
        )}
        {verifyMode && toClear.length === 0 && resolvedDetail.length > 0 && (
          <div style={{ fontSize: 12, color: C.muted }}>Everyone with an alliance is on this list — nobody will be cleared.</div>
        )}
        {pendingCount > 0 && (
          <div style={{ fontSize: 12, color: C.red+'cc' }}>⚠ {pendingCount} name{pendingCount!==1?'s':''} need a decision above before submitting.</div>
        )}
      </div>

      <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button
          onClick={handleSubmit}
          disabled={readyCount === 0 || pendingCount > 0}
          style={{ width: '100%', height: 48, borderRadius: 12, background: (readyCount>0 && pendingCount===0) ? (armed ? C.red : C.gold) : C.section, border: 'none', color: (readyCount>0 && pendingCount===0) ? (armed ? C.white : C.bg) : C.muted, fontWeight: 800, fontSize: 15, cursor: (readyCount>0 && pendingCount===0) ? 'pointer' : 'default' }}
        >
          {readyCount === 0 ? 'Save' : armed ? `Confirm — clear ${toClear.length} alliance${toClear.length !== 1 ? 's' : ''} & save` : toClear.length > 0 ? `Review & save (${toClear.length} to clear)` : `Save ${readyCount} Player${readyCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
