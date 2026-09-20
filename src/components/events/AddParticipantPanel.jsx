import { useState } from 'react';
import { C, EVENT_ICONS, TROOP_POWER_EVENTS } from '../../utils/constants.js';
import { fmtDateShort } from '../../utils/dates.js';
import { matchNamesToPlayers, findCloseMatches } from '../../utils/nameList.js';
import { findSiblingLegionEvent } from '../../services/eventListHelpers.js';

// Parse "Name, Troop Power" lines — used only for TROOP_POWER_EVENTS
// (Foundry/Canyon Clash), where attendance import needs a number
// alongside each name, not just the name. Extra commas inside the
// power field (e.g. "128,500") are tolerated by rejoining everything
// after the first split and stripping non-numeric characters, same
// approach used for the Labyrinth batch-add parser.
function parsePowerLines(raw) {
  return (raw || '').split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.split(',');
    const name = (parts[0] || '').trim();
    const powerRaw = parts.slice(1).join('').replace(/[^0-9.\-]/g, '').trim();
    const power = powerRaw === '' ? null : Number(powerRaw);
    return { name, power: Number.isFinite(power) ? power : null };
  }).filter(r => r.name);
}

// Resolve each parsed line against the eligible pool:
//   matched — exact username/alias match (or the officer already
//             confirmed a link via `decisions`)
//   fuzzy   — a close-but-not-exact name match exists; needs the
//             officer to confirm link-or-new before it can submit
//   new     — no match at all, or the officer explicitly chose "add
//             as new" for this name
function resolvePowerRows(lines, pool, decisions) {
  return lines.map(({ name, power }) => {
    const exact = pool.find(p =>
      (p.username || '').toLowerCase() === name.toLowerCase() ||
      (p.alias || '').toLowerCase() === name.toLowerCase()
    );
    if (exact) return { status: 'matched', name, power, player: exact };

    const decision = decisions[name];
    if (decision === 'new') return { status: 'new', name, power };
    if (decision) {
      const linked = pool.find(p => p.id === decision);
      if (linked) return { status: 'matched', name, power, player: linked };
    }

    const fuzzy = findCloseMatches(name, pool);
    if (fuzzy.length > 0) return { status: 'fuzzy', name, power, suggestion: fuzzy[0].player };
    return { status: 'new', name, power };
  });
}

