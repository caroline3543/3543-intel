import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { calcMetrics } from '../../data/metrics.js';
import { newLabyrinthEntry } from '../../data/playerSchema.js';
import { ReliabilityBadge } from '../common/Primitives.jsx';
import JoinerRegistry from '../JoinerRegistry.jsx';
import NoticeLibrary from '../notices/NoticeLibrary.jsx';
import AsciiArtLibrary from '../ascii/AsciiArtLibrary.jsx';

// ── LabyrinthRankings ──────────────────────────────────────────
// Built fresh — no prior Labyrinth tracking existed anywhere in the
// app. Entries are free-standing (newLabyrinthEntry, playerSchema.js),
// NOT tied to a roster playerId, since Labyrinth is a state-wide
// leaderboard and entries may name people outside Caroline's own
// alliance/roster. Grouped by allianceTag, sorted by score, top 15
// shown per alliance (more can be stored; only the top 15 surface).
//
// Kept inline in this file rather than split into its own component
// file — IntelTab.jsx's existing sub-panels (JoinerRegistry,
// NoticeLibrary, AsciiArtLibrary) each live in a DIFFERENT folder
// with no consistent "intel subcomponent" location to infer, so
// guessing a new path felt riskier than one extra ~120-line function
// here. Split it out (e.g. components/intel/LabyrinthRankings.jsx) if
// this file crosses the 300-line component limit.
function LabyrinthRankings({ entries, existingTags, players, onSave, onDelete, onClose }) {
  const [formOpen, setFormOpen]               = useState(false);
  const [editing, setEditing]                 = useState(null); // entry being added/edited
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [nameQuery, setNameQuery]             = useState(''); // raw input text, separate from a confirmed roster link
  const [batchOpen, setBatchOpen]             = useState(false);
  const [batchAllianceTag, setBatchAllianceTag] = useState('');
  const [batchText, setBatchText]             = useState('');

  // If onSave/onDelete were never threaded down from whatever renders
  // IntelTab (App.jsx or the state hook — never obtained in any
  // session), calling them would throw silently inside the tab error
  // boundary, which is exactly the "button doesn't work" symptom.
  // Surface that plainly instead of pretending Save works.
  const notWired = typeof onSave !== 'function' || typeof onDelete !== 'function';

  const byAlliance = new Map();
  entries.forEach(e => {
    const tag = e.allianceTag || '(no alliance set)';
    if (!byAlliance.has(tag)) byAlliance.set(tag, []);
    byAlliance.get(tag).push(e);
  });
  const allianceGroups = [...byAlliance.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  function startAdd() { setEditing(newLabyrinthEntry()); setNameQuery(''); setFormOpen(true); }
  function startEdit(entry) { setEditing({ ...entry }); setNameQuery(entry.playerName || ''); setConfirmDeleteId(null); setFormOpen(true); }
  function saveEditing() {
    if (notWired || !editing?.playerName?.trim()) return;
    onSave({ ...editing, updatedAt: new Date().toISOString() });
    setFormOpen(false);
    setEditing(null);
  }

  const isExisting = editing && entries.some(e => e.id === editing.id);

  // Roster name matching — substring, case-insensitive, against
  // username OR alias. Only shown while the typed text doesn't
  // already match a confirmed link, and capped at 5 so it never
  // dwarfs the rest of the sheet.
  const nameMatches = nameQuery.trim().length > 0 && editing?.playerId == null
    ? players
        .filter(p => {
          const q = nameQuery.trim().toLowerCase();
          return (p.username || '').toLowerCase().includes(q) || (p.alias || '').toLowerCase().includes(q);
        })
        .slice(0, 5)
    : [];

  function pickRosterMatch(p) {
    setEditing({
      ...editing,
      playerId:    p.id,
      playerName:  p.username || p.alias || '',
      allianceTag: editing.allianceTag || p.allianceTag || '',
    });
    setNameQuery(p.username || p.alias || '');
  }

  function onNameTyped(v) {
    setNameQuery(v);
    // Free-typing invalidates any previous roster link — re-confirm
    // via a fresh pick from the suggestion list if one still matches.
    setEditing({ ...editing, playerName: v, playerId: null });
  }

  // ── Batch add ─────────────────────────────────────────────────
  // One entry per line: "Player Name, Score" — comma-separated, tab-
  // separated (pasted straight from a spreadsheet) also accepted.
  // Extra commas in the score (e.g. "128,500") are tolerated by
  // rejoining everything after the first split and stripping
  // non-numeric characters. Each line is matched against the roster
  // the same way the single-add autofill does — an exact username/
  // alias match links playerId automatically.
  function parseBatchLines(text) {
    return text.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      const playerName = (parts[0] || '').trim();
      const scoreRaw = parts.slice(1).join('').replace(/[^0-9.\-]/g, '').trim();
      const score = scoreRaw === '' ? null : Number(scoreRaw);
      const match = players.find(p =>
        (p.username || '').toLowerCase() === playerName.toLowerCase() ||
        (p.alias || '').toLowerCase() === playerName.toLowerCase()
      );
      return {
        playerName,
        score: Number.isFinite(score) ? score : null,
        playerId: match ? match.id : null,
      };
    }).filter(row => row.playerName);
  }

  const batchRows = parseBatchLines(batchText);

  function submitBatch() {
    if (notWired || batchRows.length === 0) return;
    batchRows.forEach(row => {
      onSave(newLabyrinthEntry({ ...row, allianceTag: batchAllianceTag }));
    });
    setBatchText('');
    setBatchOpen(false);
  }

  return (
    <>
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div style={{ fontSize:17, fontWeight:700, color:C.white }}>🏆 Labyrinth Rankings</div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:26, cursor:'pointer', lineHeight:1 }}>✕</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {notWired && (
          <div style={{ background:C.red+'14', border:`1px solid ${C.red}44`, borderRadius:10, padding:'10px 12px', marginBottom:16 }}>
            <div style={{ fontSize:12, color:C.red, fontWeight:700, marginBottom:2 }}>⚠ Saving isn't connected yet</div>
            <div style={{ fontSize:12, color:C.muted }}>labyrinthEntries / onSaveLabyrinthEntry / onDeleteLabyrinthEntry aren't being passed into IntelTab from wherever it's rendered. Nothing typed here will persist until that's wired up.</div>
          </div>
        )}

        <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>
          Top 15 per alliance, ranked by score. Entries don't need to be on your roster — Labyrinth spans the whole state.
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <button onClick={startAdd} style={{ flex:1, height:44, borderRadius:12, background:C.gold+'18', border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
            ＋ Add player
          </button>
          <button onClick={() => setBatchOpen(true)} style={{ flex:1, height:44, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:700, fontSize:13, cursor:'pointer' }}>
            📥 Batch add
          </button>
        </div>

        {allianceGroups.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 0', color:C.muted, fontSize:13 }}>No entries yet — add your first Labyrinth player above.</div>
        ) : (
          allianceGroups.map(([tag, list]) => {
            const sorted = [...list].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
            const top15  = sorted.slice(0, 15);
            const extra  = sorted.length - top15.length;
            return (
              <div key={tag} style={{ marginBottom:20 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.icy, marginBottom:8 }}>
                  {tag === '(no alliance set)' ? tag : `[${tag}]`} · {sorted.length}{extra > 0 ? ' (top 15 shown)' : ''}
                </div>
                {top15.map((e, i) => (
                  <div key={e.id} onClick={() => startEdit(e)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${C.border}22`, cursor:'pointer' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:i<3?C.gold:C.muted, width:20, textAlign:'center' }}>
                      {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:C.white }}>
                        {e.playerName}{e.playerId && <span style={{ color:C.green, fontSize:11, marginLeft:6 }}>🔗 roster</span>}
                      </div>
                      {e.notes && <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{e.notes}</div>}
                    </div>
                    <div style={{ fontSize:14, fontWeight:700, color:C.gold }}>{e.score ?? '—'}</div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {formOpen && editing && (
        <div onClick={() => { setFormOpen(false); setEditing(null); }} style={{ position:'fixed', inset:0, background:'#000c', zIndex:700, display:'flex', alignItems:'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, margin:'0 auto', maxHeight:'85vh', overflowY:'auto', padding:'16px 20px 32px' }}>
            <div style={{ width:40, height:4, borderRadius:2, background:C.border, margin:'0 auto 16px' }} />
            <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:16 }}>{isExisting ? 'Edit entry' : 'Add player'}</div>

            <label style={{ fontSize:11, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Alliance</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:4 }}>
              {existingTags.map(tag => (
                <button key={tag} onClick={() => setEditing({ ...editing, allianceTag: tag })}
                  style={{ padding:'6px 12px', borderRadius:14, border:`1px solid ${editing.allianceTag===tag?C.gold:C.border}`, background:editing.allianceTag===tag?C.gold+'22':C.section, color:editing.allianceTag===tag?C.gold:C.icy, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                  [{tag}]
                </button>
              ))}
            </div>
            <input value={editing.allianceTag || ''} onChange={e => setEditing({ ...editing, allianceTag: e.target.value })} placeholder="Or type an alliance tag"
              style={{ width:'100%', height:40, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 12px', fontSize:13, color:C.white, boxSizing:'border-box', marginBottom:12 }} />

            <label style={{ fontSize:11, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>
              Player name {editing.playerId && <span style={{ color:C.green, textTransform:'none', fontWeight:600 }}>· 🔗 linked to roster</span>}
            </label>
            <input value={nameQuery} onChange={e => onNameTyped(e.target.value)} placeholder="Start typing a roster name, or enter anyone"
              style={{ width:'100%', height:40, background:C.section, border:`1px solid ${editing.playerId?C.green+'66':C.border}`, borderRadius:10, padding:'0 12px', fontSize:13, color:C.white, boxSizing:'border-box' }} />
            {nameMatches.length > 0 && (
              <div style={{ background:C.section, border:`1px solid ${C.border}`, borderRadius:10, marginTop:4, marginBottom:12, overflow:'hidden' }}>
                {nameMatches.map(p => (
                  <button key={p.id} onClick={() => pickRosterMatch(p)}
                    style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 12px', background:'none', border:'none', borderBottom:`1px solid ${C.border}22`, color:C.white, fontSize:13, cursor:'pointer' }}>
                    {p.username || p.alias}{p.allianceTag ? ` · [${p.allianceTag}]` : ''}
                  </button>
                ))}
              </div>
            )}
            {nameMatches.length === 0 && <div style={{ marginBottom:12 }} />}

            <label style={{ fontSize:11, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Labyrinth score</label>
            <input type="number" value={editing.score ?? ''} onChange={e => setEditing({ ...editing, score: e.target.value === '' ? null : Number(e.target.value) })} placeholder="e.g. 128500"
              style={{ width:'100%', height:40, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 12px', fontSize:13, color:C.white, boxSizing:'border-box', marginBottom:12 }} />

            <label style={{ fontSize:11, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Notes</label>
            <textarea value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} placeholder="Optional — anything worth remembering"
              style={{ width:'100%', minHeight:56, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit', marginBottom:16 }} />

            <div style={{ display:'flex', gap:8 }}>
              {isExisting && (
                <button onClick={() => {
                    if (notWired) return;
                    if (confirmDeleteId === editing.id) { onDelete(editing.id); setFormOpen(false); setEditing(null); setConfirmDeleteId(null); }
                    else setConfirmDeleteId(editing.id);
                  }}
                  style={{ height:48, padding:'0 16px', borderRadius:12, background:'none', border:`1px solid ${C.red}44`, color:C.red, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {confirmDeleteId === editing.id ? 'Tap again to delete' : 'Delete'}
                </button>
              )}
              <button onClick={saveEditing} disabled={notWired || !editing.playerName?.trim()}
                style={{ flex:1, height:48, borderRadius:12, background:(!notWired && editing.playerName?.trim())?C.gold:C.section, border:(!notWired && editing.playerName?.trim())?'none':`1px solid ${C.border}`, color:(!notWired && editing.playerName?.trim())?C.bg:C.muted, fontWeight:700, fontSize:14, cursor:(!notWired && editing.playerName?.trim())?'pointer':'default' }}>
                {notWired ? 'Not connected' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {batchOpen && (
        <div onClick={() => setBatchOpen(false)} style={{ position:'fixed', inset:0, background:'#000c', zIndex:700, display:'flex', alignItems:'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, margin:'0 auto', maxHeight:'85vh', overflowY:'auto', padding:'16px 20px 32px' }}>
            <div style={{ width:40, height:4, borderRadius:2, background:C.border, margin:'0 auto 16px' }} />
            <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:4 }}>📥 Batch add</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>One player per line: <span style={{ color:C.icy }}>Player Name, Score</span>. Pasted spreadsheet rows (tab-separated) work too. All lines get this one alliance tag.</div>

            <label style={{ fontSize:11, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Alliance for this batch</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:4 }}>
              {existingTags.map(tag => (
                <button key={tag} onClick={() => setBatchAllianceTag(tag)}
                  style={{ padding:'6px 12px', borderRadius:14, border:`1px solid ${batchAllianceTag===tag?C.gold:C.border}`, background:batchAllianceTag===tag?C.gold+'22':C.section, color:batchAllianceTag===tag?C.gold:C.icy, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                  [{tag}]
                </button>
              ))}
            </div>
            <input value={batchAllianceTag} onChange={e => setBatchAllianceTag(e.target.value)} placeholder="Or type an alliance tag"
              style={{ width:'100%', height:40, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 12px', fontSize:13, color:C.white, boxSizing:'border-box', marginBottom:12 }} />

            <label style={{ fontSize:11, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Paste list</label>
            <textarea value={batchText} onChange={e => setBatchText(e.target.value)} placeholder={'Frostbyte, 128500\nIcecrown, 114200\nRavenna, 98750'}
              style={{ width:'100%', minHeight:140, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13, color:C.white, resize:'vertical', boxSizing:'border-box', fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', marginBottom:10 }} />

            {batchRows.length > 0 && (
              <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>
                {batchRows.length} row{batchRows.length!==1?'s':''} parsed · {batchRows.filter(r=>r.playerId).length} matched to roster · {batchRows.filter(r=>r.score==null).length} missing a score
              </div>
            )}

            <button onClick={submitBatch} disabled={notWired || batchRows.length === 0}
              style={{ width:'100%', height:48, borderRadius:12, background:(!notWired && batchRows.length>0)?C.gold:C.section, border:(!notWired && batchRows.length>0)?'none':`1px solid ${C.border}`, color:(!notWired && batchRows.length>0)?C.bg:C.muted, fontWeight:700, fontSize:14, cursor:(!notWired && batchRows.length>0)?'pointer':'default' }}>
              {notWired ? 'Not connected' : batchRows.length > 0 ? `Add ${batchRows.length} entr${batchRows.length!==1?'ies':'y'}` : 'Paste a list above'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function IntelTab({ players, events, onUpdatePlayer, showToast, settings = {}, notices = [], onSaveNotice, onDeleteNotice, asciiArts = [], onSaveArt, onDeleteArt, onResetArtToDefaults, labyrinthEntries = [], onSaveLabyrinthEntry, onDeleteLabyrinthEntry }) {
  const [registryOpen, setRegistryOpen] = useState(false);
  const [noticesOpen, setNoticesOpen]   = useState(false);
  const [artOpen, setArtOpen]           = useState(false);
  const [labyrinthOpen, setLabyrinthOpen] = useState(false);
  const [englishDiscordOpen, setEnglishDiscordOpen] = useState(false);

  const existingAllianceTags = [...new Set(players.map(p => p.allianceTag).filter(Boolean))];

  const withM = players
    .map(p=>({player:p,metrics:calcMetrics(p,events)}))
    .filter(x=>x.metrics)
    .sort((a,b)=>b.metrics.reliabilityScore-a.metrics.reliabilityScore);

  const atRisk = players
    .map(p=>({player:p,metrics:calcMetrics(p,events)}))
    .filter(x=>x.metrics&&x.metrics.consecutiveMisses>=3)
    .sort((a,b)=>b.metrics.consecutiveMisses-a.metrics.consecutiveMisses);

  // Hero counts from joinerHeroes
  const heroCounts = {};
  players.forEach(p=>(p.joinerHeroes||[]).forEach(jh=>{
    if(jh.skillLevel>=5) heroCounts[jh.hero]=(heroCounts[jh.hero]||0)+1;
  }));
  const topHeroes = Object.entries(heroCounts).sort((a,b)=>b[1]-a[1]).slice(0,12);

  const countryCounts = {};
  players.forEach(p=>{ if(p.country) countryCounts[p.country]=(countryCounts[p.country]||0)+1; });
  const topCountries = Object.entries(countryCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);

  const available    = players.filter(p=>p.availability?.present==='available').length;
  const rallyLeads   = players.filter(p=>p.roles?.includes('Rally Lead')).length;
  const withJoiners  = players.filter(p=>(p.joinerHeroes||[]).some(jh=>jh.skillLevel>=5)).length;
  const englishDiscordPlayers = players.filter(p=>p.languages?.includes('English') && p.availability?.discord==='yes');

  if (registryOpen) {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:600, background:C.bg, display:'flex', flexDirection:'column', overflow:'hidden', maxWidth:480, margin:'0 auto' }}>
        <JoinerRegistry
          players={players}
          settings={settings}
          onUpdatePlayer={player=>{ onUpdatePlayer(player); showToast('Saved ✓'); }}
          onClose={()=>setRegistryOpen(false)}
        />
      </div>
    );
  }

  if (noticesOpen) {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:600, background:C.bg, display:'flex', flexDirection:'column', overflow:'hidden', maxWidth:480, margin:'0 auto' }}>
        <NoticeLibrary
          notices={notices}
          settings={settings}
          asciiArts={asciiArts}
          onSaveNotice={onSaveNotice}
          onDeleteNotice={onDeleteNotice}
          onClose={()=>setNoticesOpen(false)}
        />
      </div>
    );
  }

  if (artOpen) {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:600, background:C.bg, display:'flex', flexDirection:'column', overflow:'hidden', maxWidth:480, margin:'0 auto' }}>
        <AsciiArtLibrary
          asciiArts={asciiArts}
          onSaveArt={onSaveArt}
          onDeleteArt={onDeleteArt}
          onResetToDefaults={onResetArtToDefaults}
          onClose={()=>setArtOpen(false)}
        />
      </div>
    );
  }

  if (labyrinthOpen) {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:600, background:C.bg, display:'flex', flexDirection:'column', overflow:'hidden', maxWidth:480, margin:'0 auto' }}>
        <LabyrinthRankings
          entries={labyrinthEntries}
          existingTags={existingAllianceTags}
          players={players}
          onSave={onSaveLabyrinthEntry}
          onDelete={onDeleteLabyrinthEntry}
          onClose={()=>setLabyrinthOpen(false)}
        />
      </div>
    );
  }

  return (
    <div style={{ padding:'16px 20px' }}>

      {/* Summary line — replaces the 6-card grid */}
      <div style={{ background:C.section, borderRadius:12, padding:'14px 16px', marginBottom:16, display:'flex', flexWrap:'wrap' }}>
        {[
          [`${players.length}`, 'members', null],
          [`${available}`, 'available', null],
          [`${rallyLeads}`, 'rally leads', null],
          [`${withJoiners}`, 'joiner heroes set', null],
          [`${englishDiscordPlayers.length}`, 'English + Discord', () => setEnglishDiscordOpen(true)],
        ].map(([num, label, onClick], i, arr) => (
          <div key={label} onClick={onClick || undefined}
            style={{ flex:'1 1 auto', textAlign:'center', padding:'4px 8px', borderRight: i<arr.length-1 ? `1px solid ${C.border}` : 'none', cursor:onClick?'pointer':'default' }}>
            <div style={{ fontSize:22, fontWeight:700, color:C.gold }}>{num}</div>
            <div style={{ fontSize:11, color:onClick?C.icy:C.muted, marginTop:2, textDecoration:onClick?'underline':'none' }}>{label}{onClick?' ›':''}</div>
          </div>
        ))}
      </div>

      {englishDiscordOpen && (
        <div onClick={() => setEnglishDiscordOpen(false)} style={{ position:'fixed', inset:0, background:'#000c', zIndex:700, display:'flex', alignItems:'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, margin:'0 auto', maxHeight:'80vh', overflowY:'auto', padding:'16px 20px 32px' }}>
            <div style={{ width:40, height:4, borderRadius:2, background:C.border, margin:'0 auto 16px' }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:700, color:C.white }}>🎙️ English + Discord · {englishDiscordPlayers.length}</div>
              <button onClick={() => setEnglishDiscordOpen(false)} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
            </div>
            {englishDiscordPlayers.length === 0 ? (
              <div style={{ fontSize:13, color:C.muted, textAlign:'center', padding:'20px 0' }}>Nobody matches yet — mark Discord and English in each player's profile.</div>
            ) : (
              englishDiscordPlayers.map(p => (
                <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${C.border}22` }}>
                  <div style={{ fontSize:14, fontWeight:600, color:C.white }}>{p.username||p.alias||'?'}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{[p.allianceTag&&`[${p.allianceTag}]`, p.furnaceLevel].filter(Boolean).join(' · ')}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Joiner Registry — prominent card */}
      <button onClick={()=>setRegistryOpen(true)} style={{ width:'100%', borderRadius:12, background:C.card, border:`1px solid ${C.gold}44`, padding:'16px', marginBottom:16, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:14 }}>
        <span style={{ fontSize:32 }}>🦸</span>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:C.gold }}>Joiner Registry</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>Track Skill 5 joiner heroes · coverage · meta formations</div>
        </div>
        <span style={{ marginLeft:'auto', fontSize:20, color:C.gold }}>›</span>
      </button>

      {/* Notice Library — prominent card */}
      <button onClick={()=>setNoticesOpen(true)} style={{ width:'100%', borderRadius:12, background:C.card, border:`1px solid ${C.gold}44`, padding:'16px', marginBottom:16, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:14 }}>
        <span style={{ fontSize:32 }}>📋</span>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:C.gold }}>Notice Library</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>Reusable alliance notices · learns your 4-week cycle</div>
        </div>
        <span style={{ marginLeft:'auto', fontSize:20, color:C.gold }}>›</span>
      </button>

      {/* ASCII Art Library — prominent card */}
      <button onClick={()=>setArtOpen(true)} style={{ width:'100%', borderRadius:12, background:C.card, border:`1px solid ${C.gold}44`, padding:'16px', marginBottom:16, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:14 }}>
        <span style={{ fontSize:32 }}>🎨</span>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:C.gold }}>ASCII Art Library</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>Save and copy banners, dividers, and decorations</div>
        </div>
        <span style={{ marginLeft:'auto', fontSize:20, color:C.gold }}>›</span>
      </button>

      {/* Labyrinth Rankings — prominent card */}
      <button onClick={()=>setLabyrinthOpen(true)} style={{ width:'100%', borderRadius:12, background:C.card, border:`1px solid ${C.gold}44`, padding:'16px', marginBottom:16, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:14 }}>
        <span style={{ fontSize:32 }}>🏆</span>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:C.gold }}>Labyrinth Rankings</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>Top 15 per alliance · tap to add or edit</div>
        </div>
        <span style={{ marginLeft:'auto', fontSize:20, color:C.gold }}>›</span>
      </button>

      {/* Reliability leaderboard — top of data section */}
      {withM.length>0&&(
        <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:12 }}>🏅 Most Reliable</div>
          {withM.slice(0,8).map(({player,metrics},i)=>(
            <div key={player.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${C.border}22` }}>
              <div style={{ fontSize:13, fontWeight:700, color:i<3?C.gold:C.muted, width:22, textAlign:'center' }}>
                {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.white }}>{player.username||player.alias||'?'}</div>
                <div style={{ fontSize:11, color:C.muted }}>{metrics.attended}/{metrics.totalEvents} events · {metrics.attendancePct}% attendance</div>
              </div>
              <ReliabilityBadge score={metrics.reliabilityScore}/>
            </div>
          ))}
        </div>
      )}

      {/* Needs attention */}
      {atRisk.length>0&&(
        <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:16, border:`1px solid ${C.red}33` }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.red, marginBottom:4 }}>⚠️ Needs Attention</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>Absent 3 or more events in a row</div>
          {atRisk.map(({player,metrics})=>(
            <div key={player.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${C.border}22` }}>
              <div style={{ fontSize:14, color:C.white }}>{player.username||player.alias||'?'}</div>
              <div style={{ fontSize:13, fontWeight:700, color:C.red }}>{metrics.consecutiveMisses} missed</div>
            </div>
          ))}
        </div>
      )}

      {/* Top heroes */}
      {topHeroes.length>0&&(
        <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:4 }}>🦸 Joiner Heroes</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>Members tracked in Joiner Registry</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {topHeroes.map(([hero,count])=>(
              <div key={hero} style={{ padding:'8px 12px', borderRadius:20, background:C.gold+'18', border:`1px solid ${C.gold}33` }}>
                <span style={{ color:C.gold, fontWeight:600, fontSize:13 }}>✓ {hero}</span>
                <span style={{ color:C.muted, fontSize:12, marginLeft:6 }}>×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Countries */}
      {topCountries.length>0&&(
        <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:12 }}>🌏 Countries</div>
          {topCountries.map(([c,n])=>(
            <div key={c} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:14, color:C.icy }}>{c}</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:80, height:6, borderRadius:3, background:C.border, overflow:'hidden' }}>
                  <div style={{ width:`${(n/players.length)*100}%`, height:'100%', background:C.gold, borderRadius:3 }}/>
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:C.gold, width:20, textAlign:'right' }}>{n}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {players.length===0&&(
        <div style={{ textAlign:'center', padding:'40px 0', color:C.muted }}>Add members to see intel</div>
      )}
    </div>
  );
}
