import { useState } from 'react';
import { useLiveBattleRoom } from '../../hooks/useLiveBattleRoom.js';
import { useBattleClock } from '../../hooks/useBattleClock.js';
import { timerActionAt, CLOSED } from '../../services/battleOperationsService.js';
import { SwitchingPanel } from './rally/SwitchingPanel.jsx';
import { CommandSummary } from './rally/CommandSummary.jsx';
import { LegacyBattleImport } from './rally/LegacyBattleImport.jsx';
import { BattleBackup } from './rally/BattleBackup.jsx';
import { TimerActions } from './rally/TimerActions.jsx';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import {
  uid,
} from './rally/rallyRoomHelpers.js';
import { UTCClock }        from './rally/UTCClock.jsx';
import { TimerCard }       from './rally/TimerCard.jsx';
import { LeaderMode }      from './rally/LeaderMode.jsx';
import { Calculator }      from './rally/Calculator.jsx';
import { MarchRegistry }   from './rally/MarchRegistry.jsx';
import { ArchivedSection, TimerSheet } from './rally/ArchivedSection.jsx';

// ── LiveRallyRoom ──────────────────────────────────────────────
export function LiveRallyRoom({ onBack, players = [], planData = null }) {
  const room = useLiveBattleRoom(planData,players);
  const {state,setState,timers,saveTimer}=room;
  const {now,warning}=useBattleClock();
  const [view, setView]                     = useState('registry');
  const [editingTimer, setEditingTimer]     = useState(null);
  const [sheetOpen, setSheetOpen]           = useState(false);
  const [prefillImpact, setPrefillImpact]   = useState(null);
  const [leaderTimer, setLeaderTimer]       = useState(null);
  const [toastMsg, setToastMsg]             = useState(null);
  const [clearConfirm, setClearConfirm]     = useState(false);
  const [allRalliesCopied, setAllRalliesCopied] = useState(false);
  function showToast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); }

  // Every rally currently in the calculator, one Discord-ready block —
  // not per-leader like the individual copy buttons. leader.joiners and
  // leader.ratio already carry through from the Battle Plan's rally
  // slots (see the Go Live pre-populate effect above and
  // handleStartTimers below), so this includes who's assigned and what
  // hero they're bringing without any extra plumbing.
  function generateAllRalliesText() {
    const lines = ['📋 Live Rally Room — All Rallies', ''];
    lines.push("Priority joiners must join FIRST, before anyone else. If a priority joiner is pulled from a rally, whoever joins in their place must match that slot's ratio and hero before joining.");
    lines.push('');
    state.calculator.leaders.forEach(l => {
      lines.push(`${l.type || 'Rally'} — ${l.name}`);
      if (l.ratio) lines.push(`Ratio: ${l.ratio}`);
      const filled = (l.joiners || []).filter(j => j.heroName);
      if (filled.length) lines.push(`Priority joiners: ${filled.map(j => `${j.heroName} → ${j.playerName || '?'}`).join(', ')}`);
      lines.push('');
    });
    return '```\n' + lines.join('\n').trim() + '\n```';
  }
  function copyAllRallies() {
    navigator.clipboard.writeText(generateAllRalliesText()).then(() => {
      setAllRalliesCopied(true);
      setTimeout(() => setAllRalliesCopied(false), 2000);
    }).catch(()=>showToast('Copy unavailable'));
  }

  function deleteTimer(id) { const timer=timers.find(t=>t.id===id); if(timer)saveTimer({...timer,status:'Cancelled'}); }

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

  function handleStartTimers(newTimers) { room.addTimers(newTimers); setView('timers'); vibe([10,40,10]); }

  return (
    <>
      {leaderTimer && <LeaderMode timer={{...(timers.find(t=>t.id===leaderTimer.id)||leaderTimer),paused:state.paused}} allTimers={timers} onClose={() => setLeaderTimer(null)}/>}

      {toastMsg && (
        <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', background:C.card+'ee', backdropFilter:'blur(12px)', border:`1px solid ${C.gold}44`, borderRadius:20, padding:'10px 20px', fontSize:14, fontWeight:600, color:C.gold, zIndex:800, whiteSpace:'nowrap', pointerEvents:'none' }}>
          {toastMsg}
        </div>
      )}

      <div style={{ padding:'16px 20px 0' }}>
        {/* Top bar: back */}
        <div style={{ marginBottom:16 }}>
          <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', padding:0 }}>
            ← Back to Plans
          </button>
        </div>

        <UTCClock/>
        {room.error && <div role="alert" style={{color:C.red,fontSize:14,marginBottom:12}}>{room.error}</div>}
        {state.planName && <div style={{color:C.icy,fontSize:14,marginBottom:12}}>{state.planName}</div>}

        {/* Tab nav */}
        <div style={{ display:'flex', gap:6, marginBottom:20 }}>
          {[['registry','💾 Leaders'],['calc','🧮 Timing'],['timers','⏱ Live']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)}
              style={{ flex:1, height:44, borderRadius:20, whiteSpace:'nowrap', background:view===id?C.gold+'22':C.section, border:`1px solid ${view===id?C.gold:C.border}`, color:view===id?C.gold:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Live Timers tab ── */}
        {view === 'timers' && (
          <div>
            <CommandSummary timers={timers} now={now} paused={state.paused} onPause={paused=>room.mutate('Sequence pause changed',prev=>({...prev,paused}))} battleStatus={state.battleStatus} onStatus={battleStatus=>room.mutate('Castle status changed',prev=>({...prev,battleStatus}))} warning={warning} templates={state.templates} onTemplates={templates=>room.mutate('Callouts updated',prev=>({...prev,templates}))} audit={state.audit} registry={state.marchRegistry}/>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {true && (
                <button onClick={() => { setEditingTimer(null); setSheetOpen(true); }}
                  style={{ flex:1, height:48, borderRadius:12, background:C.section, border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                  ＋ New timer manually
                </button>
              )}
              {state.timers.length > 0 && !clearConfirm && (
                <button onClick={() => setClearConfirm(true)}
                  style={{ height:48, padding:'0 16px', borderRadius:12, background:C.red+'18', border:`1px solid ${C.red}44`, color:C.red, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  Cancel planned
                </button>
              )}
              {clearConfirm && (
                <div style={{ display:'flex', gap:6, flex:1 }}>
                  <button onClick={() => setClearConfirm(false)}
                    style={{ flex:1, height:48, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={() => { room.mutate('Planned actions cancelled',prev=>({...prev,timers:prev.timers.map(t=>!t.status||['Planned','Ready'].includes(t.status)?{...t,status:'Cancelled'}:t)})); setClearConfirm(false); vibe([20,20,20]); }}
                    style={{ flex:2, height:48, borderRadius:12, background:C.red, color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>
                    Cancel planned actions
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
                  <br/><span style={{ color:C.gold }}>2.</span> Pick a timing mode in 🧮 Calculator
                  <br/><span style={{ color:C.gold }}>3.</span> Each leader enters their march time
                  <br/><span style={{ color:C.gold }}>4.</span> Press Start Timers
                </div>
                <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                  <button onClick={() => setView('registry')} style={{ height:44, padding:'0 18px', borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>💾 March Times</button>
                  <button onClick={() => setView('calc')}     style={{ height:44, padding:'0 18px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:13, border:'none', cursor:'pointer' }}>🧮 Calculator →</button>
                </div>
              </div>
            )}

            {[...timers].sort((a,b)=>Number(CLOSED.includes(a.status))-Number(CLOSED.includes(b.status))||timerActionAt(a)-timerActionAt(b)).map(t => (
              <div key={t.id} data-timer-id={t.id} style={{background:C.card,borderRadius:14,marginBottom:12,overflow:'hidden'}}>
                <TimerCard timer={t} now={now} paused={state.paused}
                  onEdit={timer => { setEditingTimer(timer); setSheetOpen(true); }}
                  onDelete={deleteTimer} onLeaderMode={setLeaderTimer} onUpdateJoiner={updateJoiner}/>
                <TimerActions timer={t} timers={timers} onSave={saveTimer} onDuplicate={timer=>room.addTimers([timer])} onArchive={room.archive} now={now} templates={state.templates}/>
              </div>
            ))}

            {state.archived?.length > 0 && (
              <ArchivedSection archived={state.archived} onClear={() => setState(prev => ({ ...prev, archived:[] }))}/>
            )}
          </div>
        )}

        {view === 'calc' && (
          <>
            {state.calculator.leaders.length > 0 && (
              <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:6 }}>📋 All Rallies</div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>Every rally in this session — joiner heroes and assigned players included — copied as one Discord-ready block, not one at a time.</div>
                <button onClick={copyAllRallies}
                  style={{ width:'100%', height:44, borderRadius:10, background:allRalliesCopied?C.green+'18':C.gold+'18', border:`1px solid ${allRalliesCopied?C.green:C.gold}44`, color:allRalliesCopied?C.green:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {allRalliesCopied ? '✓ Copied' : '📋 Copy all rallies as code block'}
                </button>
              </div>
            )}
            <Calculator
              calc={state.calculator}
              onChange={calculator => setState(prev => ({ ...prev, calculator }))}
              registry={state.marchRegistry}
              onStartTimers={handleStartTimers}
            />
            <SwitchingPanel timers={timers} leaders={state.marchRegistry} draft={state.switchingDraft} onChange={switchingDraft=>setState(prev=>({...prev,switchingDraft}))} onAdd={seq=>{room.addTimers(seq);setView('timers');}} now={now} planDate={planData?.date}/>
            <div style={{marginTop:16,display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={room.preset} style={{minHeight:44,padding:'8px 14px',borderRadius:10,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontSize:14}}>Save timing preset</button>
            <select aria-label="Load timing preset" value="" onChange={e=>room.loadPreset(e.target.value)} style={{minHeight:44,maxWidth:'100%',borderRadius:10,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontSize:16}}><option value="">Load preset</option>{state.presets?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          </>
        )}

        {view === 'registry' && (
          <>
          <MarchRegistry
            registry={state.marchRegistry}
            onChange={marchRegistry => room.mutate('Leader registry updated',prev => ({ ...prev, marchRegistry,calculator:{...prev.calculator,leaders:prev.calculator.leaders.map(l=>{const saved=marchRegistry.find(r=>r.id===l.registryId || l.playerId && r.playerId===l.playerId || r.name===l.name);return saved?{...l,marchSecs:saved.marchSecs}:l;})} }))}
            players={players}
          />
          <BattleBackup state={state} onRestore={room.restore}/>
          <LegacyBattleImport onAdd={room.addTimers}/>
          </>
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
