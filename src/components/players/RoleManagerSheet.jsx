import { useState, useEffect } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newRoleDef } from '../../utils/roles.js';
import { SheetHandle } from '../common/Primitives.jsx';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal.jsx';

// ── RoleManagerSheet ─────────────────────────────────────────────
// Props:
//   open, onClose
//   roles            – full role list, builtin first (from useAppState)
//   onSaveCustomRoles – (customRoles[]) => void — replaces the custom list
//   players, onUpdatePlayers – needed so rename/delete can propagate to
//                              any player who already has that role set
export function RoleManagerSheet({ open, onClose, roles, onSaveCustomRoles, players, onUpdatePlayers }) {
  const customRoles = roles.filter(r => !r.builtin);
  const builtinRole = roles.find(r => r.builtin);

  const [drafts, setDrafts]         = useState({});
  const [newName, setNewName]       = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (!open) return;
    setDrafts(Object.fromEntries(customRoles.map(r => [r.id, r.name])));
    setNewName('');
  }, [open]);

  if (!open) return null;

  function addRole() {
    const name = newName.trim();
    if (!name) return;
    if (roles.some(r => r.name.toLowerCase() === name.toLowerCase())) return;
    onSaveCustomRoles([...customRoles, newRoleDef(name, customRoles.length)]);
    setNewName('');
    vibe(8);
  }

  function commitRename(role) {
    const trimmed = (drafts[role.id] || '').trim();
    if (!trimmed || trimmed === role.name) { setDrafts(prev => ({ ...prev, [role.id]: role.name })); return; }
    onSaveCustomRoles(customRoles.map(r => r.id === role.id ? { ...r, name: trimmed } : r));
    const affected = players.filter(p => p.roles?.includes(role.name));
    if (affected.length) {
      onUpdatePlayers(affected.map(p => ({ ...p, roles: p.roles.map(r => r === role.name ? trimmed : r) })));
    }
  }

  function move(idx, dir) {
    const next = [...customRoles];
    const [item] = next.splice(idx, 1);
    next.splice(idx + dir, 0, item);
    onSaveCustomRoles(next);
    vibe(6);
  }

  function doDelete(role) {
    onSaveCustomRoles(customRoles.filter(r => r.id !== role.id));
    const affected = players.filter(p => p.roles?.includes(role.name));
    if (affected.length) {
      onUpdatePlayers(affected.map(p => ({ ...p, roles: p.roles.filter(r => r !== role.name) })));
    }
    setDeleteTarget(null);
    vibe([20, 20, 20]);
  }

  const affectedCount = deleteTarget ? players.filter(p => p.roles?.includes(deleteTarget.name)).length : 0;

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:340, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'86vh', overflowY:'auto', padding:'16px 20px 40px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>Manage Roles</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Rally Lead is built into the app. Every other role is yours to define.</div>

        {/* Built-in role */}
        {builtinRole && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, background:C.section, marginBottom:8, border:`1px solid ${builtinRole.color}44` }}>
            <span style={{ fontSize:18 }}>{builtinRole.icon}</span>
            <div style={{ flex:1, fontSize:15, fontWeight:700, color:C.white }}>{builtinRole.name}</div>
            <span style={{ fontSize:11, fontWeight:700, color:builtinRole.color, background:builtinRole.color+'22', padding:'4px 10px', borderRadius:10 }}>Built-in</span>
          </div>
        )}

        {/* Custom roles */}
        {customRoles.map((role, i) => (
          <div key={role.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 8px 8px 14px', borderRadius:12, background:C.section, marginBottom:8 }}>
            <span style={{ fontSize:18, flexShrink:0 }}>{role.icon}</span>
            <input
              value={drafts[role.id] ?? role.name}
              onChange={e => setDrafts(prev => ({ ...prev, [role.id]: e.target.value }))}
              onBlur={() => commitRename(role)}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
              style={{ flex:1, minHeight:44, background:'none', border:'none', color:C.white, fontSize:15, fontWeight:600, fontFamily:'inherit', padding:'0 4px' }}
            />
            <div style={{ display:'flex', flexDirection:'column' }}>
              <button onClick={() => move(i, -1)} disabled={i === 0}
                style={{ width:32, height:22, background:'none', border:'none', color:i === 0 ? C.border : C.muted, fontSize:12, cursor:i === 0 ? 'default' : 'pointer' }}>▲</button>
              <button onClick={() => move(i, 1)} disabled={i === customRoles.length - 1}
                style={{ width:32, height:22, background:'none', border:'none', color:i === customRoles.length - 1 ? C.border : C.muted, fontSize:12, cursor:i === customRoles.length - 1 ? 'default' : 'pointer' }}>▼</button>
            </div>
            <button onClick={() => setDeleteTarget(role)}
              style={{ width:44, height:44, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:C.red+'18', border:`1px solid ${C.red}44`, color:C.red, fontSize:16, cursor:'pointer', flexShrink:0 }}>
              ✕
            </button>
          </div>
        ))}

        {customRoles.length === 0 && (
          <div style={{ textAlign:'center', padding:'20px 0', color:C.muted, fontSize:13 }}>No custom roles yet — add one below.</div>
        )}

        {/* Add role */}
        <div style={{ display:'flex', gap:8, marginTop:16 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addRole(); }}
            placeholder="e.g. Joiner, Garrison, Officer…"
            style={{ flex:1, minHeight:48, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 14px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}
          />
          <button onClick={addRole} style={{ height:48, padding:'0 18px', borderRadius:10, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>
            ＋ Add
          </button>
        </div>
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          message={affectedCount > 0
            ? `Delete "${deleteTarget.name}"? It will be removed from ${affectedCount} player${affectedCount !== 1 ? 's' : ''}.`
            : `Delete "${deleteTarget.name}"?`}
          onConfirm={() => doDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
