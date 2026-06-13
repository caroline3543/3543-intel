import { useState, useEffect } from 'react';
import { C } from '../../../utils/constants.js';
import { vibe } from '../../../utils/vibe.js';
import { newSvsPlan } from '../../../data/playerSchema.js';
import { SheetHandle, Field } from '../../common/Primitives.jsx';
import { AlliancePicker } from '../../common/AlliancePicker.jsx';
import { DeleteConfirmModal } from '../../common/DeleteConfirmModal.jsx';
import { RALLY_ICONS } from './battleConstants.js';

// ── PlanCreateSheet ────────────────────────────────────────────
// Bottom-sheet form to create a new battle plan.
function PlanCreateSheet({ open, onClose, onSave, existingTags }) {
  const [name, setName]       = useState('');
  const [allianceTag, setTag] = useState('');
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    function h(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  function save() {
    onSave(newSvsPlan({ name: name || 'Battle Plan', allianceTag, date }));
    setName(''); setTag(''); setDate(new Date().toISOString().slice(0, 10));
    onClose(); vibe(8);
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'16px 20px 80px' }}>
        <SheetHandle/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>New Battle Plan</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>
        <Field label="Plan name">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SvS Week 3 Defence"
            style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
        </Field>
        <Field label="Alliance">
          <AlliancePicker value={allianceTag} onChange={setTag} existingTags={existingTags}/>
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
        </Field>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={save} style={{ flex:2, height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Create Plan</button>
        </div>
      </div>
    </div>
  );
}

// ── PlanList ───────────────────────────────────────────────────
// The top-level plan list view with create / duplicate / delete.
// Props:
//   plans          – SvsPlan[]
//   onSelectPlan   – (planId) => void
//   onCreatePlan   – (plan) => void
//   onDuplicate    – (plan) => void
//   onDelete       – (planId) => void
//   onOpenLiveRoom – () => void  (open Live Room without a plan)
//   existingTags   – string[]
//   showToast      – (msg) => void
export function PlanList({ plans, onSelectPlan, onCreatePlan, onDuplicate, onDelete, onOpenLiveRoom, existingTags, showToast }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  function handleDelete(id) {
    onDelete(id);
    setDeleteTarget(null);
    showToast('Plan deleted');
  }

  function handleDuplicate(plan) {
    onDuplicate(plan);
    showToast('Plan duplicated ✓');
    vibe(8);
  }

  return (
    <div style={{ padding:'16px 20px 0' }}>
      {/* Dev banner */}
      <div style={{ background:'#2A1800', border:`1px solid ${C.gold}44`, borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:18, flexShrink:0 }}>🚧</span>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:C.gold }}>Battle Planning — Under Development</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>Formation suggestions, joiner assignments and troop filtering are being actively built. Some features may be incomplete.</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <button onClick={() => setCreateOpen(true)} style={{ flex:2, height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>＋ New Plan</button>
        <button onClick={onOpenLiveRoom} style={{ flex:1, height:52, borderRadius:12, background:C.red+'22', border:`1px solid ${C.red}44`, color:C.red, fontWeight:700, fontSize:14, cursor:'pointer' }}>🔴 Live Room</button>
      </div>

      {plans.length === 0 && (
        <div style={{ textAlign:'center', padding:'40px 20px' }}>
          <div style={{ fontSize:52, marginBottom:16 }}>⚔️</div>
          <div style={{ fontSize:18, fontWeight:700, color:C.white, marginBottom:8 }}>No plans yet</div>
          <div style={{ fontSize:15, color:C.muted, marginBottom:24 }}>Build your rally assignments before the battle. Assign leaders, joiners, and heroes. Then go live.</div>
          <button onClick={() => setCreateOpen(true)} style={{ height:52, padding:'0 32px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>＋ Create first plan</button>
        </div>
      )}

      {plans.map(plan => {
        const slots   = plan.rallySlots || [];
        const leaders = slots.filter(s => s.leaderName).map(s => `${RALLY_ICONS[s.type] || '⚔️'} ${s.leaderName}`);
        return (
          <div key={plan.id} onClick={() => onSelectPlan(plan.id)}
            style={{ background:C.card, borderRadius:12, padding:'14px 16px', marginBottom:10, cursor:'pointer', border:`1px solid ${plan.status==='live'?C.red+'66':C.border+'44'}`, WebkitTapHighlightColor:'transparent' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:16, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{plan.name || 'Battle Plan'}</div>
                <div style={{ fontSize:12, color:C.muted }}>{plan.date}{plan.allianceTag ? ` · [${plan.allianceTag}]` : ''}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0, marginLeft:10 }}>
                <span style={{ fontSize:11, fontWeight:700, color:plan.status==='live'?C.red:plan.status==='completed'?C.green:C.muted, padding:'2px 8px', borderRadius:10, background:(plan.status==='live'?C.red:plan.status==='completed'?C.green:C.muted)+'18' }}>
                  {plan.status==='live' ? '🔴 Live' : plan.status==='completed' ? '✓ Done' : 'Draft'}
                </span>
                <div style={{ display:'flex', gap:12 }}>
                  <button onClick={e => { e.stopPropagation(); handleDuplicate(plan); }}
                    style={{ fontSize:11, color:C.icy, background:'none', border:'none', cursor:'pointer', padding:0 }}>Duplicate</button>
                  <button onClick={e => { e.stopPropagation(); setDeleteTarget(plan.id); }}
                    style={{ fontSize:11, color:C.red+'88', background:'none', border:'none', cursor:'pointer', padding:0 }}>Delete</button>
                </div>
              </div>
            </div>
            {leaders.length > 0 ? (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:4 }}>
                {leaders.map((l, i) => (
                  <span key={i} style={{ fontSize:12, padding:'2px 8px', borderRadius:8, background:C.section, color:C.icy, fontWeight:600 }}>{l}</span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize:12, color:C.muted }}>No leaders assigned yet</div>
            )}
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
              {slots.reduce((acc, s) => acc + s.joiners.filter(j => j.playerName && j.heroName).length, 0)} joiner assignments
            </div>
          </div>
        );
      })}

      <PlanCreateSheet open={createOpen} onClose={() => setCreateOpen(false)} onSave={onCreatePlan} existingTags={existingTags}/>

      {deleteTarget && (
        <DeleteConfirmModal
          message={`Delete "${plans.find(p => p.id === deleteTarget)?.name || 'this plan'}"? All rally slots and joiner assignments will be lost.`}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
