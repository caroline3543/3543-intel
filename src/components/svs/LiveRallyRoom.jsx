import { useState, useEffect, useRef } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { parseImpactInput } from '../../services/rallyTimingParser.js';
import {
  uid, utcNowSecs, loadState, saveState,
  DEFAULT_MSG,
} from './rally/rallyRoomHelpers.js';
import { UTCClock }        from './rally/UTCClock.jsx';
import { TimerCard }       from './rally/TimerCard.jsx';
import { LeaderMode }      from './rally/LeaderMode.jsx';
import { Calculator }      from './rally/Calculator.jsx';
import { MarchRegistry }   from './rally/MarchRegistry.jsx';
import { ArchivedSection, TimerSheet } from './rally/ArchivedSection.jsx';
import { useVoiceCountdown, loadVoiceSettings, saveVoiceSettings } from './rally/useVoiceCountdown.js';
import { VoiceSettingsSheet } from './rally/VoiceSettingsSheet.jsx';

const DEFAULT_STATE = {
  timers:[], archived:[], marchRegistry:[],
  calculator:{ impactTimeRaw:'', impactSecs:null, rallyDuration:3, leaders:[], messageTemplate:DEFAULT_MSG },
};

// ── LiveRallyRoom ──────────────────────────────────────────────
export function LiveRallyRoom({ onBack, players = [], planData = null }) {
  const [state, setState]                   = useState(() => loadState(DEFAULT_STATE, DEFAULT_MSG) || DEFAULT_STATE);
  const [view, setView]                     = useState('registry');
  const [editingTimer, setEditingTimer]     = useState(null);
  const [sheetOpen, setSheetOpen]           = useState(false);
  const [prefillImpact, setPrefillImpact]   = useState(null);
  const [leaderTimer, setLeaderTimer]       = useState(null);
  const [toastMsg, setToastMsg]             = useState(null);
  const [voiceSettings, setVoiceSettings]   = useState(() => loadVoiceSettings());
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);
  const [clearConfirm, setClearConfirm]     = useState(false);
  const planLoadedRef = useRef(false);

  // Persist voice settings whenever they change
  useEffect(() => { saveVoiceSettings(voiceSettings); }, [voiceSettings]);

  // Wire up voice countdown — runs in background, zero re-renders
  useVoiceCountdown(state.timers, voiceSettings.voiceOn, voiceSettings.cues, voiceSettings.voiceURI, voiceSettings.rate, voiceSettings.pitch);

  // Pre-populate calculator from Battle Plan (once only)
  useEffect(() => {
    if (!planData || planLoadedRef.current) return;
    planLoadedRef.current = true;
    const slots = (planData.rallySlots || []).filter(s => s.leaderName);
    if (!slots.length) return;
    const leaders = slots.map(s => ({
      id:uid(), name:s.leaderName, type:s.type||'Main Rally',
      marchSecs:null, rallyDuration:s.rallyDuration||3,
      offset:0, notes:s.notes||'', joiners:s.joiners||[], ratio:s.ratio||'',
    }));
    setState(prev => ({ ...prev, calculator:{ ...prev.calculator, leaders, rallyDuration:slots[0]?.rallyDuration||3 } }));
    setView('calc');
    showToast(`${slots.length} rally slots loaded from "${planData.name || 'Battle Plan'}"`);
  }, [planData]);

  // Persist on every state change
  useEffect(() => { saveState(state); }, [state]);

  // Auto-archive 30s after impact — checked every 10s
  useEffect(() => {
    const id = setInterval(() => {
      const now = utcNowSecs();
      setState(prev => {
        const toArchive = prev.timers.filter(t => {
          if (t.asap && t.asapLaunchAt != null) return t.asapLaunchAt - now < -30;
          const p = parseImpactInput(t.impactTime);
          return p && p.totalSecs - now < -30;
        });
        if (toArchive.length === 0) return prev;
        return {
          ...prev,
          timers:   prev.timers.filter(t => !toArchive.find(a => a.id === t.id)),
          archived: [...prev.archived, ...toArchive.map(t => ({ ...t, archivedAt:new Date().toISOString() }))],
        };
      });
    }, 10000);
    return () => clearInterval(id);
  }, []);

  function showToast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); }

  function saveTimer(t) {
    setState(prev => ({ ...prev, timers: prev.timers.some(x => x.id === t.id) ? prev.timers.map(x => x.id === t.id ? t : x) : [...prev.timers, t] }));
  }
  function deleteTimer(id) { setState(prev => ({ ...prev, timers: prev.timers.filter(t => t.id !== id) })); }

  function updateJoiner(timerId, joinerIdx, patch) {
    setState(prev => ({
      ...prev,
      timers: prev.timers.map(t => {
        if (t.id !== timerId) return t;
        const joiners = [...(t.joiners || [])];
        joiners[joinerIdx] = { ...joiners[joinerIdx], ...patch };
        return { ...t, joiners };
      }),
    }));
  }

  function handleStartTimers(newTimers) {
    setState(prev => {
      const slots = 5 - prev.timers.length;
      if (slots <= 0) { showToast('Live Room is full — delete a timer first'); return prev; }
      const toAdd = newTimers.slice(0, slots);
      if (toAdd.length < newTimers.length) showToast(`${toAdd.length} of ${newTimers.length} timers created — room full`);
      else showToast(`${toAdd.length} timer${toAdd.length !== 1 ? 's' : ''} started ✓`);
      const built = toAdd.map(t => {
        const cl = state.calculator.leaders.find(l => l.name === t.name);
        return cl ? { ...t, joiners:cl.joiners||[], ratio:cl.ratio||'' } : t;
      });
      return { ...prev, timers:[...prev.timers, ...built] };
    });
    setView('timers');
    vibe([10,40,10]);
  }

  const voiceOn = voiceSettings.voiceOn;

  return (
    <>
      {leaderTimer && <LeaderMode timer={leaderTimer} allTimers={state.timers} onClose={() => setLeaderTimer(null)}/>}

      <VoiceSettingsSheet
        open={voiceSheetOpen}
        onClose={() => setVoiceSheetOpen(false)}
        voiceOn={voiceSettings.voiceOn}
        cues={voiceSettings.cues}
        voiceURI={voiceSettings.voiceURI}
        rate={voiceSettings.rate}
        pitch={voiceSettings.pitch}
        onChange={s => setVoiceSettings(s)}
      />

      {toastMsg && (
        <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', background:C.card+'ee', backdropFilter:'blur(12px)', border:`1px solid ${C.gold}44`, borderRadius:20, padding:'10px 20px', fontSize:14, fontWeight:600, color:C.gold, zIndex:800, whiteSpace:'nowrap', pointerEvents:'none' }}>
          {toastMsg}
        </div>
      )}

      <div style={{ padding:'16px 20px 0' }}>
        {/* Top bar: back + voice toggle */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', padding:0 }}>
            ← Back to Plans
          </button>
          <button
            onClick={() => setVoiceSheetOpen(true)}
            style={{ display:'flex', alignItems:'center', gap:6, height:36, padding:'0 12px', borderRadius:18, background:voiceOn ? C.gold+'22' : C.section, border:`1px solid ${voiceOn ? C.gold : C.border}`, color:voiceOn ? C.gold : C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
            {voiceOn ? '🔊' : '🔇'}
            <span>{voiceOn ? 'Voice on' : 'Muted'}</span>
          </button>
        </div>

        <UTCClock/>

        {/* Tab nav */}
        <div style={{ display:'flex', gap:6, marginBottom:20 }}>
          {[['registry','💾 March Times'],['calc','🧮 Calculator'],['timers','⏱ Live Timers']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)}
              style={{ flex:1, height:44, borderRadius:20, whiteSpace:'nowrap', background:view===id?C.gold+'22':C.section, border:`1px solid ${view===id?C.gold:C.border}`, color:view===id?C.gold:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Live Timers tab ── */}
        {view === 'timers' && (
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {state.timers.length < 5 && (
                <button onClick={() => { setEditingTimer(null); setSheetOpen(true); }}
                  style={{ flex:1, height:48, borderRadius:12, background:C.section, border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                  ＋ New timer manually
                </button>
              )}
              {state.timers.length > 0 && !clearConfirm && (
                <button onClick={() => setClearConfirm(true)}
                  style={{ height:48, padding:'0 16px', borderRadius:12, background:C.red+'18', border:`1px solid ${C.red}44`, color:C.red, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  Clear all
                </button>
              )}
              {clearConfirm && (
                <div style={{ display:'flex', gap:6, flex:1 }}>
                  <button onClick={() => setClearConfirm(false)}
                    style={{ flex:1, height:48, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={() => { setState(prev => ({ ...prev, timers:[] })); setClearConfirm(false); vibe([20,20,20]); }}
                    style={{ flex:2, height:48, borderRadius:12, background:C.red, color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>
                    Clear all timers
                  </button>
                </div>
              )}
            </div>

            {state.timers.length === 0 && (
              <div style={{ textAlign:'center', padding:'32px 20px' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>⏱</div>
                <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:6 }}>No active timers</div>
                <div style={{ fontSize:13, color:C.muted, marginBottom:20, lineHeight:1.6 }}>
                  Timers are created from the Calculator once each leader enters their march time.
                  <br/><span style={{ color:C.gold }}>1.</span> Add leaders in 💾 March Times
                  <br/><span style={{ color:C.gold }}>2.</span> Set impact time in 🧮 Calculator
                  <br/><span style={{ color:C.gold }}>3.</span> Each leader enters their march time
                  <br/><span style={{ color:C.gold }}>4.</span> Press 🔴 Start Timers
                </div>
                <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                  <button onClick={() => setView('registry')} style={{ height:44, padding:'0 18px', borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>💾 March Times</button>
                  <button onClick={() => setView('calc')}     style={{ height:44, padding:'0 18px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:13, border:'none', cursor:'pointer' }}>🧮 Calculator →</button>
                </div>
              </div>
            )}

            {state.timers.map(t => (
              <TimerCard key={t.id} timer={t}
                onEdit={t => { setEditingTimer(t); setSheetOpen(true); }}
                onDelete={deleteTimer}
                onLeaderMode={setLeaderTimer}
                onUpdateJoiner={updateJoiner}
              />
            ))}

            {state.timers.length >= 5 && (
              <div style={{ textAlign:'center', fontSize:13, color:C.muted, padding:'8px 0' }}>
                Maximum 5 timers. Delete one to add another.
              </div>
            )}

            {state.archived?.length > 0 && (
              <ArchivedSection archived={state.archived} onClear={() => setState(prev => ({ ...prev, archived:[] }))}/>
            )}
          </div>
        )}

        {view === 'calc' && (
          <Calculator
            calc={state.calculator}
            onChange={calculator => setState(prev => ({ ...prev, calculator }))}
            registry={state.marchRegistry}
            onStartTimers={handleStartTimers}
          />
        )}

        {view === 'registry' && (
          <MarchRegistry
            registry={state.marchRegistry}
            onChange={marchRegistry => setState(prev => ({ ...prev, marchRegistry }))}
            players={players}
          />
        )}
      </div>

      <TimerSheet
        timer={editingTimer}
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditingTimer(null); setPrefillImpact(null); }}
        onSave={saveTimer}
        prefillImpact={prefillImpact}
      />
    </>
  );
}
