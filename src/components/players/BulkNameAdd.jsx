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
  const [result, setResult] = useState(null); // { updated, created } once submitted, else null

  const resolvedDetail = resolveDetailRows(parseDetailLines(detailText), existingPlayers, detailDecisions);
  const readyCount = resolvedDetail.filter(r => r.status === 'matched' || r.status === 'new').length;
  const pendingCount = resolvedDetail.filter(r => r.status === 'fuzzy').length;

  function decide(name, value) {
    setDetailDecisions(prev => ({ ...prev, [name]: value }));
  }

  function handleSubmit() {
    const toUpdate = [];
    const toCreate = [];
    resolvedDetail.forEach(r => {
      if (r.status === 'matched') {
        toUpdate.push({
          ...r.player,
          ...(r.allianceTag ? { allianceTag: r.allianceTag } : {}),
          ...(r.fc ? { furnaceLevel: r.fc } : {}),
          ...(r.fid ? { fid: r.fid } : {}),
        });
      } else if (r.status === 'new') {
        toCreate.push(newPlayer({
          username: r.name,
          ...(r.allianceTag ? { allianceTag: r.allianceTag } : {}),
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
    setResult({ updated: toUpdate.length, created: toCreate.length });
  }

  if (result !== null) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,-apple-system,sans-serif', color: C.white }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Updated {result.updated}, added {result.created}
          </div>
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
            <div style={{ fontSize: 17, fontWeight: 700 }}>➕ Bulk Add</div>
            <div style={{ fontSize: 12, color: C.muted }}>Matches and updates existing players, adds the rest</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <textarea
          value={detailText}
          onChange={e => setDetailText(e.target.value)}
          placeholder={'[Alliance] Username, FC Level, User ID — one per line, e.g.\n[R3K] Alice, FC7, 632707622\n[R3K] Bob, Helios, 636115844\nCharlie'}
          rows={10}
          style={{ width: '100%', background: C.section, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, color: C.white, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
        />
        <div style={{ fontSize: 13, color: C.muted }}>
          Only the username is required — leave alliance, FC, or ID blank if you don't know it yet, and it just won't be touched for that person.
        </div>
        {resolvedDetail.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {resolvedDetail.map((r, i) => {
              if (r.status === 'matched') {
                return (
                  <span key={i} style={{ padding: '6px 12px', borderRadius: 14, background: C.green+'18', border: `1px solid ${C.green}44`, color: C.green, fontSize: 12 }}>
                    ✓ {r.name} → {r.player.username || r.player.alias}{r.allianceTag ? ` · [${r.allianceTag}]` : ''}{r.fc ? ` · ${r.fc}` : ''}{r.fid ? ` · ID ${r.fid}` : ''}
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
        {pendingCount > 0 && (
          <div style={{ fontSize: 12, color: C.red+'cc' }}>⚠ {pendingCount} name{pendingCount!==1?'s':''} need a decision above before submitting.</div>
        )}
      </div>

      <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button
          onClick={handleSubmit}
          disabled={readyCount === 0 || pendingCount > 0}
          style={{ width: '100%', height: 48, borderRadius: 12, background: (readyCount>0 && pendingCount===0) ? C.gold : C.section, border: 'none', color: (readyCount>0 && pendingCount===0) ? C.bg : C.muted, fontWeight: 800, fontSize: 15, cursor: (readyCount>0 && pendingCount===0) ? 'pointer' : 'default' }}
        >
          {readyCount > 0 ? `Save ${readyCount} Player${readyCount !== 1 ? 's' : ''}` : 'Save'}
        </button>
      </div>
    </div>
  );
}
