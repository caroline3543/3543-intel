import { PlayerAvatar } from '../players/PlayerAvatar.jsx';
import { profileChanges, providerFurnaceLevel } from '../../services/providerProfileService.js';
import { useState } from 'react';
import { fetchMightpulseAlliance } from '../../services/mightpulseService.js';
import { allianceRows } from '../../services/allianceImportService.js';
import { C } from '../../utils/constants.js';
const button = { minHeight:44, border:0, borderRadius:10, padding:'10px 14px', background:C.gold, color:C.bg, fontWeight:700, cursor:'pointer' };
const fmt = value => value === null ? '—' : Number(value).toLocaleString('en-US');
export function AllianceImportPanel({ stateId, players, onImport, onClose }) {
  const tags=[...new Set(players.map(p=>p.allianceTag).filter(Boolean))].sort();
  const [tag, setTag] = useState(tags.length===1?tags[0]:'');
  const [result,setResult]=useState(null);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const existing = new Set(players.filter(p => p.fid).map(p => String(p.fid).trim()));
  const newRows = (rows || []).filter(row => !existing.has(row.fid));
  async function lookup(e) {
    e.preventDefault(); setBusy(true); setError(''); setRows(null); setResult(null);
    try {
      const response = await fetchMightpulseAlliance(Number(stateId), tag.trim());
      setRows(allianceRows(response, stateId, tag));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function importRows() {
    try { const summary=onImport(rows); setResult(summary || {updated:rows.length-newRows.length,added:newRows.length}); setRows(null); }
    catch (e) { setError(e.message); }
  }
  return <div style={{ position:'fixed', inset:0, background:C.bg+'ee', zIndex:350, overflowY:'auto' }}>
    <section role="dialog" aria-modal="true" aria-labelledby="alliance-import-title" style={{ maxWidth:440, margin:'0 auto', padding:20, color:C.white }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2 id="alliance-import-title" style={{ fontSize:19 }}>Load or refresh · State {stateId}</h2>
        <button onClick={onClose} style={{ ...button, background:C.card, color:C.white }} aria-label="Close alliance import">✕</button>
      </div>
      <p style={{ color:C.icy, fontSize:13 }}>Choose an alliance to load or refresh. Review the results before saving.</p>
      <form onSubmit={lookup}>
        {tags.length>0 && <label style={{display:'block',marginBottom:12,color:C.icy}}>Loaded alliance
          <select aria-label="Loaded alliance" value={tags.includes(tag)?tag:''} disabled={busy} onChange={e=>{setTag(e.target.value);setRows(null);setResult(null);}} style={{width:'100%',minHeight:44,fontSize:16,padding:10,background:C.section,color:C.white,border:`1px solid ${C.border}`,borderRadius:10,marginTop:6}}><option value="">Another alliance</option>{tags.map(value=><option key={value} value={value}>{value}</option>)}</select>
        </label>}
        <label htmlFor="alliance-tag">Alliance tag (case sensitive)</label>
        <input id="alliance-tag" value={tag} disabled={busy} onChange={e => { setTag(e.target.value); setRows(null); setResult(null); }} placeholder="e.g. LUN" required maxLength={12}
          style={{ boxSizing:'border-box', width:'100%', minHeight:48, margin:'8px 0', padding:12, background:C.section, color:C.white, border:`1px solid ${C.border}`, borderRadius:10, fontSize:16 }} />
        <button style={{ ...button, width:'100%' }} disabled={busy || !tag.trim()}>{busy ? 'Fetching roster…' : 'Preview roster'}</button>
      </form>
      {busy && <p role="status" style={{color:C.icy,fontSize:14}}>Fetching [{tag}] in State {stateId}…</p>}
      {result && <div role="status" style={{padding:14,background:C.card,borderRadius:10,marginTop:14}}><strong>{result.updated} players updated · {result.added} added</strong><p style={{color:C.icy,fontSize:14}}>Saved to this roster. Notes, assignments and event history were preserved.</p><button style={{...button,width:'100%'}} onClick={onClose}>Done</button></div>}
      {error && <p role="alert" style={{ color:C.red }}>{error}</p>}
      {rows && <>
        <p style={{ color:C.gold }}>{rows.length} players · {newRows.length} new · {rows.length-newRows.length} profiles to update</p>
        <p style={{ color:C.icy, fontSize:13 }}>Matches players by ID and updates available game data. Notes, troop records, heroes, assignments and event history are kept. Missing game data does not erase saved values.</p>
        <button style={{ ...button, width:'100%', marginBottom:12 }} disabled={!rows.length} onClick={importRows}>Save roster · {rows.length} players</button>
        {!rows.length && <p>No players returned. Check the alliance tag and state.</p>}
        {rows.map(row => <article key={row.fid} style={{ padding:'12px 0', borderBottom:`1px solid ${C.border}` }}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,verticalAlign:'middle',marginRight:8}}><PlayerAvatar player={{username:row.username,avatarUrl:row.avatarUrl}} size={32}/><strong>{row.username || row.fid}</strong></div> <span style={{ color:existing.has(row.fid)?C.muted:C.green }}>{existing.has(row.fid)?'Update profile':'New'}</span>
          <div style={{ color:C.icy, fontSize:12, marginTop:5 }}>ID {row.fid} · [{row.allianceTag}] · State {stateId}</div>
          <div style={{ fontSize:13, marginTop:5 }}>Power {fmt(row.power)} · Kills {fmt(row.kills)} · Furnace {providerFurnaceLevel(row.furnaceLabel) || providerFurnaceLevel(row.furnaceLevel) || row.furnaceLevel || '—'}</div>
          {existing.has(row.fid) && <div style={{fontSize:12,color:C.gold,marginTop:6}}>{profileChanges(players.find(p=>String(p.fid).trim()===row.fid),row).map(c=>c.field === 'avatarUrl' ? 'Profile picture updated' : `${c.field}: ${c.before ?? 'unset'} → ${c.after}`).join(' · ') || 'Refresh fetched details'}</div>}
        </article>)}
      </>}
    </section>
  </div>;
}
