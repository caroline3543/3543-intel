import { useState, useEffect, useRef } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import {
  parseMarchInput, validateMarchInput, fmtMarch, fmtMarchCompact,
  parseImpactInput, validateImpactInput,
} from '../../services/rallyTimingParser.js';

// ── Constants ──────────────────────────────────────────────────
const RALLY_TYPES = [
  'Main Rally','Counter Rally','Counter-Counter',
  'Switch Fight','Garrison Entry','Reinforcement','Custom',
];

const RALLY_COLORS = {
  'Main Rally':       '#F5A623',
  'Counter Rally':    '#FF453A',
  'Counter-Counter':  '#FF8C00',
  'Switch Fight':     '#30D158',
  'Garrison Entry':   '#6B8CAE',
  'Reinforcement':    '#7BAE8C',
  'Custom':           '#A8C4D8',
};

const OFFSETS = [-5, -2, -1, 0, 1, 2, 5];

const STORAGE_KEY = 'svs_live_rally_room';

const STAGE_RULES = [
  { threshold: 30, label: 'Get Ready',          color: '#A8C4D8' },
  { threshold: 10, label: 'Hover March Button', color: '#F5A623' },
  { threshold: 5,  label: 'Prepare To Send',    color: '#FF8C00' },
  { threshold: 0,  label: 'SEND NOW',           color: '#FF453A' },
];

const DEFAULT_MSG_TEMPLATE =
`RALLY COORDINATION

Type: {type}
Impact: {impact} UTC
Send at: {send} UTC

Join now. Do not solo.
Wait for the countdown.`;

// ── Helpers ────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function utcNowSecs() {
  const n = new Date();
  return n.getUTCHours() * 3600 + n.getUTCMinutes() * 60 + n.getUTCSeconds();
}

function utcNowStr() {
  const n = new Date();
  return [
    String(n.getUTCHours()).padStart(2,'0'),
    String(n.getUTCMinutes()).padStart(2,'0'),
    String(n.getUTCSeconds()).padStart(2,'0'),
  ].join(':');
}

function secsToHHMMSS(s) {
  if (s == null || isNaN(s)) return '--:--:--';
  const abs = Math.abs(Math.round(s));
  const h   = Math.floor(abs / 3600);
  const m   = Math.floor((abs % 3600) / 60);
  const sec = abs % 60;
  const str = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return s < 0 ? `-${str}` : str;
}

function getStage(secsLeft) {
  if (secsLeft <= 0)  return STAGE_RULES[3];
  if (secsLeft <= 5)  return STAGE_RULES[2];
  if (secsLeft <= 10) return STAGE_RULES[1];
  if (secsLeft <= 30) return STAGE_RULES[0];
  return null;
}

function calcSendSecs(impactSecs, marchSecs, offsetSecs = 0) {
  if (impactSecs == null || marchSecs == null) return null;
  return impactSecs - marchSecs + offsetSecs;
}

function fmtSendTime(secs) {
  if (secs == null) return null;
  const h = Math.floor(((secs % 86400) + 86400) % 86400 / 3600);
  const m = Math.floor(((secs % 3600) + 3600) % 3600 / 60);
  const s = ((secs % 60) + 60) % 60;
  if (s === 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Persistence ────────────────────────────────────────────────
function loadState() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) {
      const parsed = JSON.parse(r);
      // Defensively ensure all arrays exist (handles stale localStorage from old versions)
      return {
        timers:        Array.isArray(parsed.timers)        ? parsed.timers        : [],
        marchRegistry: Array.isArray(parsed.marchRegistry) ? parsed.marchRegistry : [],
        calculator: {
          impactTimeRaw:   parsed.calculator?.impactTimeRaw   || '',
          impactSecs:      parsed.calculator?.impactSecs      || null,
          leaders:         Array.isArray(parsed.calculator?.leaders) ? parsed.calculator.leaders : [],
          messageTemplate: parsed.calculator?.messageTemplate || DEFAULT_MSG_TEMPLATE,
        },
      };
    }
  } catch {}
  return null;
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