// Props:
//   addAsSubstitute, setAddAsSubstitute
//   addMode, setAddMode                       – 'type' | 'paste'
//   addQuery, addResults, onSearchAdd, onCommitTopMatch, onAddParticipant
//   pasteAddText, setPasteAddText, onAddParticipantsBatch
//   tracksTroopPower                          – true for Foundry/Canyon Clash — switches paste mode to Name+Power
//   pastePowerText, setPastePowerText, onAddAttendanceWithPower
//   players, activeEvent, events
//   onOpenLegionSwap                          – (player, sibling) => void
//   copyPickerOpen, setCopyPickerOpen, onCopyRosterFrom
export function AddParticipantPanel({
  addAsSubstitute, setAddAsSubstitute,
  addMode, setAddMode,
  addQuery, addResults, onSearchAdd, onCommitTopMatch, onAddParticipant,
  pasteAddText, setPasteAddText, onAddParticipantsBatch,
  tracksTroopPower,
  pastePowerText, setPastePowerText, onAddAttendanceWithPower,
  players, activeEvent, events,
  onOpenLegionSwap,
  copyPickerOpen, setCopyPickerOpen, onCopyRosterFrom,
}) {
  // Per-name decisions for fuzzy-matched power-paste rows — 'new', or
  // an existing player's id to link to. Local and transient: cleared
  // implicitly whenever the text changes enough that a name's row
  // disappears, same lifetime as the old Batch Add sheet's fuzzyDec.
  const [powerRowDecisions, setPowerRowDecisions] = useState({});
  return (
    <>
      {/* Add participant — type a name (Enter commits the top match)
          or paste a whole list at once. Adding-as toggle decides
          which section they land in, for either mode. */}
      {activeEvent.allianceTags?.length > 0 && (
        <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>
          Only showing {activeEvent.allianceTags.map(t=>`[${t}]`).join(' ')} players — set in the event's alliance field.
        </div>
      )}
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        <button onClick={() => setAddAsSubstitute(false)} style={{ flex:1, height:44, borderRadius:10, border:`1px solid ${!addAsSubstitute?C.gold:C.border}`, background:!addAsSubstitute?C.gold+'22':C.section, color:!addAsSubstitute?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>Add as Participant</button>
        <button onClick={() => setAddAsSubstitute(true)} style={{ flex:1, height:44, borderRadius:10, border:`1px solid ${addAsSubstitute?C.gold:C.border}`, background:addAsSubstitute?C.gold+'22':C.section, color:addAsSubstitute?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>Add as Substitute</button>
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        <button onClick={() => setAddMode('type')} style={{ flex:1, height:44, borderRadius:16, background:addMode==='type'?C.gold+'22':C.section, border:`1px solid ${addMode==='type'?C.gold:C.border}`, color:addMode==='type'?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>🔍 Type one</button>
        <button onClick={() => setAddMode('paste')} style={{ flex:1, height:44, borderRadius:16, background:addMode==='paste'?C.gold+'22':C.section, border:`1px solid ${addMode==='paste'?C.gold:C.border}`, color:addMode==='paste'?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>{tracksTroopPower ? '📋 Paste with power' : '📋 Paste a list'}</button>
      </div>
      {addMode === 'type' ? (
        <div style={{ position:'relative', marginBottom:12 }}>
          <input
            value={addQuery}
            onChange={e => onSearchAdd(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onCommitTopMatch(); } }}
            placeholder="Type a name to add…"
            style={{ width:'100%', height:44, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 14px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}
          />
          {addResults.length > 0 && (
            <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', zIndex:20, boxShadow:'0 8px 24px #000a' }}>
              {addResults.map((p, i) => (
                <button key={p.id} onClick={() => onAddParticipant(p)}
                  style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', minHeight:44, padding:'10px 14px', background:i===0?C.gold+'12':'none', border:'none', borderBottom:`1px solid ${C.border}22`, cursor:'pointer', textAlign:'left' }}>
                  <span style={{ fontSize:14, fontWeight:700, color:C.white }}>{p.username||p.alias||'?'}</span>
                  <span style={{ fontSize:11, color:C.muted }}>{p.furnaceLevel||''}{i===0?'  ↵ Enter':''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : tracksTroopPower ? (() => {
        const already = new Set(activeEvent.participantIds || []);
        const pool = players.filter(p => !already.has(p.id));
        const lines = parsePowerLines(pastePowerText);
        const resolved = resolvePowerRows(lines, pool, powerRowDecisions);
        const readyCount = resolved.filter(r => r.status === 'matched' || r.status === 'new').length;
        const pendingCount = resolved.filter(r => r.status === 'fuzzy').length;

        function decide(name, value) {
          setPowerRowDecisions(prev => ({ ...prev, [name]: value }));
        }

        function submit() {
          const rows = resolved
            .filter(r => r.status === 'matched' || r.status === 'new')
            .map(r => r.status === 'matched' ? { player: r.player, power: r.power } : { newName: r.name, power: r.power });
          onAddAttendanceWithPower(rows);
          setPowerRowDecisions({});
        }

        return (
          <div style={{ marginBottom:12 }}>
            <textarea
              value={pastePowerText}
              onChange={e => setPastePowerText(e.target.value)}
              placeholder={'Name, Troop Power — one per line, e.g.\nAlice, 128500\nBob, 114200'}
              rows={4}
              style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', fontSize:14, color:C.white, boxSizing:'border-box', fontFamily:'inherit', resize:'vertical', marginBottom:8 }}
            />
            {resolved.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                {resolved.map((r, i) => {
                  if (r.status === 'matched') {
                    return (
                      <span key={i} style={{ padding:'5px 10px', borderRadius:14, background:C.green+'18', border:`1px solid ${C.green}44`, color:C.green, fontSize:12 }}>
                        ✓ {r.name} → {r.player.username || r.player.alias}{r.power != null ? ` · ${r.power.toLocaleString()}` : ' · no power'}
                      </span>
                    );
                  }
                  if (r.status === 'new') {
                    return (
                      <span key={i} style={{ padding:'5px 10px', borderRadius:14, background:C.gold+'14', border:`1px solid ${C.gold}44`, color:C.gold, fontSize:12 }}>
                        ➕ {r.name} — will be added as a new player{r.power != null ? ` · ${r.power.toLocaleString()}` : ''}
                      </span>
                    );
                  }
                  // fuzzy — needs a decision before it can submit
                  return (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:10, background:C.red+'0f', border:`1px solid ${C.red}33`, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:12, color:C.icy }}>
                        "{r.name}" looks like <strong style={{ color:C.white }}>{r.suggestion.username || r.suggestion.alias}</strong> — same person?
                      </span>
                      <button onClick={() => decide(r.name, r.suggestion.id)} style={{ fontSize:11, color:C.green, background:'none', border:'none', cursor:'pointer', textDecoration:'underline', padding:0 }}>🔗 Yes, link them</button>
                      <button onClick={() => decide(r.name, 'new')} style={{ fontSize:11, color:C.gold, background:'none', border:'none', cursor:'pointer', textDecoration:'underline', padding:0 }}>➕ No, add as new</button>
                    </div>
                  );
                })}
              </div>
            )}
            {pendingCount > 0 && (
              <div style={{ fontSize:12, color:C.red+'cc', marginBottom:8 }}>⚠ {pendingCount} name{pendingCount!==1?'s':''} need a decision above before adding.</div>
            )}
            <button
              onClick={submit}
              disabled={readyCount === 0 || pendingCount > 0}
              style={{ width:'100%', height:44, borderRadius:10, background:(readyCount>0 && pendingCount===0)?C.gold+'22':C.section, border:`1px solid ${(readyCount>0 && pendingCount===0)?C.gold:C.border}`, color:(readyCount>0 && pendingCount===0)?C.gold:C.muted, fontWeight:700, fontSize:14, cursor:(readyCount>0 && pendingCount===0)?'pointer':'default' }}
            >
              Record {readyCount || ''} Attending{readyCount!==1?'':''}
            </button>
          </div>
        );
      })() : (() => {
        const already = new Set(activeEvent.participantIds || []);
        const pool = players.filter(p => !already.has(p.id));
        const { matched: rawMatched, unmatched: addUnmatched } = matchNamesToPlayers(pasteAddText, pool);
        const sibling = findSiblingLegionEvent(activeEvent, events);
        const siblingIds = new Set(sibling?.participantIds || []);
        const addMatched = rawMatched.filter(p => !siblingIds.has(p.id));
        const addBlocked = rawMatched.filter(p => siblingIds.has(p.id));
        return (
          <div style={{ marginBottom:12 }}>
            <textarea
              value={pasteAddText}
              onChange={e => setPasteAddText(e.target.value)}
              placeholder={'Paste names, comma or newline separated…'}
              rows={3}
              style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', fontSize:14, color:C.white, boxSizing:'border-box', fontFamily:'inherit', resize:'vertical', marginBottom:8 }}
            />
            {(addMatched.length > 0 || addUnmatched.length > 0 || addBlocked.length > 0) && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                {addMatched.map(p => (
                  <span key={p.id} style={{ padding:'5px 10px', borderRadius:14, background:C.green+'18', border:`1px solid ${C.green}44`, color:C.green, fontSize:12 }}>✓ {p.username||p.alias}</span>
                ))}
                {addBlocked.map(p => (
                  <button key={p.id} onClick={() => onOpenLegionSwap(p, sibling)}
                    title={`Tap to move from Legion ${sibling?.legion}`}
                    style={{ padding:'5px 10px', minHeight:44, borderRadius:14, background:C.red+'14', border:`1px solid ${C.red}44`, color:C.red+'cc', fontSize:12, cursor:'pointer' }}>
                    ⚠ {p.username||p.alias} (Legion {sibling?.legion}) — swap?
                  </button>
                ))}
                {addUnmatched.map((n, i) => (
                  <span key={i} title="No roster match for this name" style={{ padding:'5px 10px', borderRadius:14, background:C.red+'14', border:`1px solid ${C.red}44`, color:C.red+'cc', fontSize:12 }}>? {n}</span>
                ))}
              </div>
            )}
            <button
              onClick={() => onAddParticipantsBatch(addMatched)}
              disabled={addMatched.length === 0}
              style={{ width:'100%', height:44, borderRadius:10, background:addMatched.length?C.gold+'22':C.section, border:`1px solid ${addMatched.length?C.gold:C.border}`, color:addMatched.length?C.gold:C.muted, fontWeight:700, fontSize:14, cursor:addMatched.length?'pointer':'default' }}
            >
              Add {addMatched.length || ''} as {addAsSubstitute ? 'Substitute' : 'Participant'}{addMatched.length!==1?'s':''}
            </button>
          </div>
        );
      })()}

      {/* Copy roster from a previous event — participant list only,
          never RSVP predictions from that event */}
      {events.filter(e => e.id !== activeEvent.id && (e.participantIds||[]).length > 0).length > 0 && (
        <div style={{ marginBottom:12 }}>
          <button onClick={() => setCopyPickerOpen(!copyPickerOpen)}
            style={{ background:'none', border:'none', color:C.gold, fontSize:13, fontWeight:600, cursor:'pointer', padding:0 }}>
            {copyPickerOpen ? 'Cancel' : '📋 Copy roster from a previous event'}
          </button>
          {copyPickerOpen && (
            <div style={{ marginTop:8, maxHeight:200, overflowY:'auto' }}>
              {events.filter(e => e.id !== activeEvent.id && (e.participantIds||[]).length > 0)
                .sort((a,b) => new Date(b.date) - new Date(a.date))
                .map(ev => (
                  <button key={ev.id} onClick={() => onCopyRosterFrom(ev)}
                    style={{ display:'block', width:'100%', textAlign:'left', minHeight:44, padding:'10px 12px', borderRadius:8, background:C.section, border:`1px solid ${C.border}`, color:C.white, fontSize:13, marginBottom:6, cursor:'pointer' }}>
                    {EVENT_ICONS[ev.type]||'📋'} {ev.name||ev.type} · {fmtDateShort(ev.date)} · {ev.participantIds.length} people
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
