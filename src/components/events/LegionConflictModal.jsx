import { C } from '../../utils/constants.js';

export function LegionConflictModal({ legionModal, activeEvent, onConfirmSwap, onResolveConflict, onClose }) {
  if (!legionModal) return null;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:700, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, margin:'0 auto', padding:'20px 20px 28px' }}>
        <div style={{ fontSize:17, fontWeight:800, color:C.red, marginBottom:10 }}>⚠ Legion Conflict</div>
        {legionModal.mode === 'swap' ? (
          <>
            <div style={{ fontSize:14, color:C.white, marginBottom:20, lineHeight:1.5 }}>
              <strong>{legionModal.player.username || legionModal.player.alias}</strong> is currently in <strong>Legion {legionModal.sibling.legion}</strong> for this event. Are they switching to <strong>Legion {activeEvent?.legion}</strong>?
            </div>
            <button onClick={onConfirmSwap} style={{ width:'100%', height:50, borderRadius:12, background:C.gold, color:C.bg, fontWeight:800, fontSize:15, border:'none', cursor:'pointer', marginBottom:10 }}>
              Yes — move to Legion {activeEvent?.legion}
            </button>
            <button onClick={onClose} style={{ width:'100%', height:46, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:14, cursor:'pointer' }}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize:14, color:C.white, marginBottom:20, lineHeight:1.5 }}>
              <strong>{legionModal.player.username || legionModal.player.alias}</strong> is in <strong>both Legion 1 and Legion 2</strong> for this event. Which one should they actually be in?
            </div>
            <button onClick={() => onResolveConflict(activeEvent)} style={{ width:'100%', height:50, borderRadius:12, background:C.gold+'22', border:`1px solid ${C.gold}`, color:C.gold, fontWeight:700, fontSize:15, cursor:'pointer', marginBottom:8 }}>
              Keep in Legion {activeEvent?.legion} <span style={{ opacity:0.7 }}>(remove from Legion {legionModal.sibling.legion})</span>
            </button>
            <button onClick={() => onResolveConflict(legionModal.sibling)} style={{ width:'100%', height:50, borderRadius:12, background:C.gold+'22', border:`1px solid ${C.gold}`, color:C.gold, fontWeight:700, fontSize:15, cursor:'pointer', marginBottom:10 }}>
              Keep in Legion {legionModal.sibling.legion} <span style={{ opacity:0.7 }}>(remove from Legion {activeEvent?.legion})</span>
            </button>
            <button onClick={onClose} style={{ width:'100%', height:46, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:14, cursor:'pointer' }}>
              Decide later
            </button>
          </>
        )}
      </div>
    </div>
  );
}