const DEFAULT_STATE = {
  timers: [],
  calculator: { impactTimeRaw: '', leaders: [], messageTemplate: DEFAULT_MSG_TEMPLATE },
  marchRegistry: [], // [{ id, name, marchSecs }]
};

// ── Smart march input component ────────────────────────────────
function MarchInput({ value, onChange, placeholder = 'e.g. 412  or  4:12' }) {
  const [raw, setRaw]         = useState(value != null ? String(value) : '');
  const [preview, setPreview] = useState(null);
  const [error, setError]     = useState(null);

  // Sync external value changes (e.g. when a saved leader is loaded)
  useEffect(() => {
    if (value != null && raw === '') {
      setRaw(fmtMarchCompact(value));
      setPreview(fmtMarch(value));
    }
  }, [value]);

  function handle(input) {
    setRaw(input);
    if (!input) { setPreview(null); setError(null); onChange(null); return; }
    const v = validateMarchInput(input);
    if (v.error) { setError(v.error); setPreview(null); onChange(null); }
    else if (v.valid) { setError(null); setPreview(fmtMarch(v.totalSecs)); onChange(v.totalSecs); }
    else { setError(null); setPreview(null); onChange(null); }
  }

  return (
    <div>
      <input
        value={raw}
        onChange={e => handle(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        style={{
          width: '100%', background: C.section,
          border: `1px solid ${error ? C.red : preview ? C.green : C.border}`,
          borderRadius: 10, padding: '12px 14px', fontSize: 16,
          color: C.white, boxSizing: 'border-box', fontFamily: 'inherit',
        }}
      />
      {preview && <div style={{ fontSize: 12, color: C.green, marginTop: 4 }}>= {preview}</div>}
      {error   && <div style={{ fontSize: 12, color: C.red,   marginTop: 4 }}>⚠ {error}</div>}
    </div>
  );
}

// ── Smart impact time input ────────────────────────────────────
function ImpactInput({ value, onChange, placeholder = 'e.g. 2200  or  22:00' }) {
  const [raw, setRaw]         = useState(value || '');
  const [preview, setPreview] = useState(null);
  const [error, setError]     = useState(null);
  const [passed, setPassed]   = useState(false);

  function handle(input) {
    setRaw(input);
    if (!input) { setPreview(null); setError(null); setPassed(false); onChange(null, null); return; }
    const v = validateImpactInput(input);
    if (v.error) { setError(v.error); setPreview(null); setPassed(false); onChange(null, null); }
    else if (v.valid) {
      setError(null);
      setPreview(v.display);
      const p = v.totalSecs < utcNowSecs();
      setPassed(p);
      onChange(v.display, v.totalSecs);
    }
  }

  return (
    <div>
      <input
        value={raw}
        onChange={e => handle(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        style={{
          width: '100%', background: C.section,
          border: `1px solid ${error ? C.red : preview ? C.green : C.border}`,
          borderRadius: 10, padding: '14px', fontSize: 20,
          color: C.white, boxSizing: 'border-box',
          fontFamily: 'monospace', letterSpacing: '0.05em',
        }}
      />
      {preview && !error && (
        <div style={{ fontSize: 13, color: passed ? C.red : C.green, marginTop: 4 }}>
          {passed ? `⚠ ${preview} UTC — this time has already passed today` : `→ ${preview} UTC`}
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>⚠ {error}</div>}
    </div>
  );
}

// ── UTC Clock ──────────────────────────────────────────────────
function UTCClock() {
  const [time, setTime] = useState(utcNowStr());
  useEffect(() => { const id = setInterval(() => setTime(utcNowStr()), 1000); return () => clearInterval(id); }, []);
  const n    = new Date();
  const left = 86400 - (n.getUTCHours()*3600 + n.getUTCMinutes()*60 + n.getUTCSeconds());
  return (
    <div style={{ background:C.section, borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div>
        <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>UTC Time</div>
        <div style={{ fontSize:22, fontWeight:700, color:C.gold, fontVariantNumeric:'tabular-nums', letterSpacing:'0.05em' }}>{time}</div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>Reset in</div>
        <div style={{ fontSize:14, fontWeight:600, color:C.icy }}>{secsToHHMMSS(left)}</div>
      </div>
    </div>
  );
}

// ── March Registry Panel ───────────────────────────────────────
function MarchRegistry({ registry, onChange, players = [] }) {
  const [newName, setNewName]   = useState('');
  const [newMarch, setNewMarch] = useState(null);
  const [newRaw, setNewRaw]     = useState('');

  // Rally leads from roster who aren't in registry yet
  const rallyLeads = (players||[]).filter(p => p.roles?.includes('Rally Lead'));

  function add() {
    if (!newName || !newMarch) return;
    onChange([...registry, { id: uid(), name: newName.trim(), marchSecs: newMarch }]);
    setNewName(''); setNewMarch(null); setNewRaw('');
    vibe(8);
  }

  function remove(id) { onChange(registry.filter(r => r.id !== id)); }

  function updateMarch(id, marchSecs) {
    onChange(registry.map(r => r.id === id ? { ...r, marchSecs } : r));
  }

  function addFromRoster(player) {
    if (registry.some(r => r.name === player.username)) return;
    onChange([...registry, { id: uid(), name: player.username, marchSecs: player.marchSecs || null }]);
    vibe(8);
  }

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:4 }}>March Times</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Save march times for your rally leaders. They'll appear as chips in the calculator.</div>

      {/* Quick add from roster */}
      {rallyLeads.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Quick add from roster</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {rallyLeads.map(p => {
              const inReg = registry.some(r => r.name === p.username);
              return (
                <button key={p.id} onClick={() => addFromRoster(p)} disabled={inReg} style={{ padding:'8px 14px', borderRadius:20, minHeight:38, border:`1px solid ${inReg?C.border:C.gold}`, background:inReg?C.section:C.gold+'18', color:inReg?C.muted:C.gold, fontWeight:600, fontSize:13, cursor:inReg?'default':'pointer' }}>
                  {inReg ? '✓ ' : '+ '}{p.username}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Existing registry entries */}
      {registry.map(entry => (
        <div key={entry.id} style={{ background:C.section, borderRadius:10, padding:12, marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, fontWeight:700, color:C.white, fontSize:14 }}>{entry.name}</div>
          <div style={{ width:120 }}>
            <MarchInput
              value={entry.marchSecs}
              onChange={v => updateMarch(entry.id, v)}
              placeholder="march time"
            />
          </div>
          {entry.marchSecs && (
            <div style={{ fontSize:13, color:C.green, minWidth:50, textAlign:'right' }}>{fmtMarchCompact(entry.marchSecs)}</div>
          )}
          <button onClick={() => remove(entry.id)} style={{ background:'none', border:'none', color:C.red+'88', fontSize:18, cursor:'pointer', flexShrink:0 }}>✕</button>
        </div>
      ))}

      {/* Add new */}
      <div style={{ background:C.section, borderRadius:10, padding:12, marginTop:8 }}>
        <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>Add new leader</div>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Name"
          style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit', marginBottom:8 }}
        />
        <MarchInput value={newMarch} onChange={v => setNewMarch(v)} placeholder="March time (e.g. 412)"/>
        <button
          onClick={add}
          disabled={!newName || !newMarch}
          style={{ width:'100%', height:44, borderRadius:10, background:newName&&newMarch?C.gold:C.border, color:C.bg, fontWeight:700, fontSize:14, border:'none', cursor:newName&&newMarch?'pointer':'default', marginTop:10 }}
        >
          Save leader
        </button>
      </div>
    </div>
  );
}

// ── Timer Card ─────────────────────────────────────────────────
function TimerCard({ timer, onEdit, onDelete, onLeaderMode }) {
  const [now, setNow] = useState(utcNowSecs());
  useEffect(() => { const id = setInterval(() => setNow(utcNowSecs()), 250); return () => clearInterval(id); }, []);

  const parsed   = parseImpactInput(timer.impactTime);
  const impactSecs = parsed?.totalSecs ?? null;
  const secsLeft = impactSecs != null ? impactSecs - now : null;
  const isFired  = secsLeft != null && secsLeft <= 0;
  const stage    = secsLeft != null ? getStage(secsLeft) : null;
  const color    = RALLY_COLORS[timer.type] || C.gold;
  const sendSecs = calcSendSecs(impactSecs, timer.marchSecs, 0);

  const WINDOW   = 300;
  const progress = secsLeft != null ? Math.max(0, Math.min(100, ((WINDOW - Math.max(0, secsLeft)) / WINDOW) * 100)) : 0;

  return (
    <div style={{ background:C.card, borderRadius:14, overflow:'hidden', marginBottom:12, border:`1px solid ${isFired?color:C.border}`, boxShadow:isFired?`0 0 16px ${color}44`:'none' }}>
      <div style={{ height:4, background:C.border }}>
        <div style={{ height:'100%', width:`${progress}%`, background:color, transition:'width 250ms linear' }}/>
      </div>
      <div style={{ padding:'14px 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:color, flexShrink:0 }}/>
              <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{timer.name||timer.type}</div>
            </div>
            <div style={{ fontSize:12, color:C.muted }}>{timer.type}</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => onLeaderMode(timer)} style={{ height:32, padding:'0 10px', borderRadius:16, background:color+'22', border:`1px solid ${color}44`, color, fontWeight:600, fontSize:12, cursor:'pointer' }}>Full screen</button>
            <button onClick={() => onEdit(timer)} style={{ height:32, padding:'0 10px', borderRadius:16, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontSize:12, cursor:'pointer' }}>Edit</button>
            <button onClick={() => onDelete(timer.id)} style={{ height:32, width:32, borderRadius:16, background:'none', border:'none', color:C.red+'88', fontSize:16, cursor:'pointer', lineHeight:1 }}>✕</button>
          </div>
        </div>

        {stage && (
          <div style={{ background:stage.color+'22', border:`1px solid ${stage.color}44`, borderRadius:8, padding:'6px 12px', marginBottom:10, textAlign:'center' }}>
            <div style={{ fontSize:isFired?20:14, fontWeight:800, color:stage.color, letterSpacing:isFired?'0.1em':0 }}>{stage.label}</div>
          </div>
        )}

        <div style={{ textAlign:'center', marginBottom:10 }}>
          <div style={{ fontSize:42, fontWeight:800, color:isFired?color:C.white, fontVariantNumeric:'tabular-nums', letterSpacing:'0.04em', lineHeight:1 }}>
            {secsLeft != null ? secsToHHMMSS(secsLeft) : '--:--:--'}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div style={{ background:C.section, borderRadius:8, padding:'8px 12px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:3 }}>Impact</div>
            <div style={{ fontSize:16, fontWeight:700, color:C.gold }}>{timer.impactTime||'--:--'} UTC</div>
          </div>
          <div style={{ background:C.section, borderRadius:8, padding:'8px 12px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:3 }}>Send at</div>
            <div style={{ fontSize:16, fontWeight:700, color:C.icy }}>
              {sendSecs != null ? fmtSendTime(sendSecs)+' UTC' : timer.marchSecs ? '—' : 'Set march time'}
            </div>
          </div>
        </div>
        {timer.notes && <div style={{ fontSize:12, color:C.icy, marginTop:8, fontStyle:'italic' }}>"{timer.notes}"</div>}
      </div>
    </div>
  );
}

// ── Timer Sheet ────────────────────────────────────────────────
function TimerSheet({ timer, open, onClose, onSave, prefillImpact }) {
  const [t, setT] = useState(() => timer || newTimer());

  useEffect(() => {
    if (open) {
      const base = timer ? { ...timer } : newTimer();
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

  function upd(k, v) { setT(prev => ({ ...prev, [k]: v })); }

  const parsed  = parseImpactInput(t.impactTime);
  const impactSecs = parsed?.totalSecs ?? null;
  const sendSecs   = calcSendSecs(impactSecs, t.marchSecs, 0);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:400, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'90vh', overflowY:'auto', padding:'16px 20px 80px' }}>
        <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:'0 auto 16px' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{timer?'Edit timer':'New timer'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Name</label>
          <input value={t.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. Caroline counter" style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Type</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {RALLY_TYPES.map(type => { const sel=t.type===type; const col=RALLY_COLORS[type]; return (
              <button key={type} onClick={() => upd('type', type)} style={{ padding:'8px 14px', borderRadius:20, minHeight:38, border:`1px solid ${sel?col:C.border}`, background:sel?col+'22':C.section, color:sel?col:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>{type}</button>
            ); })}
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Target impact time (UTC)</label>
          <ImpactInput
            value={t.impactTime}
            onChange={(display, secs) => upd('impactTime', display || '')}
          />
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>March time</label>
          <MarchInput value={t.marchSecs} onChange={v => upd('marchSecs', v)}/>
        </div>

        {sendSecs != null && (
          <div style={{ background:C.section, borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>Send at</div>
            <div style={{ fontSize:22, fontWeight:700, color:C.green, fontVariantNumeric:'tabular-nums' }}>{fmtSendTime(sendSecs)} UTC</div>
          </div>
        )}

        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Notes</label>
          <textarea value={t.notes} onChange={e => upd('notes', e.target.value)} placeholder="Any instructions…" style={{ width:'100%', minHeight:72, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:15, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={() => { onSave(t); onClose(); vibe(8); }} style={{ flex:2, height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:16, border:'none', cursor:'pointer' }}>Save timer</button>
        </div>
      </div>
    </div>
  );
}

function newTimer() { return { id: uid(), name:'', type:'Main Rally', impactTime:'', marchSecs:null, notes:'' }; }

// ── Leader Mode ────────────────────────────────────────────────
function LeaderMode({ timer, onClose }) {
  const [now, setNow] = useState(utcNowSecs());
  const lastStageRef  = useRef(null);

  useEffect(() => { const id = setInterval(() => setNow(utcNowSecs()), 250); return () => clearInterval(id); }, []);
  useEffect(() => {
    function h(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const parsed     = parseImpactInput(timer.impactTime);
  const impactSecs = parsed?.totalSecs ?? null;
  const secsLeft   = impactSecs != null ? impactSecs - now : null;
  const isFired    = secsLeft != null && secsLeft <= 0;
  const stage      = secsLeft != null ? getStage(secsLeft) : null;
  const color      = RALLY_COLORS[timer.type] || C.gold;
  const sendSecs   = calcSendSecs(impactSecs, timer.marchSecs, 0);

  useEffect(() => {
    if (!stage) return;
    if (stage.label !== lastStageRef.current) {
      lastStageRef.current = stage.label;
      if (stage.label === 'SEND NOW') vibe([100,50,100,50,200]);
      else if (stage.label === 'Prepare To Send') vibe([50,30,50]);
      else vibe(30);
    }
  }, [stage?.label]);

  return (
    <div style={{ position:'fixed', inset:0, background:C.bg, zIndex:900, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <button onClick={onClose} style={{ position:'absolute', top:20, right:20, background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer' }}>✕</button>
      <div style={{ fontSize:14, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8 }}>{timer.name||timer.type}</div>
      {stage && <div style={{ fontSize:isFired?28:18, fontWeight:800, color:stage.color, marginBottom:20, textAlign:'center', letterSpacing:isFired?'0.1em':0 }}>{stage.label}</div>}
      <div style={{ fontSize:80, fontWeight:900, color:isFired?color:C.white, fontVariantNumeric:'tabular-nums', letterSpacing:'0.04em', lineHeight:1, marginBottom:24, textAlign:'center' }}>
        {secsLeft != null ? secsToHHMMSS(secsLeft) : '--:--:--'}
      </div>
      <div style={{ display:'flex', gap:24, marginBottom:24 }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:12, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Impact</div>
          <div style={{ fontSize:22, fontWeight:700, color:C.gold }}>{timer.impactTime} UTC</div>
        </div>
        {sendSecs != null && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:12, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Send at</div>
            <div style={{ fontSize:22, fontWeight:700, color:C.green }}>{fmtSendTime(sendSecs)} UTC</div>
          </div>
        )}
      </div>
      {timer.notes && <div style={{ fontSize:14, color:C.icy, fontStyle:'italic', textAlign:'center', maxWidth:320 }}>"{timer.notes}"</div>}
      <button onClick={onClose} style={{ position:'absolute', bottom:40, height:48, padding:'0 32px', borderRadius:24, background:C.section, border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:15, cursor:'pointer' }}>Exit full screen</button>
    </div>
  );
}

// ── Send Calculator ────────────────────────────────────────────
function LeaderCalc({ calc, onChange, registry, onLaunchTimer }) {
  const [now, setNow]           = useState(utcNowSecs());
  const [copied, setCopied]     = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [impactDisplay, setImpactDisplay] = useState(calc.impactTimeRaw || '');
  const [impactSecs, setImpactSecs]       = useState(null);

  useEffect(() => { const id = setInterval(() => setNow(utcNowSecs()), 1000); return () => clearInterval(id); }, []);

  function handleImpact(display, secs) {
    setImpactDisplay(display || '');
    setImpactSecs(secs);
    onChange({ ...calc, impactTimeRaw: display || '', impactSecs: secs });
  }

  function addLeaderFromRegistry(entry) {
    if (calc.leaders.some(l => l.name === entry.name)) return;
    onChange({ ...calc, leaders: [...calc.leaders, { id: uid(), name: entry.name, type: 'Main Rally', marchSecs: entry.marchSecs, offset: 0, notes: '' }] });
    vibe(8);
  }

  function addBlankLeader() {
    onChange({ ...calc, leaders: [...calc.leaders, { id: uid(), name: '', type: 'Main Rally', marchSecs: null, offset: 0, notes: '' }] });
  }

  function updLeader(id, patch) {
    onChange({ ...calc, leaders: calc.leaders.map(l => l.id === id ? { ...l, ...patch } : l) });
  }

  function removeLeader(id) {
    onChange({ ...calc, leaders: calc.leaders.filter(l => l.id !== id) });
  }

  function copyMessage(leader) {
    const sendSecs = calcSendSecs(impactSecs || calc.impactSecs, leader.marchSecs, leader.offset || 0);
    const text = (calc.messageTemplate || DEFAULT_MSG_TEMPLATE)
      .replace('{type}',   leader.type || 'Rally')
      .replace('{impact}', impactDisplay || '--:--')
      .replace('{send}',   sendSecs != null ? fmtSendTime(sendSecs) : '--:--')
      .replace('{name}',   leader.name || '');
    navigator.clipboard.writeText(text).then(() => { setCopied(leader.id); setTimeout(() => setCopied(null), 2000); });
    vibe(8);
  }

  const resolvedImpact = impactSecs ?? calc.impactSecs ?? null;

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:4 }}>Send Calculator</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>One impact time, multiple leaders. Each gets their exact send time.</div>

      {/* Impact time */}
      <div style={{ marginBottom:16 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Target impact time (UTC)</label>
        <ImpactInput value={calc.impactTimeRaw} onChange={handleImpact}/>
      </div>

      {/* Launch timer button */}
      {impactDisplay && (
        <button
          onClick={() => onLaunchTimer(impactDisplay)}
          style={{ width:'100%', height:44, borderRadius:10, background:C.red+'22', border:`1px solid ${C.red}44`, color:C.red, fontWeight:700, fontSize:14, cursor:'pointer', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
        >
          🔴 Launch live timer for {impactDisplay} UTC →
        </button>
      )}

      {/* Registry chips */}
      {registry.filter(r => r.marchSecs).length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Saved leaders — tap to add</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {registry.filter(r => r.marchSecs).map(entry => {
              const already = calc.leaders.some(l => l.name === entry.name);
              return (
                <button key={entry.id} onClick={() => addLeaderFromRegistry(entry)} disabled={already} style={{ padding:'8px 14px', borderRadius:20, minHeight:38, border:`1px solid ${already?C.border:C.gold}`, background:already?C.section:C.gold+'18', color:already?C.muted:C.gold, fontWeight:600, fontSize:13, cursor:already?'default':'pointer' }}>
                  {already?'✓ ':''}{entry.name} · {fmtMarchCompact(entry.marchSecs)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Leader rows */}
      {calc.leaders.map(leader => {
        const sendSecs = resolvedImpact != null && leader.marchSecs
          ? calcSendSecs(resolvedImpact, leader.marchSecs, leader.offset || 0) : null;
        return (
          <div key={leader.id} style={{ background:C.section, borderRadius:12, padding:14, marginBottom:10 }}>
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <input value={leader.name} onChange={e => updLeader(leader.id, {name:e.target.value})} placeholder="Leader name" style={{ flex:1, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:15, color:C.white, fontFamily:'inherit' }}/>
              <button onClick={() => removeLeader(leader.id)} style={{ width:40, height:40, borderRadius:8, background:'none', border:'none', color:C.red+'88', fontSize:18, cursor:'pointer' }}>✕</button>
            </div>

            <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:6, marginBottom:10 }}>
              {RALLY_TYPES.slice(0,5).map(type => { const sel=leader.type===type; const col=RALLY_COLORS[type]; return (
                <button key={type} onClick={() => updLeader(leader.id, {type})} style={{ padding:'6px 12px', borderRadius:16, whiteSpace:'nowrap', border:`1px solid ${sel?col:C.border}`, background:sel?col+'22':C.card, color:sel?col:C.muted, fontWeight:600, fontSize:12, cursor:'pointer', flexShrink:0 }}>{type}</button>
              ); })}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:4 }}>March time</label>
                <MarchInput value={leader.marchSecs} onChange={v => updLeader(leader.id, {marchSecs:v})}/>
              </div>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:4 }}>Landing offset (s)</label>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {OFFSETS.map(o => (
                    <button key={o} onClick={() => updLeader(leader.id, {offset:o})} style={{ padding:'6px 8px', borderRadius:8, border:`1px solid ${leader.offset===o?C.gold:C.border}`, background:leader.offset===o?C.gold+'22':C.card, color:leader.offset===o?C.gold:C.muted, fontWeight:600, fontSize:11, cursor:'pointer', minWidth:32 }}>
                      {o>0?`+${o}`:o}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {sendSecs != null ? (
              <div style={{ background:C.bg, borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>Send at</div>
                  <div style={{ fontSize:20, fontWeight:700, color:C.green, fontVariantNumeric:'tabular-nums' }}>{fmtSendTime(sendSecs)} UTC</div>
                  {leader.offset !== 0 && <div style={{ fontSize:11, color:C.muted }}>Lands {leader.offset>0?`+${leader.offset}s`:`${leader.offset}s`} from impact</div>}
                </div>
                <button onClick={() => copyMessage(leader)} style={{ height:40, padding:'0 14px', borderRadius:10, background:copied===leader.id?C.green+'22':C.section, border:`1px solid ${copied===leader.id?C.green:C.border}`, color:copied===leader.id?C.green:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  {copied===leader.id?'✓ Copied':'📋 Copy'}
                </button>
              </div>
            ) : (
              <div style={{ fontSize:12, color:C.muted, textAlign:'center', padding:'8px 0' }}>Enter march time to see send time</div>
            )}

            <input value={leader.notes} onChange={e => updLeader(leader.id, {notes:e.target.value})} placeholder="Notes (optional)" style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:13, color:C.icy, boxSizing:'border-box', fontFamily:'inherit', marginTop:8 }}/>
          </div>
        );
      })}

      <button onClick={addBlankLeader} style={{ width:'100%', height:44, borderRadius:10, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', marginBottom:16 }}>
        ＋ Add leader manually
      </button>

      {/* Message template */}
      <button onClick={() => setShowTemplate(!showTemplate)} style={{ background:'none', border:'none', color:C.gold, fontSize:13, cursor:'pointer', padding:'4px 0', marginBottom:8 }}>
        {showTemplate?'▾':'▸'} Edit message template
      </button>
      {showTemplate && (
        <div style={{ background:C.section, borderRadius:10, padding:12 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Variables: {'{type}'} {'{impact}'} {'{send}'} {'{name}'}</div>
          <textarea value={calc.messageTemplate||DEFAULT_MSG_TEMPLATE} onChange={e => onChange({...calc, messageTemplate:e.target.value})} style={{ width:'100%', minHeight:140, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:13, color:C.white, resize:'vertical', boxSizing:'border-box', fontFamily:'monospace' }}/>
          <button onClick={() => onChange({...calc, messageTemplate:DEFAULT_MSG_TEMPLATE})} style={{ fontSize:12, color:C.muted, background:'none', border:'none', cursor:'pointer', padding:'4px 0' }}>Reset to default</button>
        </div>
      )}
    </div>
  );
}

// ── LiveRallyRoom ──────────────────────────────────────────────
export function LiveRallyRoom({ onBack, players = [] }) {
  const [state, setState]     = useState(() => loadState() || DEFAULT_STATE);
  const [view, setView]       = useState('timers');
  const [editingTimer, setEditingTimer] = useState(null);
  const [sheetOpen, setSheetOpen]       = useState(false);
  const [prefillImpact, setPrefillImpact] = useState(null);
  const [leaderTimer, setLeaderTimer]   = useState(null);

  useEffect(() => { saveState(state); }, [state]);

  function saveTimer(t) {
    setState(prev => ({
      ...prev,
      timers: prev.timers.some(x => x.id === t.id)
        ? prev.timers.map(x => x.id === t.id ? t : x)
        : [...prev.timers, t],
    }));
  }

  function deleteTimer(id) { setState(prev => ({ ...prev, timers: prev.timers.filter(t => t.id !== id) })); }

  function openNew(prefill = null) { setEditingTimer(null); setPrefillImpact(prefill); setSheetOpen(true); }

  function handleLaunchTimer(impactDisplay) {
    setPrefillImpact(impactDisplay);
    setEditingTimer(null);
    setSheetOpen(true);
    setView('timers');
  }

  return (
    <>
      {leaderTimer && <LeaderMode timer={leaderTimer} onClose={() => setLeaderTimer(null)} />}

      <div style={{ padding:'16px 20px 0' }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:16, padding:0 }}>
          ← Back to Plans
        </button>

        <UTCClock />

        <div style={{ display:'flex', gap:6, marginBottom:20, overflowX:'auto' }}>
          {[['timers','⏱ Live Timers'],['calc','🧮 Calculator'],['registry','💾 March Times']].map(([id,label]) => (
            <button key={id} onClick={() => setView(id)} style={{ flex:1, height:44, borderRadius:20, whiteSpace:'nowrap', background:view===id?C.gold+'22':C.section, border:`1px solid ${view===id?C.gold:C.border}`, color:view===id?C.gold:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>{label}</button>
          ))}
        </div>

        {view==='timers' && (
          <div>
            {state.timers.length < 5 && (
              <button onClick={() => openNew()} style={{ width:'100%', height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer', marginBottom:16 }}>
                ＋ New timer
              </button>
            )}
            {state.timers.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 20px' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>⏱</div>
                <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:8 }}>No active timers</div>
                <div style={{ fontSize:14, color:C.muted }}>Up to 5 simultaneous timers. Or use the Calculator to plan send times, then launch a timer from there.</div>
              </div>
            )}
            {state.timers.map(t => (
              <TimerCard key={t.id} timer={t} onEdit={t => { setEditingTimer(t); setSheetOpen(true); }} onDelete={deleteTimer} onLeaderMode={setLeaderTimer}/>
            ))}
            {state.timers.length >= 5 && (
              <div style={{ textAlign:'center', fontSize:13, color:C.muted, padding:'8px 0' }}>Maximum 5 timers. Delete one to add another.</div>
            )}
          </div>
        )}

        {view==='calc' && (
          <LeaderCalc
            calc={state.calculator}
            onChange={calculator => setState(prev => ({ ...prev, calculator }))}
            registry={state.marchRegistry}
            onLaunchTimer={handleLaunchTimer}
          />
        )}

        {view==='registry' && (
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
