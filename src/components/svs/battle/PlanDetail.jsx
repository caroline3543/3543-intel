import { C } from '../../../utils/constants.js';
import { vibe } from '../../../utils/vibe.js';
import { newRallySlot } from '../../../data/playerSchema.js';
import { RALLY_ICONS } from './battleConstants.js';
import { RallySlotCard } from './RallySlotCard.jsx';

// ── PlanDetail ─────────────────────────────────────────────────
// The open-plan view: header, all rally slots, Go Live sticky bar.
// Props:
//   plan          – the active SvsPlan object
//   players       – full roster array
//   onUpdate      – (updatedPlan) => void
//   onBack        – () => void
//   onGoLive      – (plan) => void
//   onGoToMembers – () => void
//   maxGeneration – number from Settings
export function PlanDetail({ plan, players, onUpdate, onBack, onGoLive, onGoToMembers, maxGeneration = 6 }) {
  function updPlan(patch) { onUpdate({ ...plan, ...patch }); }

  function addSlot() {
    const type = (plan.rallySlots || []).length === 0 ? 'Main Rally' : 'Counter Rally';
    updPlan({ rallySlots:[...(plan.rallySlots || []), newRallySlot({ type })] });
    vibe(8);
  }

  function updSlot(updated) {
    updPlan({ rallySlots:(plan.rallySlots || []).map(s => s.id === updated.id ? updated : s) });
  }
  function delSlot(id) {
    updPlan({ rallySlots:(plan.rallySlots || []).filter(s => s.id !== id) });
  }
  function moveSlot(index, direction) {
    const slots  = [...(plan.rallySlots || [])];
    const target = index + direction;
    if (target < 0 || target >= slots.length) return;
    [slots[index], slots[target]] = [slots[target], slots[index]];
    updPlan({ rallySlots:slots });
  }

  const slots      = plan.rallySlots || [];
  const readySlots = slots.filter(s => s.leaderName);

  return (
    <div style={{ padding:'16px 20px 0', paddingBottom:readySlots.length > 0 ? 120 : 20 }}>
      {/* Back + breadcrumb */}
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:4, padding:0 }}>
        ← Battle Plans
      </button>
      <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>{plan.name || 'Battle Plan'}</div>

      {/* Plan header */}
      <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:C.white }}>{plan.name || 'Battle Plan'}</div>
            <div style={{ fontSize:13, color:C.muted }}>{plan.date}{plan.allianceTag ? ` · [${plan.allianceTag}]` : ''}</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {[['draft','Draft',C.muted],['live','🔴 Live',C.red],['completed','✓ Done',C.green]].map(([s,l,c]) => (
              <button key={s} onClick={() => updPlan({ status:s })}
                style={{ height:36, padding:'0 12px', borderRadius:14, border:`1px solid ${plan.status===s?c:C.border}`, background:plan.status===s?c+'22':C.section, color:plan.status===s?c:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={plan.notes || ''}
          onChange={e => updPlan({ notes:e.target.value })}
          placeholder="Strategy overview — target, objective, key timings…"
          style={{ width:'100%', minHeight:60, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}
        />
      </div>

      {/* Empty state */}
      {slots.length === 0 && (
        <div style={{ textAlign:'center', padding:'32px 20px', background:C.section, borderRadius:12, marginBottom:16 }}>
          <div style={{ fontSize:32, marginBottom:10 }}>⚔️</div>
          <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:6 }}>No rally slots yet</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Add a slot for each rally in this plan — main rally, counter, switch fight, etc.</div>
          <button onClick={addSlot} style={{ height:48, padding:'0 24px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>＋ Add first slot</button>
        </div>
      )}

      {slots.map((slot, i) => (
        <RallySlotCard
          key={slot.id}
          slot={slot}
          index={i}
          totalSlots={slots.length}
          players={players}
          onUpdate={updSlot}
          onDelete={delSlot}
          onMoveUp={() => moveSlot(i, -1)}
          onMoveDown={() => moveSlot(i, 1)}
          onGoToMembers={onGoToMembers}
          maxGeneration={maxGeneration}
        />
      ))}

      {slots.length > 0 && (
        <button onClick={addSlot} style={{ width:'100%', height:48, borderRadius:12, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', marginBottom:16 }}>
          ＋ Add rally slot
        </button>
      )}

      {/* Sticky Go Live bar */}
      {readySlots.length > 0 && (
        <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, background:C.bg, borderTop:`1px solid ${C.border}`, padding:'12px 20px 28px', boxSizing:'border-box', zIndex:50 }}>
          <button onClick={() => onGoLive(plan)} style={{ width:'100%', height:56, borderRadius:12, background:C.red, color:'#fff', fontWeight:800, fontSize:17, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            🔴 Go Live — {readySlots.length} slot{readySlots.length !== 1 ? 's' : ''}
            <span style={{ fontSize:13, fontWeight:400, opacity:0.8 }}>
              {readySlots.map(s => s.leaderName).join(' · ')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
