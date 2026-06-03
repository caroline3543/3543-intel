import { useRef, useState } from 'react';
import { C } from '../utils/constants.js';
import { SheetHandle } from './common/Primitives.jsx';

export function DataPanel({ data, onImport, onExport, onClose, showToast }) {
  const fileRef = useRef();
  const [mode, setMode] = useState('replace');
  const [msg, setMsg]   = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { importFromFile } = await import('../services/exportImportService.js');
      const imp = await importFromFile(file);
      onImport(imp, mode);
      setMsg({ text:'✓ Imported successfully', type:'success' });
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg({ text:`Failed: ${err.message}`, type:'error' });
      setTimeout(() => setMsg(null), 4000);
    }
    e.target.value = '';
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'16px 20px 60px', maxHeight:'80vh', overflowY:'auto' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>📦 Export / Import</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:22, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>

        {msg && (
          <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:16, background:msg.type==='error'?C.red+'18':C.green+'18', color:msg.type==='error'?C.red:C.green, fontSize:14, fontWeight:600 }}>
            {msg.text}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:20 }}>
          {[['Players',(data.players||[]).length],['Events',(data.events||[]).length],['Plans',(data.svsPlans||[]).length]].map(([l,v]) => (
            <div key={l} style={{ background:C.section, borderRadius:10, padding:12, textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:700, color:C.gold }}>{v}</div>
              <div style={{ fontSize:12, color:C.muted }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:6 }}>Export</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>Downloads all your data as a JSON file.</div>
          <button onClick={onExport} style={{ width:'100%', height:48, borderRadius:10, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>
            ⬇️ Download JSON
          </button>
        </div>

        <div style={{ background:C.section, borderRadius:12, padding:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:6 }}>Import</div>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            {[['replace','Replace all'],['merge','Merge']].map(([v,l]) => (
              <button key={v} onClick={() => setMode(v)} style={{ flex:1, height:40, borderRadius:10, border:`1px solid ${mode===v?C.gold:C.border}`, background:mode===v?C.gold+'22':C.card, color:mode===v?C.gold:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                {l}
              </button>
            ))}
          </div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
            {mode === 'replace' ? '⚠️ Replaces all existing data.' : 'Merges new data with existing by ID.'}
          </div>
          <input type="file" accept=".json" ref={fileRef} onChange={handleFile} style={{ display:'none' }} />
          <button onClick={() => fileRef.current?.click()} style={{ width:'100%', height:48, borderRadius:10, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:700, fontSize:15, cursor:'pointer' }}>
            ⬆️ Choose JSON File
          </button>
        </div>
      </div>
    </div>
  );
}
