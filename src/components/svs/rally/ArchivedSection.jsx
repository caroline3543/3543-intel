import { useState, useEffect } from 'react';
import { C } from '../../../utils/constants.js';
import { vibe } from '../../../utils/vibe.js';
import {
  RALLY_TYPES, RALLY_COLORS, RALLY_DURATIONS,
  uid, parseImpactInput, calcSendSecs, calcRallyOpenSecs, fmtSend,
} from './rallyRoomHelpers.js';
import { MarchInput, ImpactInput } from './SmartInputs.jsx';

// ── ArchivedSection ────────────────────────────────────────────
// Collapsed "✓ Completed" section at the bottom of the Live Timers tab.
// Props:
//   archived – archived timer objects array
//   onClear  – () => void
export function ArchivedSection({ archived, onClear }) {
  const [open, setOpen]         = useState(false);
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{ marginTop:16 }}>
      <button onClick={() => setOpen(!open)}
        style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:'none', border:'none', padding:'8px 0', cursor:'pointer' }}>
        <span style={{ fontSize:13, fontWeight:700, color:C.muted }}>✓ Completed ({archived.length})</span>
        <span style={{ color:C.muted, fontSize:13 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div>
          {archived.slice().reverse().map(t => {
            const isExp  = expanded === t.id;
            const tcolor = RALLY_COLORS[t.type] || C.muted;
            const aTime  = t.archivedAt ? new Date(t.archivedAt).toUTCString().slice(17, 22) + ' UTC' : '';
            return (
              <div key={t.id} style={{ background:C.section, borderRadius:10, marginBottom:6, overflow:'hidden', border:`1px solid ${tcolor}33` }}>
                <div onClick={() => setExpanded(isExp ? null : t.id)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:tcolor, flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.muted }}>{t.name || t.type}</div>
                    <div style={{ fontSize:11, color:C.muted }}>✓ Impact {t.impactTime || ''} UTC{aTime ? ` · ${aTime}` : ''}</div>
                  </div>
                  <span style={{ color:C.muted, fontSize:12 }}>{isExp ? '▲' : '▼'}</span>
                </div>

                {isExp && (
                  <div style={{ padding:'0 14px 12px', borderTop:`1px solid ${C.border}22` }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, margin:'8px 0' }}>
                      {[['Type',t.type],['Duration',t.rallyDuration?`${t.rallyDuration}min`:'—'],['Ratio',t.ratio||'—'],['Impact',`${t.impactTime||'—'} UTC`]].map(([l,v]) => (
                        <div key={l} style={{ background:C.card, borderRadius:8, padding:'6px 10px' }}>
                          <div style={{ fontSize:10, color:C.muted }}>{l}</div>
                          <div style={{ fontSize:13, fontWeight:600, color:C.icy }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {t.joiners?.filter(j => j.playerName).length > 0 && (
                      <div style={{ marginTop:6 }}>
                        <div style={{ fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Joiners</div>
                        {t.joiners.filter(j => j.playerName).map((j, i) => (
                          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:`1px solid ${C.border}22`, fontSize:12 }}>
                            <span style={{ color:C.white }}>{j.replacedBy ? j.replacedBy.playerName : j.playerName}</span>
                            {(j.replacedBy?.heroName || j.heroName) && <span style={{ color:C.gold }}>→ {j.replacedBy?.heroName || j.heroName}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {t.notes && <div style={{ fontSize:11, color:C.muted, marginTop:8, fontStyle:'italic' }}>"{t.notes}"</div>}
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={onClear} style={{ width:'100%', height:36, borderRadius:8, background:'none', border:`1px solid ${C.border}`, color:C.muted, fontSize:12, cursor:'pointer', marginTop:4 }}>
            Clear completed
          </button>
        </div>
      )}
    </div>
  );
}

// ── TimerSheet ─────────────────────────────────────────────────
// Bottom-sheet to create or edit a timer manually.
// Props:
//   timer         – existing timer object | null (null = new timer)
//   open          – boolean
//   onClose       – () => void
//   onSave        – (timer) => void
//   prefillImpact – string | null — pre-fill impact field for new timers
export function TimerSheet({ timer, open, onClose, onSave, prefillImpact }) {
  const [t, setT] = useState(() => timer || newTimerObj());

  useEffect(() => {
    if (open) {
      const base = timer ? { ...timer } : newTimerObj();
      if (!timer && prefillImpact) base.impactTime = prefillImpact;
      setT(base);
    }
  }, [open, timer?.id, prefillImpact]);

  useEffect(() => {
    if (!open) return;
    function h(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  function upd(k, v) { setT(prev => ({ ...prev, [k]:v })); }

  const parsed  = parseImpactInput(t.impactTime);
  const impactS = parsed?.totalSecs ?? null;
  const marchS  = calcSendSecs(impactS, t.marchSecs, 0);
  const openS   = t.rallyDuration ? calcRallyOpenSecs(impactS, t.marchSecs, t.rallyDuration) : null;

  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:400, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'90vh', overflowY:'auto', padding:'16px 20px 80px' }}>
        <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:'0 auto 16px' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{timer ? 'Edit timer' : 'New timer'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Name</label>
          <input value={t.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. Caroline counter"
            style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Type</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {RALLY_TYPES.map(type => {
              const sel = t.type === type;
              const col = RALLY_COLORS[type];
              return (
                <button key={type} onClick={() => upd('type', type)}
                  style={{ padding:'8px 14px', borderRadius:20, minHeight:36, border:`1px solid ${sel?col:C.border}`, background:sel?col+'22':C.section, color:sel?col:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Target impact time (UTC)</label>
          <ImpactInput value={t.impactTime} onChange={(disp, secs) => upd('impactTime', disp || '')} large/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>March time (minutes and seconds)</label>
          <MarchInput value={t.marchSecs} onChange={v => upd('marchSecs', v)} placeholder="e.g. 118 = 1m 18s  or  1:18"/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Rally duration</label>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => upd('rallyDuration', null)}
              style={{ flex:1, height:40, borderRadius:10, border:`1px solid ${!t.rallyDuration?C.gold:C.border}`, background:!t.rallyDuration?C.gold+'22':C.section, color:!t.rallyDuration?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>None</button>
            {RALLY_DURATIONS.map(d => (
              <button key={d} onClick={() => upd('rallyDuration', d)}
                style={{ flex:1, height:40, borderRadius:10, border:`1px solid ${t.rallyDuration===d?C.gold:C.border}`, background:t.rallyDuration===d?C.gold+'22':C.section, color:t.rallyDuration===d?C.gold:C.muted, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                {d}min
              </button>
            ))}
          </div>
        </div>

        {openS != null && (
          <div style={{ background:C.section, borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, textAlign:'center' }}>
              {[['Open rally at', fmtSend(openS), C.gold],['Marches at', fmtSend(marchS), C.icy],['Impact', t.impactTime, C.gold]].map(([l,v,c]) => (
                <div key={l}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>{l}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:c }}>{v} UTC</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!openS && marchS != null && (
          <div style={{ background:C.section, borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>Marches at</div>
            <div style={{ fontSize:22, fontWeight:700, color:C.green }}>{fmtSend(marchS)} UTC</div>
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Notes</label>
          <textarea value={t.notes} onChange={e => upd('notes', e.target.value)} placeholder="Any instructions…"
            style={{ width:'100%', minHeight:64, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:15, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={() => { onSave(t); onClose(); vibe(8); }}
            style={{ flex:2, height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:16, border:'none', cursor:'pointer' }}>Save timer</button>
        </div>
      </div>
    </div>
  );
}

function newTimerObj() {
  return { id:uid(), name:'', type:'Main Rally', impactTime:'', marchSecs:null, rallyDuration:3, ratio:'', notes:'', joiners:[] };
}
