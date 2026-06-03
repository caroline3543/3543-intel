import { C } from '../../utils/constants.js';

export function DeleteConfirmModal({ message, onConfirm, onCancel }) {
  if (!onConfirm) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'#000b', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:C.card, borderRadius:16, padding:24, width:'100%', maxWidth:320 }}>
        <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:8 }}>Are you sure?</div>
        <div style={{ fontSize:14, color:C.muted, marginBottom:20 }}>{message || "This can't be undone."}</div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onCancel} style={{ flex:1, height:48, borderRadius:10, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:15, cursor:'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ flex:1, height:48, borderRadius:10, background:C.red, color:C.white, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
