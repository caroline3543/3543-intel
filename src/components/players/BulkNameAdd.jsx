import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newPlayer } from '../../data/playerSchema.js';

function parseNames(raw) {
  return raw
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(Boolean);
}

// Replaces the old multi-step Batch Add wizard (Names → Review →
// Details). Details — languages, troop tiers, joiner heroes, roles —
// are now filled in afterward via Field Registry, which is faster for
// assigning one value to many people than the old per-member carousel.
export default function BulkNameAdd({ onAddPlayers, onClose, showToast }) {
  const [raw, setRaw] = useState('');
  const names = parseNames(raw);

  function handleAdd() {
    if (names.length === 0) return;
    const players = names.map(name => newPlayer({ username: name }));
    onAddPlayers(players);
    showToast?.(`Added ${players.length} player${players.length !== 1 ? 's' : ''}`, 'success');
    vibe(10);
    onClose();
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
          {names.length} name{names.length !== 1 ? 's' : ''} detected
        </div>
        {names.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {names.map((n, i) => (
              <span key={i} style={{ padding: '6px 12px', borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, color: C.icy, fontSize: 13 }}>{n}</span>
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
