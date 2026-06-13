import { useState, useEffect } from 'react';
import { C } from '../../../utils/constants.js';
import { vibe } from '../../../utils/vibe.js';
import { uid, fmtMarch } from './rallyRoomHelpers.js';
import { MarchInput } from './SmartInputs.jsx';

// ── MarchRegistry ──────────────────────────────────────────────
// The "💾 March Times" tab — save and manage per-leader march times.
// Props:
//   registry – march registry entries array
//   onChange – (updatedRegistry) => void
//   players  – full roster array (for Rally Lead quick-add)
export function MarchRegistry({ registry, onChange, players = [] }) {
  const [editingEntry, setEditingEntry] = useState(null);
  const [editOpen, setEditOpen]         = useState(false);

  const rallyLeads = (players || []).filter(p => p.roles?.includes('Rally Lead'));

  function addFromRoster(player) {
    if (registry.some(r => r.name === player.username)) return;
    onChange([...registry, { id:uid(), name:player.username, marchSecs:player.marchSecs||null, type:'Main Rally' }]);
    vibe(8);
  }
  function saveEntry(entry)  { onChange(registry.some(r => r.id === entry.id) ? registry.map(r => r.id === entry.id ? entry : r) : [...registry, entry]); }
  function deleteEntry(id)   { onChange(registry.filter(r => r.id !== id)); }

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:4 }}>March Times</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Saved leaders appear as chips in the calculator.</div>

      {/* Quick-add from roster */}
      {rallyLeads.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Add from roster</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {rallyLeads.map(p => {
              const inReg = registry.some(r => r.name === p.username);
              return (
                <button key={p.id} onClick={() => addFromRoster(p)} disabled={inReg}
                  style={{ padding:'8px 14px', borderRadius:20, minHeight:38, border:`1px solid ${inReg?C.border:C.gold}`, background:inReg?C.section:C.gold+'18', color:inReg?C.muted:C.gold, fontWeight:600, fontSize:13, cursor:inReg?'default':'pointer' }}>
                  {inReg ? '✓ ' : ''}{p.username}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Registry entries */}
      {registry.map(entry => (
        <div key={entry.id} style={{ background:C.section, borderRadius:10, padding:'12px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{entry.name}</div>
            <div style={{ fontSize:13, color:entry.marchSecs?C.green:C.muted }}>{entry.marchSecs ? fmtMarch(entry.marchSecs) : 'No march time set'}</div>
          </div>
          <button onClick={() => { setEditingEntry(entry); setEditOpen(true); }}
            style={{ height:36, padding:'0 14px', borderRadius:18, background:C.card, border:`1px solid ${C.border}`, color:C.icy, fontSize:13, cursor:'pointer' }}>✏️ Edit</button>
        </div>
      ))}

      <button onClick={() => { setEditingEntry(null); setEditOpen(true); }}
        style={{ width:'100%', height:48, borderRadius:10, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', marginTop:4 }}>
        ＋ Add new leader
      </button>

      {/* Edit bottom-sheet */}
      {editOpen && (
        <div onClick={() => setEditOpen(false)} style={{ position:'fixed', inset:0, background:'#000c', zIndex:500, display:'flex', alignItems:'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'16px 20px 80px' }}>
            <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{editingEntry ? 'Edit leader' : 'Add leader'}</div>
              <button onClick={() => setEditOpen(false)} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>
            <LeaderEditForm
              entry={editingEntry}
              onSave={e => { saveEntry(e); setEditOpen(false); }}
              onDelete={id => { deleteEntry(id); setEditOpen(false); }}
              onCancel={() => setEditOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── LeaderEditForm ─────────────────────────────────────────────
// Inline form used inside the MarchRegistry edit sheet.
function LeaderEditForm({ entry, onSave, onDelete, onCancel }) {
  const [l, setL]               = useState(() => entry || { id:uid(), name:'', marchSecs:null, type:'Main Rally' });
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (entry) setL({ ...entry });
    else setL({ id:uid(), name:'', marchSecs:null, type:'Main Rally' });
  }, [entry?.id]);

  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Name</label>
        <input value={l.name} onChange={e => setL(p => ({ ...p, name:e.target.value }))} placeholder="Leader name"
          style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>March time</label>
        <MarchInput value={l.marchSecs} onChange={v => setL(p => ({ ...p, marchSecs:v }))}/>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:entry ? 12 : 0 }}>
        <button onClick={onCancel} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
        <button onClick={() => onSave(l)} disabled={!l.name || !l.marchSecs}
          style={{ flex:2, height:52, borderRadius:12, background:l.name&&l.marchSecs?C.gold:C.border, color:C.bg, fontWeight:700, fontSize:16, border:'none', cursor:l.name&&l.marchSecs?'pointer':'default' }}>Save</button>
      </div>
      {entry && !confirmDel && (
        <button onClick={() => setConfirmDel(true)}
          style={{ width:'100%', height:44, borderRadius:12, background:'none', border:`1px solid ${C.red}44`, color:C.red, fontWeight:600, fontSize:14, cursor:'pointer' }}>Delete leader</button>
      )}
      {confirmDel && (
        <div style={{ background:C.red+'18', border:`1px solid ${C.red}44`, borderRadius:12, padding:14, textAlign:'center' }}>
          <div style={{ fontSize:14, color:C.white, marginBottom:12 }}>Delete {entry?.name}?</div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setConfirmDel(false)} style={{ flex:1, height:44, borderRadius:10, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:14, cursor:'pointer' }}>Cancel</button>
            <button onClick={() => onDelete(entry.id)} style={{ flex:2, height:44, borderRadius:10, background:C.red, color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}
