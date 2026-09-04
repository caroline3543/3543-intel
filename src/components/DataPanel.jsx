import { useRef, useState } from 'react';
import { C, JOINER_COVERAGE_EVENTS } from '../utils/constants.js';
import { SheetHandle } from './common/Primitives.jsx';
import { exportWorkbook, exportRosterCsv } from '../services/exportXlsx.js';
import { importFromXlsxFile } from '../services/xlsxImportService.js';
import { importFromFile } from '../services/exportImportService.js';

function formatSyncTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}

export function DataPanel({
  data, onImport, onExport, onClose, showToast,
  syncFromCloud, syncStatus, lastSyncedAt, isCloudConfigured,
}) {
  const fileRef = useRef();
  const [mode, setMode]         = useState('replace');
  const [msg, setMsg]           = useState(null);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [includeRoster, setIncludeRoster] = useState(true);
  const [includeEvents, setIncludeEvents] = useState(true);
  const [includePlans, setIncludePlans]   = useState(true);
  const [scopeEventId, setScopeEventId]   = useState(''); // '' = all events
  const [selectedAllianceTags, setSelectedAllianceTags] = useState([]); // [] = every alliance

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const isXlsx = /\.xlsx$/i.test(file.name);
      const imp = isXlsx ? await importFromXlsxFile(file) : await importFromFile(file);
      onImport(imp, mode);
      setMsg({ text: `✓ Imported from ${isXlsx ? 'spreadsheet' : 'JSON'} successfully`, type:'success' });
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg({ text:`Failed: ${err.message}`, type:'error' });
      setTimeout(() => setMsg(null), 4000);
    }
    setImporting(false);
    e.target.value = '';
  }

  async function handleXlsxExport() {
    setXlsxLoading(true);
    try {
      exportWorkbook(data, {
        includeRoster,
        rosterAllianceTags: selectedAllianceTags.length ? selectedAllianceTags : null,
        includeEvents,
        includePlans,
        eventId: scopeEventId || null,
      });
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

  function handleCsvExport() {
    try {
      exportRosterCsv(data, {
        rosterAllianceTags: selectedAllianceTags.length ? selectedAllianceTags : null,
      });
      showToast('Roster CSV downloaded ✓');
      onClose();
    } catch (err) {
      console.error(err);
      setMsg({ text:`CSV export failed: ${err.message}`, type:'error' });
      setTimeout(() => setMsg(null), 5000);
    }
  }

  const eventCount    = (data.events||[]).length;
  const memberCount   = (data.players||[]).length;
  const hasJoiners    = (data.players||[]).some(p=>(p.joinerHeroes||[]).some(jh=>jh.skillLevel>=5));
  const syncing       = syncStatus === 'syncing';

  // What the export will actually contain, given the current toggles
  // and event scope — "battle plans due a specific event only" scopes
  // both events and plans together, since a plan links to an event via
  // plan.eventId.
  const scopedEvents      = scopeEventId ? (data.events||[]).filter(e => e.id === scopeEventId) : (data.events||[]);
  const scopedPlans       = scopeEventId ? (data.svsPlans||[]).filter(p => p.eventId === scopeEventId) : (data.svsPlans||[]);
  const scopedJoinerEvents = scopedEvents.filter(e => JOINER_COVERAGE_EVENTS.includes(e.type));
  const nothingSelected   = !includeRoster && !includeEvents && !includePlans;

  // Alliance filter for the roster — "export one alliance or more than
  // one". Empty selection means no filter, every alliance included.
  const allAllianceTags = [...new Set((data.players||[]).map(p => p.allianceTag).filter(Boolean))].sort();
  const scopedRosterPlayers = selectedAllianceTags.length
    ? (data.players||[]).filter(p => selectedAllianceTags.includes(p.allianceTag))
    : (data.players||[]);
  function toggleAllianceTag(tag) {
    setSelectedAllianceTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

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

        {/* ── Cloud Sync — manual only, no realtime ── */}
        <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <span style={{ fontSize:24 }}>🔄</span>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:C.white }}>Cloud Sync</div>
              <div style={{ fontSize:12, color:C.muted }}>
                {!isCloudConfigured
                  ? 'Not set up for this install'
                  : lastSyncedAt
                    ? `Last synced ${formatSyncTime(lastSyncedAt)}`
                    : 'Never synced on this device'}
              </div>
            </div>
          </div>

          {isCloudConfigured ? (
            <>
              {syncStatus === 'error' && (
                <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:10, background:C.red+'18', color:C.red, fontSize:12, fontWeight:600 }}>
                  Sync failed — check your connection and try again.
                </div>
              )}
              <button
                onClick={syncFromCloud}
                disabled={syncing}
                style={{ width:'100%', height:48, borderRadius:10, background:syncing?C.card:C.gold, border:syncing?`1px solid ${C.border}`:'none', color:syncing?C.muted:C.bg, fontWeight:700, fontSize:14, cursor:syncing?'default':'pointer', opacity:syncing?0.8:1 }}
              >
                {syncing ? 'Syncing…' : '🔄 Sync now'}
              </button>
              <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>Pulls the latest roster and battle plans from the cloud and merges them in — nothing local gets deleted.</div>
            </>
          ) : (
            <div style={{ fontSize:12, color:C.muted }}>Ask whoever set up this alliance's account to share cloud sync access.</div>
          )}
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

          {/* What to include */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>What to include</div>
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              {[
                ['Roster', includeRoster, setIncludeRoster],
                ['Events', includeEvents, setIncludeEvents],
                ['Battle Plans', includePlans, setIncludePlans],
              ].map(([label, val, setter]) => (
                <button key={label} onClick={() => setter(!val)}
                  style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${val?C.gold:C.border}`, background:val?C.gold+'22':C.card, color:val?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                  {val?'✓ ':''}{label}
                </button>
              ))}
            </div>
            {(includeEvents || includePlans) && eventCount > 0 && (
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>Scope events &amp; battle plans to:</div>
                <select value={scopeEventId} onChange={e => setScopeEventId(e.target.value)}
                  style={{ width:'100%', height:40, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'0 10px', fontSize:13, color:C.white, fontFamily:'inherit' }}>
                  <option value="">All events</option>
                  {(data.events||[]).map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name || ev.type} · {ev.date}</option>
                  ))}
                </select>
              </div>
            )}
            {includeRoster && allAllianceTags.length > 1 && (
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>Scope roster to alliance{selectedAllianceTags.length!==1?'(s)':''} — none selected means all:</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {allAllianceTags.map(tag => {
                    const sel = selectedAllianceTags.includes(tag);
                    return (
                      <button key={tag} onClick={() => toggleAllianceTag(tag)}
                        style={{ padding:'6px 12px', borderRadius:16, background:sel?C.gold+'22':C.card, border:`1px solid ${sel?C.gold:C.border}`, color:sel?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                        {sel?'✓ ':''}[{tag}]
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* What's included */}
          <div style={{ background:C.bg, borderRadius:10, padding:12, marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>What's included</div>
            {[
              includeRoster ? ['✓', `${scopedRosterPlayers.length} member${scopedRosterPlayers.length!==1?'s':''} — name, alliance, troop tiers${selectedAllianceTags.length ? ` (${selectedAllianceTags.map(t=>`[${t}]`).join(', ')})` : ''}`, C.green] : null,
              includeRoster && hasJoiners ? ['✓', 'Includes joiner hero coverage (✓ per hero) right in the roster', C.green] : null,
              includeEvents && scopedEvents.length > 0 ? ['✓', `${scopedEvents.length} event${scopedEvents.length!==1?'s':''} — attendance, Discord, performance`, C.green] : null,
              includeEvents && scopedJoinerEvents.length > 0 ? ['✓', `${scopedJoinerEvents.length} Castle event${scopedJoinerEvents.length!==1?'s':''} include joiner coverage columns`, C.gold] : null,
              includePlans && scopedPlans.length > 0 ? ['✓', `${scopedPlans.length} battle plan${scopedPlans.length!==1?'s':''}`, C.green] : null,
              nothingSelected ? ['⚠', 'Nothing selected — pick at least one above', C.red] : ['✓', 'Can be re-imported on another device — nothing is lost round-tripping', C.icy],
            ].filter(Boolean).map(([icon, text, color], i) => (
              <div key={i} style={{ display:'flex', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:12, color, flexShrink:0 }}>{icon}</span>
                <span style={{ fontSize:12, color:C.icy }}>{text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleXlsxExport}
            disabled={xlsxLoading || nothingSelected}
            style={{ width:'100%', height:52, borderRadius:12, background:nothingSelected?C.card:C.gold, color:nothingSelected?C.muted:C.bg, fontWeight:700, fontSize:16, border:nothingSelected?`1px solid ${C.border}`:'none', cursor:(xlsxLoading||nothingSelected)?'default':'pointer', opacity:xlsxLoading?0.7:1 }}
          >
            {xlsxLoading ? 'Preparing…' : '⬇️ Download .xlsx'}
          </button>

          <div style={{ fontSize:11, color:C.muted, marginTop:10, marginBottom:6 }}>
            .xlsx not opening? A plain CSV has none of the multi-sheet/styling complexity that can go wrong — just the roster table, works everywhere.
          </div>
          <button
            onClick={handleCsvExport}
            style={{ width:'100%', height:44, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:700, fontSize:14, cursor:'pointer' }}
          >
            ⬇️ Download roster as .csv
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
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>Accepts either a JSON backup or an .xlsx spreadsheet exported from this app (uses its hidden "…Data" sheets — the pretty report sheets alone can't be re-imported).</div>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            {[['replace','Replace all'],['merge','Merge — newest edit wins']].map(([v,l]) => (
              <button key={v} onClick={() => setMode(v)} style={{ flex:1, height:40, borderRadius:10, border:`1px solid ${mode===v?C.gold:C.border}`, background:mode===v?C.gold+'22':C.card, color:mode===v?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                {l}
              </button>
            ))}
          </div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
            {mode === 'replace' ? '⚠️ Replaces all existing data.' : 'Merges with existing data record by record — whichever side was edited more recently wins, nothing is deleted.'}
          </div>
          <input type="file" accept=".json,.xlsx" ref={fileRef} onChange={handleFile} style={{ display:'none' }} />
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            style={{ width:'100%', height:44, borderRadius:10, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:700, fontSize:14, cursor:importing?'default':'pointer', opacity:importing?0.7:1 }}>
            {importing ? 'Importing…' : '⬆️ Choose JSON or .xlsx file'}
          </button>
        </div>
      </div>
    </div>
  );
}
