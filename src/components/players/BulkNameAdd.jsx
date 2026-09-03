import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newPlayer } from '../../data/playerSchema.js';
import { parseNames, findCloseMatches } from '../../utils/nameList.js';

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

// Replaces the old multi-step Batch Add wizard (Names → Review →
// Details). Details — languages, troop tiers, joiner heroes, roles —
// are now filled in afterward via Field Registry, which is faster for
// assigning one value to many people than the old per-member carousel.
// After adding, this screen offers a direct one-tap handoff into Field
// Registry rather than closing silently — that's almost always the
// very next thing you want to do with names you just bulk-added.
export default function BulkNameAdd({ onAddPlayers, onClose, showToast, onGoToFieldRegistry, existingPlayers = [] }) {
  const [raw, setRaw] = useState('');
  const [addedCount, setAddedCount] = useState(null); // null = still entering names
  const { toAdd: names, skipped, closeMatches } = classifyNames(raw, existingPlayers);

  // "Remove from list" on a flagged close match — rebuilds the
  // textarea one name per line rather than trying to preserve the
  // original comma/newline mix, which isn't worth the complexity here.
  function removeNameFromRaw(nameToRemove) {
    const remaining = parseNames(raw).filter(n => n.toLowerCase() !== nameToRemove.toLowerCase());
    setRaw(remaining.join('\n'));
  }

  function handleAdd() {
    if (names.length === 0) return;
    const players = names.map(name => newPlayer({ username: name }));
    onAddPlayers(players);
    const skippedNote = skipped.length ? ` · skipped ${skipped.length} duplicate${skipped.length !== 1 ? 's' : ''}` : '';
    showToast?.(`Added ${players.length} player${players.length !== 1 ? 's' : ''}${skippedNote}`, 'success');
    vibe(10);
    setAddedCount(players.length);
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,-apple-system,sans-serif', color: C.white }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0 }}>← Back</button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>➕ Bulk Add Names</div>
            <div style={{ fontSize: 12, color: C.muted }}>Comma or newline separated — fill in details after, via Field Registry</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <textarea
          value={raw}
          onChange={e => setRaw(e.target.value)}
          placeholder={'Paste or type names, e.g.\nAlice\nBob, Charlie\nDana'}
          rows={10}
          style={{ width: '100%', background: C.section, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, color: C.white, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
        />
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
                <button onClick={() => removeNameFromRaw(name)} style={{ fontSize: 11, color: C.gold, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Remove from list</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button
          onClick={handleAdd}
          disabled={names.length === 0}
          style={{ width: '100%', height: 48, borderRadius: 12, background: names.length > 0 ? C.gold : C.section, border: 'none', color: names.length > 0 ? C.bg : C.muted, fontWeight: 800, fontSize: 15, cursor: names.length > 0 ? 'pointer' : 'default' }}
        >
          Add {names.length > 0 ? names.length : ''} Player{names.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}
