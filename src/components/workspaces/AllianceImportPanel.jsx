import { PlayerAvatar } from '../players/PlayerAvatar.jsx';
import { profileChanges, providerFurnaceLevel } from '../../services/providerProfileService.js';
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
    try { onImport(rows); onClose(); }
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
        <p style={{ color:C.gold }}>{rows.length} players · {newRows.length} new · {rows.length-newRows.length} profiles to update</p>
        <p style={{ color:C.icy, fontSize:13 }}>Updates matching FIDs with the supplied name, alliance, rank, power, kills and furnace level. Missing values keep their current values. Notes, troops, heroes and event history are preserved. All fetched fields are saved in each profile.</p>
        <button style={{ ...button, width:'100%', marginBottom:12 }} disabled={!rows.length} onClick={importRows}>Update {rows.length-newRows.length} profiles & add {newRows.length} · State {stateId}</button>
        {!rows.length && <p>No players returned. Check the alliance tag and state.</p>}
        {rows.map(row => <article key={row.fid} style={{ padding:'12px 0', borderBottom:`1px solid ${C.border}` }}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,verticalAlign:'middle',marginRight:8}}><PlayerAvatar player={{username:row.username,avatarUrl:row.avatarUrl}} size={32}/><strong>{row.username || row.fid}</strong></div> <span style={{ color:existing.has(row.fid)?C.muted:C.green }}>{existing.has(row.fid)?'Update profile':'New'}</span>
          <div style={{ color:C.icy, fontSize:12, marginTop:5 }}>FID {row.fid} · [{row.allianceTag}] · State {stateId}</div>
          <div style={{ fontSize:13, marginTop:5 }}>Power {fmt(row.power)} · Kills {fmt(row.kills)} · Furnace {providerFurnaceLevel(row.furnaceLabel) || providerFurnaceLevel(row.furnaceLevel) || row.furnaceLevel || '—'}</div>
          {existing.has(row.fid) && <div style={{fontSize:12,color:C.gold,marginTop:6}}>{profileChanges(players.find(p=>String(p.fid).trim()===row.fid),row).map(c=>c.field === 'avatarUrl' ? 'Profile picture updated' : `${c.field}: ${c.before ?? 'unset'} → ${c.after}`).join(' · ') || 'Refresh fetched details'}</div>}
        </article>)}
      </>}
    </section>
  </div>;
}
