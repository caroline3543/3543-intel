import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { newPlayer } from '../../data/playerSchema.js';
import { vibe } from '../../utils/vibe.js';

// Replaces the old BatchAddSheet.jsx multi-step wizard (Names → Review →
// Details). With Field Registry handling languages/tiers/heroes/roles
// afterward, bulk add only needs to do one thing fast: get names into
// the roster. Paste a list, comma- or newline-separated, done — then use
// Field Registry to fill everyone in.
export function BulkNameAdd({ onAddPlayers, onClose, showToast }) {
  const [text, setText] = useState('');

  const names = text
    .split(/[,\n]/)
    .map(n => n.trim())
    .filter(Boolean);

  function handleAdd() {
    if (names.length === 0) return;
    const players = names.map(username => newPlayer({ username }));
    onAddPlayers(players);
    vibe(10);
    showToast?.(`Added ${players.length} player${players.length !== 1 ? 's' : ''}`, 'success');
    onClose();
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#000000cc', zIndex:700, display:'flex', alignItems:'flex-end' }}>
      <div style={{ background:C.bg, width:'100%', maxWidth:480, margin:'0 auto', borderRadius:'20px 20px 0 0', padding:'20px 20px 24px', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
        <div style={{ width:40, height:4, borderRadius:2, background:C.border, margin:'0 auto 16px' }} />
        <div style={{ fontSize:17, fontWeight:700, color:C.white, marginBottom:4 }}>Bulk Add Members</div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>
          Paste names separated by commas or one per line. Fill in tiers, languages, and heroes for everyone afterward from the Field Registry.
        </div>
        <textarea
          value={text}
          onChange={e=>setText(e.target.value)}
          placeholder={'Alice\nBob\nCharlie'}
          style={{ flex:1, minHeight:160, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit', resize:'vertical' }}
        />
        <div style={{ fontSize:12, color:C.muted, margin:'10px 0 16px' }}>
          {names.length} name{names.length !== 1 ? 's' : ''} detected
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:48, borderRadius:12, border:`1px solid ${C.border}`, background:'none', color:C.icy, fontWeight:600, fontSize:15, cursor:'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={names.length === 0}
            style={{
              flex:2, height:48, borderRadius:12, border:'none', fontWeight:700, fontSize:15,
              background: names.length ? C.gold : C.muted+'44',
              color: names.length ? C.bg : C.muted,
              cursor: names.length ? 'pointer' : 'default',
            }}
          >
            Add {names.length || ''} {names.length === 1 ? 'Player' : 'Players'}
          </button>
        </div>
      </div>
    </div>
  );
}
