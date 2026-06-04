import { useRef, useState } from 'react';
import { C } from '../utils/constants.js';
import { SheetHandle } from './common/Primitives.jsx';
import { exportWorkbook } from '../services/exportXlsx.js';

export function DataPanel({ data, onImport, onExport, onClose, showToast }) {
  const fileRef = useRef();
  const [mode, setMode]         = useState('replace');
  const [msg, setMsg]           = useState(null);
  const [xlsxLoading, setXlsxLoading] = useState(false);

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

  async function handleXlsxExport() {
    setXlsxLoading(true);
    try {
      exportWorkbook(data);
      showToast('Spreadsheet downloaded ✓');
      onClose();
    } catch (err) {
      console.error(err);
      setMsg({ text:`Spreadsheet export failed: ${err.message}`, type:'error' });
      setTimeout(() => setMsg(null), 5000);
    } finally {
      setXlsxLoading(false);
    }
  }

  const eventCount    = (data.events||[]).length;
  const memberCount   = (data.players||[]).length;
  const hasJoiners    = (data.players||[]).some(p=>(p.joinerHeroes||[]).some(jh=>jh.skillLevel>=5));
  const joinerEvents  = (data.events||[]).filter(e=>['SvS','SvS Castle Battle','Internal Sunfire Castle'].includes(e.type));

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'16px 20px 60px', maxHeight:'86vh', overflowY:'auto' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>📦 Export & Import</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>

        {msg && (
          <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:16, background:msg.type==='error'?C.red+'18':C.green+'18', color:msg.type==='error'?C.red:C.green, fontSize:14, fontWeight:600 }}>
            {msg.text}
          </div>
        )}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:20 }}>
          {[['Members',memberCount],['Events',eventCount],['Plans',(data.svsPlans||[]).length]].map(([l,v]) => (
            <div key={l} style={{ background:C.section, borderRadius:10, padding:12, textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:700, color:C.gold }}>{v}</div>
              <div style={{ fontSize:12, color:C.muted }}>{l}</div>
            </div>
          ))}
        </div>

        {/* ── Spreadsheet Export — primary action ── */}
        <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{ fontSize:24 }}>📊</span>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:C.white }}>Export to Spreadsheet</div>
              <div style={{ fontSize:12, color:C.muted }}>Opens in Excel, Google Sheets, and Numbers</div>
            </div>
          </div>

          {/* What's included */}
          <div style={{ background:C.bg, borderRadius:10, padding:12, marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>What's included</div>
            {[
              ['✓', `${memberCount} members — troops, furnace, roles, heroes`, C.green],
              ['✓', 'Joiner Coverage — who owns each hero at Skill 5', C.green],
              (data.prepScores||[]).length > 0 ? ['✓', `Prep Scores — ${(data.prepScores||[]).length} entries`, C.green] : null,
              eventCount > 0 ? ['✓', `${eventCount} event${eventCount!==1?'s':''} — attendance, Discord, performance`, C.green] : null,
              joinerEvents.length > 0 ? ['✓', `${joinerEvents.length} SvS/Castle event${joinerEvents.length!==1?'s':''} include joiner coverage columns`, C.gold] : null,
            ].filter(Boolean).map(([icon, text, color], i) => (
              <div key={i} style={{ display:'flex', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:12, color, flexShrink:0 }}>{icon}</span>
                <span style={{ fontSize:12, color:C.icy }}>{text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleXlsxExport}
            disabled={xlsxLoading}
            style={{ width:'100%', height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:16, border:'none', cursor:xlsxLoading?'default':'pointer', opacity:xlsxLoading?0.7:1 }}
          >
            {xlsxLoading ? 'Preparing…' : '⬇️ Download .xlsx'}
          </button>
        </div>

        {/* ── JSON Export — for backups / sharing with other officers ── */}
        <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:4 }}>Backup / Share (JSON)</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>Full data backup. Import into another device or share with an officer.</div>
          <button onClick={onExport} style={{ width:'100%', height:44, borderRadius:10, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:700, fontSize:14, cursor:'pointer' }}>
            ⬇️ Download JSON backup
          </button>
        </div>

        {/* ── Import ── */}
        <div style={{ background:C.section, borderRadius:12, padding:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:8 }}>Import</div>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            {[['replace','Replace all'],['merge','Merge']].map(([v,l]) => (
              <button key={v} onClick={() => setMode(v)} style={{ flex:1, height:40, borderRadius:10, border:`1px solid ${mode===v?C.gold:C.border}`, background:mode===v?C.gold+'22':C.card, color:mode===v?C.gold:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                {l}
              </button>
            ))}
          </div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
            {mode === 'replace' ? '⚠️ Replaces all existing data.' : 'Merges with existing data by ID — nothing is deleted.'}
          </div>
          <input type="file" accept=".json" ref={fileRef} onChange={handleFile} style={{ display:'none' }} />
          <button onClick={() => fileRef.current?.click()} style={{ width:'100%', height:44, borderRadius:10, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:700, fontSize:14, cursor:'pointer' }}>
            ⬆️ Choose JSON file
          </button>
        </div>
      </div>
    </div>
  );
}
