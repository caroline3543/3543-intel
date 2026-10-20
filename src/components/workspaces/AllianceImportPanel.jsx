import { useState } from 'react';
import { fetchMightpulseAlliance } from '../../services/mightpulseService.js';
import { allianceRows } from '../../services/allianceImportService.js';
import { C } from '../../utils/constants.js';
const button = { minHeight:44, border:0, borderRadius:10, padding:'10px 14px', background:C.gold, color:C.bg, fontWeight:700, cursor:'pointer' };
const fmt = value => value === null ? '—' : Number(value).toLocaleString('en-US');
export function AllianceImportPanel({ stateId, players, onImport, onClose }) {
  const [tag, setTag] = useState('');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const existing = new Set(players.filter(p => p.fid).map(p => String(p.fid).trim()));
  const newRows = (rows || []).filter(row => !existing.has(row.fid));
  async function lookup(e) {
    e.preventDefault(); setBusy(true); setError(''); setRows(null);
    try {
      const response = await fetchMightpulseAlliance(Number(stateId), tag.trim());
      setRows(allianceRows(response, stateId, tag));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function importRows() {
    try { onImport(newRows); onClose(); }
    catch (e) { setError(e.message); }
  }
  return <div style={{ position:'fixed', inset:0, background:C.bg+'ee', zIndex:350, overflowY:'auto' }}>
    <section role="dialog" aria-modal="true" aria-labelledby="alliance-import-title" style={{ maxWidth:440, margin:'0 auto', padding:20, color:C.white }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2 id="alliance-import-title" style={{ fontSize:19 }}>Pull alliance · State {stateId}</h2>
        <button onClick={onClose} style={{ ...button, background:C.card, color:C.white }} aria-label="Close alliance import">✕</button>
      </div>
      <p style={{ color:C.icy, fontSize:13 }}>Sign in through Settings → Admin access first. Enter any alliance tag in this state. Check the preview, then import.</p>
      <form onSubmit={lookup}>
        <label htmlFor="alliance-tag">Alliance tag (case sensitive)</label>
        <input id="alliance-tag" value={tag} disabled={busy} onChange={e => { setTag(e.target.value); setRows(null); }} placeholder="e.g. LUN" required maxLength={12}
          style={{ boxSizing:'border-box', width:'100%', minHeight:48, margin:'8px 0', padding:12, background:C.section, color:C.white, border:`1px solid ${C.border}`, borderRadius:10, fontSize:16 }} />
        <button style={{ ...button, width:'100%' }} disabled={busy || !tag.trim()}>{busy ? 'Fetching roster…' : 'Preview alliance stats'}</button>
      </form>
      {error && <p role="alert" style={{ color:C.red }}>{error}</p>}
      {rows && <>
        <p style={{ color:C.gold }}>{rows.length} players · {newRows.length} new · {rows.length-newRows.length} existing kept unchanged</p>
        <p style={{ color:C.icy, fontSize:13 }}>Existing records are never overwritten or removed. New players include a separate provider stats snapshot. Numeric furnace codes are kept in that snapshot for review.</p>
        <button style={{ ...button, width:'100%', marginBottom:12 }} disabled={!newRows.length} onClick={importRows}>Import {newRows.length} new players into State {stateId}</button>
        {!rows.length && <p>No players returned. Check the alliance tag and state.</p>}
        {rows.map(row => <article key={row.fid} style={{ padding:'12px 0', borderBottom:`1px solid ${C.border}` }}>
          <strong>{row.username || row.fid}</strong> <span style={{ color:existing.has(row.fid)?C.muted:C.green }}>{existing.has(row.fid)?'Kept unchanged':'New'}</span>
          <div style={{ color:C.icy, fontSize:12, marginTop:5 }}>FID {row.fid} · [{row.allianceTag}] · State {stateId}</div>
          <div style={{ fontSize:13, marginTop:5 }}>Power {fmt(row.power)} · Kills {fmt(row.kills)} · Furnace {row.furnaceLevel ?? '—'}</div>
        </article>)}
      </>}
    </section>
  </div>;
}
