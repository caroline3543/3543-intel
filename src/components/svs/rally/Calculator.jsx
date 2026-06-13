import { useState, useEffect } from 'react';
import { C } from '../../../utils/constants.js';
import { vibe } from '../../../utils/vibe.js';
import {
  RALLY_TYPES, RALLY_COLORS, RALLY_DURATIONS, OFFSETS, DEFAULT_MSG,
  uid, utcNowSecs, calcSendSecs, calcRallyOpenSecs, fmtSend, fmtMarch,
} from './rallyRoomHelpers.js';
import { ImpactInput, MarchInput } from './SmartInputs.jsx';

// ── Calculator ─────────────────────────────────────────────────
// The "🧮 Calculator" tab.
// Props:
//   calc           – calculator state slice from LiveRallyRoom
//   onChange       – (updatedCalc) => void
//   registry       – march registry entries
//   onStartTimers  – (newTimers[]) => void
export function Calculator({ calc, onChange, registry, onStartTimers }) {
  const [now, setNow]               = useState(utcNowSecs());
  const [copied, setCopied]         = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [asapName, setAsapName]     = useState('');
  const [asapType, setAsapType]     = useState('Main Rally');
  useEffect(() => { const id = setInterval(() => setNow(utcNowSecs()), 1000); return () => clearInterval(id); }, []);

  function handleAsap() {
    const launchAt = utcNowSecs() + 5;
    const timer = {
      id: uid(),
      name: asapName.trim() || asapType,
      type: asapType,
      asap: true,
      asapLaunchAt: launchAt,
      impactTime: null,
      marchSecs: null,
      rallyDuration: null,
      ratio: '', notes: '', joiners: [],
    };
    onStartTimers([timer]);
    vibe([10, 40, 10]);
  }

  const impactSecs = calc.impactSecs;

  function setImpact(disp, secs)  { onChange({ ...calc, impactTimeRaw:disp || '', impactSecs:secs }); }
  function setRallyDuration(d)    { onChange({ ...calc, rallyDuration:d, leaders:calc.leaders.map(l => ({ ...l, rallyDuration:d })) }); }
  function addFromRegistry(entry) {
    if (calc.leaders.some(l => l.registryId === entry.id)) return;
    onChange({ ...calc, leaders:[...calc.leaders, { id:uid(), registryId:entry.id, name:entry.name, type:entry.type||'Main Rally', marchSecs:entry.marchSecs, rallyDuration:calc.rallyDuration||3, offset:0, notes:'' }] });
    vibe(8);
  }
  function removeRow(id)       { onChange({ ...calc, leaders:calc.leaders.filter(l => l.id !== id) }); }
  function updRow(id, patch)   { onChange({ ...calc, leaders:calc.leaders.map(l => l.id === id ? { ...l, ...patch } : l) }); }

  function copyMsg(leader) {
    const impS   = calc.impactSecs;
    const openS  = leader.marchSecs && impS ? calcRallyOpenSecs(impS, leader.marchSecs, leader.rallyDuration || 3) : null;
    const sendS  = calcSendSecs(impS, leader.marchSecs, leader.offset || 0);
    const joinersText = (leader.joiners || [])
      .filter(j => j.playerName)
      .map((j, i) => `${i+1}. ${j.replacedBy ? j.replacedBy.playerName : j.playerName} → ${j.replacedBy?.heroName || j.heroName || 'TBD'}`)
      .join('\n') || 'Not yet assigned';
    const template = leader.useCustomMsg && leader.customMsg ? leader.customMsg : (calc.messageTemplate || DEFAULT_MSG);
    const text = template
      .replace('{type}',    leader.type || 'Rally')
      .replace('{name}',    leader.name || '')
      .replace('{impact}',  calc.impactTimeRaw || '--:--')
      .replace('{open}',    openS != null ? fmtSend(openS) : '--:--')
      .replace('{send}',    sendS != null ? fmtSend(sendS) : '--:--')
      .replace('{joiners}', joinersText)
      .replace('{ratio}',   leader.ratio || '');
    navigator.clipboard.writeText(text).then(() => { setCopied(leader.id); setTimeout(() => setCopied(null), 2000); });
    vibe(8);
  }

  function handleStartTimers() {
    const ready = calc.leaders.filter(l => l.marchSecs && calc.impactSecs);
    if (!ready.length) return;
    const newTimers = ready.map(l => ({
      id:uid(), name:l.name||l.type, type:l.type||'Main Rally',
      impactTime:calc.impactTimeRaw, marchSecs:l.marchSecs,
      rallyDuration:l.rallyDuration || calc.rallyDuration || 3,
      ratio:'', notes:l.notes||'', joiners:[],
    }));
    onStartTimers(newTimers);
  }

  const readyCount = calc.leaders.filter(l => l.marchSecs && impactSecs).length;

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:4 }}>Send Calculator</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>Set impact time, tap leader chips, press Start Timers.</div>

      {/* ASAP mode */}
      <div style={{ background:C.red+'18', border:`1px solid ${C.red}44`, borderRadius:14, padding:14, marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:4 }}>⚡ ASAP — Launch immediately</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>Skips impact time. First rally opens in 5 seconds from when you tap Launch.</div>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <input
            value={asapName}
            onChange={e => setAsapName(e.target.value)}
            placeholder="Leader name (optional)"
            style={{ flex:1, background:C.section, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:14, color:C.white, fontFamily:'inherit', boxSizing:'border-box' }}
          />
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
          {RALLY_TYPES.slice(0,5).map(type => {
            const sel = asapType === type;
            const col = RALLY_COLORS[type];
            return (
              <button key={type} onClick={() => setAsapType(type)}
                style={{ padding:'6px 12px', borderRadius:16, border:`1px solid ${sel?col:C.border}`, background:sel?col+'22':C.section, color:sel?col:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                {type}
              </button>
            );
          })}
        </div>
        <button onClick={handleAsap}
          style={{ width:'100%', height:52, borderRadius:12, background:C.red, color:'#fff', fontWeight:800, fontSize:16, border:'none', cursor:'pointer', letterSpacing:'0.04em' }}>
          ⚡ LAUNCH NOW — 5 second countdown
        </button>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <div style={{ flex:1, height:1, background:C.border }}/>
        <div style={{ fontSize:11, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>or set impact time</div>
        <div style={{ flex:1, height:1, background:C.border }}/>
      </div>

      {/* Impact time */}
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Target impact time (UTC)</label>
        <ImpactInput value={calc.impactTimeRaw} onChange={setImpact} large/>
      </div>

      {/* Rally duration — apply to all */}
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Rally duration <span style={{ fontWeight:400, color:C.muted }}>(apply to all)</span></label>
        <div style={{ display:'flex', gap:8 }}>
          {RALLY_DURATIONS.map(d => (
            <button key={d} onClick={() => setRallyDuration(d)}
              style={{ flex:1, height:44, borderRadius:10, border:`1px solid ${calc.rallyDuration===d?C.gold:C.border}`, background:calc.rallyDuration===d?C.gold+'22':C.section, color:calc.rallyDuration===d?C.gold:C.muted, fontWeight:700, fontSize:15, cursor:'pointer' }}>
              {d} min
            </button>
          ))}
        </div>
      </div>

      {/* Leader chips from registry */}
      {registry.filter(r => r.marchSecs).length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Saved leaders — tap to add</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {registry.filter(r => r.marchSecs).map(entry => {
              const already = calc.leaders.some(l => l.registryId === entry.id);
              return (
                <button key={entry.id} onClick={() => addFromRegistry(entry)} disabled={already}
                  style={{ padding:'8px 14px', borderRadius:20, minHeight:40, border:`1px solid ${already?C.border:C.gold}`, background:already?C.section:C.gold+'18', color:already?C.muted:C.gold, fontWeight:700, fontSize:14, cursor:already?'default':'pointer' }}>
                  {already ? '✓ ' : ''}{entry.name} <span style={{ fontSize:12, opacity:0.7 }}>{fmtMarch(entry.marchSecs)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Leader table */}
      {calc.leaders.length > 0 && (
        <div style={{ background:C.section, borderRadius:12, overflow:'hidden', marginBottom:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 58px 80px 38px 44px', padding:'8px 14px', borderBottom:`1px solid ${C.border}` }}>
            {['Leader','March','Send at','Off.',''].map(h => (
              <div key={h} style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</div>
            ))}
          </div>
          {calc.leaders.map((leader, i) => {
            const openS    = leader.marchSecs && impactSecs ? calcRallyOpenSecs(impactSecs, leader.marchSecs, leader.rallyDuration || 3) : null;
            const sendS    = impactSecs && leader.marchSecs ? calcSendSecs(impactSecs, leader.marchSecs, leader.offset || 0) : null;
            const isEditing = editingRow === i;
            const lcolor    = RALLY_COLORS[leader.type] || C.gold;
            return (
              <div key={leader.id} style={{ borderBottom:i<calc.leaders.length-1?`1px solid ${C.border}22`:'none' }}>
                <div onClick={() => setEditingRow(isEditing ? null : i)}
                  style={{ display:'grid', gridTemplateColumns:'1fr 58px 80px 38px 44px', padding:'10px 14px', cursor:'pointer', background:isEditing?C.card:'none', alignItems:'center' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:lcolor, flexShrink:0 }}/>
                      <div style={{ fontSize:14, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{leader.name || '—'}</div>
                    </div>
                    <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{leader.type} · {leader.rallyDuration || calc.rallyDuration || 3}min</div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.icy, fontVariantNumeric:'tabular-nums' }}>{leader.marchSecs ? fmtMarch(leader.marchSecs) : '—'}</div>
                  <div>
                    {openS != null && <div style={{ fontSize:11, color:C.gold, fontVariantNumeric:'tabular-nums' }}>Open {fmtSend(openS)}</div>}
                    {sendS != null && <div style={{ fontSize:12, fontWeight:700, color:C.green, fontVariantNumeric:'tabular-nums' }}>{fmtSend(sendS)}</div>}
                    {sendS == null && <div style={{ fontSize:12, color:C.muted }}>—</div>}
                  </div>
                  <div style={{ fontSize:11, color:leader.offset ? C.gold : C.muted }}>{leader.offset > 0 ? `+${leader.offset}` : leader.offset || '+0'}</div>
                  <div style={{ display:'flex', gap:3, justifyContent:'flex-end' }}>
                    <button onClick={e => { e.stopPropagation(); copyMsg(leader); }}
                      style={{ height:26, padding:'0 7px', borderRadius:7, background:copied===leader.id?C.green+'22':C.card, border:`1px solid ${copied===leader.id?C.green:C.border}`, color:copied===leader.id?C.green:C.muted, fontSize:10, cursor:'pointer' }}>
                      {copied === leader.id ? '✓' : '📋'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); removeRow(leader.id); }}
                      style={{ height:26, width:26, borderRadius:7, background:'none', border:'none', color:C.red+'88', fontSize:13, cursor:'pointer' }}>✕</button>
                  </div>
                </div>

                {/* Expanded row */}
                {isEditing && (
                  <div style={{ padding:'8px 14px 12px', background:C.card, borderTop:`1px solid ${C.border}22` }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                      <div>
                        <label style={{ fontSize:10, color:C.muted, display:'block', marginBottom:4 }}>March time</label>
                        <MarchInput value={leader.marchSecs} onChange={v => updRow(leader.id, { marchSecs:v })}/>
                      </div>
                      <div>
                        <label style={{ fontSize:10, color:C.muted, display:'block', marginBottom:4 }}>Landing offset</label>
                        <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                          {OFFSETS.map(o => (
                            <button key={o} onClick={() => updRow(leader.id, { offset:o })}
                              style={{ padding:'4px 6px', borderRadius:6, border:`1px solid ${leader.offset===o?C.gold:C.border}`, background:leader.offset===o?C.gold+'22':C.section, color:leader.offset===o?C.gold:C.muted, fontWeight:600, fontSize:10, cursor:'pointer', minWidth:26 }}>
                              {o > 0 ? `+${o}` : o}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginBottom:8 }}>
                      <label style={{ fontSize:10, color:C.muted, display:'block', marginBottom:4 }}>Rally duration (override)</label>
                      <div style={{ display:'flex', gap:6 }}>
                        {RALLY_DURATIONS.map(d => (
                          <button key={d} onClick={() => updRow(leader.id, { rallyDuration:d })}
                            style={{ flex:1, height:34, borderRadius:8, border:`1px solid ${(leader.rallyDuration||calc.rallyDuration||3)===d?C.gold:C.border}`, background:(leader.rallyDuration||calc.rallyDuration||3)===d?C.gold+'22':C.section, color:(leader.rallyDuration||calc.rallyDuration||3)===d?C.gold:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                            {d}min
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6, marginBottom:8, overflowX:'auto', paddingBottom:2 }}>
                      {RALLY_TYPES.slice(0, 5).map(type => {
                        const sel = leader.type === type;
                        const c   = RALLY_COLORS[type];
                        return (
                          <button key={type} onClick={() => updRow(leader.id, { type })}
                            style={{ padding:'5px 10px', borderRadius:12, whiteSpace:'nowrap', border:`1px solid ${sel?c:C.border}`, background:sel?c+'22':C.section, color:sel?c:C.muted, fontWeight:600, fontSize:11, cursor:'pointer', flexShrink:0 }}>
                            {type}
                          </button>
                        );
                      })}
                    </div>
                    <input value={leader.notes || ''} onChange={e => updRow(leader.id, { notes:e.target.value })} placeholder="Notes…"
                      style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:7, padding:'7px 10px', fontSize:12, color:C.icy, boxSizing:'border-box', fontFamily:'inherit' }}/>
                    <div style={{ marginTop:8 }}>
                      <button onClick={() => updRow(leader.id, { useCustomMsg:!leader.useCustomMsg })}
                        style={{ background:'none', border:'none', color:C.gold, fontSize:12, cursor:'pointer', padding:'2px 0' }}>
                        {leader.useCustomMsg ? '▾' : '▸'} Custom message for this leader
                      </button>
                      {leader.useCustomMsg && (
                        <div style={{ marginTop:6 }}>
                          <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>Variables: {'{type}'} {'{name}'} {'{impact}'} {'{open}'} {'{joiners}'} {'{ratio}'}</div>
                          <textarea value={leader.customMsg || calc.messageTemplate || DEFAULT_MSG} onChange={e => updRow(leader.id, { customMsg:e.target.value })}
                            style={{ width:'100%', minHeight:100, background:C.card, border:`1px solid ${C.border}`, borderRadius:7, padding:'8px 10px', fontSize:12, color:C.white, resize:'vertical', boxSizing:'border-box', fontFamily:'monospace' }}/>
                          <button onClick={() => updRow(leader.id, { customMsg:calc.messageTemplate || DEFAULT_MSG })}
                            style={{ fontSize:11, color:C.muted, background:'none', border:'none', cursor:'pointer', padding:'2px 0' }}>Reset to alliance default</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={() => { onChange({ ...calc, leaders:[...calc.leaders, { id:uid(), name:'', type:'Main Rally', marchSecs:null, rallyDuration:calc.rallyDuration||3, offset:0, notes:'' }] }); setEditingRow(calc.leaders.length); }}
            style={{ width:'100%', height:40, background:'none', border:'none', borderTop:`1px solid ${C.border}22`, color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
            ＋ Add manually
          </button>
        </div>
      )}

      {calc.leaders.length === 0 && registry.filter(r => r.marchSecs).length === 0 && (
        <div style={{ textAlign:'center', padding:'20px 0', color:C.muted, fontSize:13 }}>Add leaders in 💾 March Times, then tap their chips here.</div>
      )}

      {readyCount > 0 && (
        <button onClick={handleStartTimers} style={{ width:'100%', height:56, borderRadius:12, background:C.red, color:'#fff', fontWeight:800, fontSize:17, border:'none', cursor:'pointer', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          🔴 Start {readyCount} Timer{readyCount !== 1 ? 's' : ''} → Live Timers
        </button>
      )}
      {calc.leaders.length > 0 && readyCount === 0 && (
        <div style={{ background:C.section, borderRadius:10, padding:'12px 16px', marginBottom:12, textAlign:'center' }}>
          <div style={{ fontSize:13, color:C.muted }}>Each leader needs to enter their march time before timers can start.</div>
        </div>
      )}

      {/* Message template */}
      <button onClick={() => setShowTemplate(!showTemplate)}
        style={{ background:'none', border:'none', color:C.gold, fontSize:13, cursor:'pointer', padding:'4px 0', marginBottom:8 }}>
        {showTemplate ? '▾' : '▸'} Edit message template
      </button>
      {showTemplate && (
        <div style={{ background:C.section, borderRadius:10, padding:12 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Variables: {'{type}'} {'{name}'} {'{impact}'} {'{open}'} {'{joiners}'} {'{ratio}'}</div>
          <textarea value={calc.messageTemplate || DEFAULT_MSG} onChange={e => onChange({ ...calc, messageTemplate:e.target.value })}
            style={{ width:'100%', minHeight:120, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:13, color:C.white, resize:'vertical', boxSizing:'border-box', fontFamily:'monospace' }}/>
          <button onClick={() => onChange({ ...calc, messageTemplate:DEFAULT_MSG })}
            style={{ fontSize:12, color:C.muted, background:'none', border:'none', cursor:'pointer', padding:'4px 0' }}>Reset to default</button>
        </div>
      )}
    </div>
  );
}
