import { useState, useEffect } from 'react';
import { C } from '../../../utils/constants.js';
import { vibe } from '../../../utils/vibe.js';
import { newChecklistItemDef } from '../../../utils/checklist.js';
import { SheetHandle } from '../../common/Primitives.jsx';
import { DeleteConfirmModal } from '../../common/DeleteConfirmModal.jsx';

// ── ChecklistManagerSheet ──────────────────────────────────────
// Manages the alliance-wide Leadership Checklist item list — mirrors
// RoleManagerSheet.jsx's add/rename/reorder/delete pattern exactly.
// Unlike roles, checklist items aren't attached to players, so there's
// no propagation step on rename/delete — just the shared item list.
// Per-plan checked state lives on each plan (plan.checklist), not here.
//
// Props:
//   open, onClose
//   items       – checklist item defs (from useAppState's customChecklist)
//   onSaveItems – (items[]) => void — replaces the whole list
export function ChecklistManagerSheet({ open, onClose, items, onSaveItems }) {
  const [drafts, setDrafts]             = useState({});
  const [newName, setNewName]           = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (!open) return;
    setDrafts(Object.fromEntries(items.map(i => [i.id, i.name])));
    setNewName('');
  }, [open]);

  if (!open) return null;

  function addItem() {
    const name = newName.trim();
    if (!name) return;
    if (items.some(i => i.name.toLowerCase() === name.toLowerCase())) return;
    onSaveItems([...items, newChecklistItemDef(name)]);
    setNewName('');
    vibe(8);
  }

  function commitRename(item) {
    const trimmed = (drafts[item.id] || '').trim();
    if (!trimmed || trimmed === item.name) { setDrafts(prev => ({ ...prev, [item.id]: item.name })); return; }
    onSaveItems(items.map(i => i.id === item.id ? { ...i, name: trimmed, updatedAt: new Date().toISOString() } : i));
  }

  function move(idx, dir) {
    const next = [...items];
    const [it] = next.splice(idx, 1);
    next.splice(idx + dir, 0, it);
    onSaveItems(next);
    vibe(6);
  }

  function doDelete(item) {
    onSaveItems(items.filter(i => i.id !== item.id));
    setDeleteTarget(null);
    vibe([20, 20, 20]);
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:340, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'86vh', overflowY:'auto', padding:'16px 20px 40px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>Manage Leadership Checklist</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>These items appear on every battle plan for officers to check off before going live.</div>

        {items.map((item, i) => (
          <div key={item.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 8px 8px 14px', borderRadius:12, background:C.section, marginBottom:8 }}>
            <span style={{ fontSize:16, flexShrink:0 }}>✅</span>
            <input
              value={drafts[item.id] ?? item.name}
              onChange={e => setDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
              onBlur={() => commitRename(item)}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
              style={{ flex:1, minHeight:44, background:'none', border:'none', color:C.white, fontSize:15, fontWeight:600, fontFamily:'inherit', padding:'0 4px' }}
            />
            <div style={{ display:'flex', flexDirection:'column' }}>
              <button onClick={() => move(i, -1)} disabled={i === 0}
                style={{ width:32, height:22, background:'none', border:'none', color:i === 0 ? C.border : C.muted, fontSize:12, cursor:i === 0 ? 'default' : 'pointer' }}>▲</button>
              <button onClick={() => move(i, 1)} disabled={i === items.length - 1}
                style={{ width:32, height:22, background:'none', border:'none', color:i === items.length - 1 ? C.border : C.muted, fontSize:12, cursor:i === items.length - 1 ? 'default' : 'pointer' }}>▼</button>
            </div>
            <button onClick={() => setDeleteTarget(item)}
              style={{ width:44, height:44, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:C.red+'18', border:`1px solid ${C.red}44`, color:C.red, fontSize:16, cursor:'pointer', flexShrink:0 }}>
              ✕
            </button>
          </div>
        ))}

        {items.length === 0 && (
          <div style={{ textAlign:'center', padding:'20px 0', color:C.muted, fontSize:13 }}>No checklist items yet — add one below.</div>
        )}

        <div style={{ display:'flex', gap:8, marginTop:16 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
            placeholder="e.g. Rally leads briefed, Formations locked…"
            style={{ flex:1, minHeight:48, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 14px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}
          />
          <button onClick={addItem} style={{ height:48, padding:'0 18px', borderRadius:10, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>
            ＋ Add
          </button>
        </div>
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          message={`Delete "${deleteTarget.name}" from the checklist?`}
          onConfirm={() => doDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
