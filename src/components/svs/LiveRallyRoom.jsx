import { useState, useEffect, useRef, useCallback } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';

// ── Constants ──────────────────────────────────────────────────
const RALLY_TYPES = [
  'Main Rally', 'Counter Rally', 'Counter-Counter',
  'Switch Fight', 'Garrison Entry', 'Reinforcement', 'Custom',
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
  { threshold: 30, label: 'Get Ready',           color: '#A8C4D8' },
  { threshold: 10, label: 'Hover March Button',  color: '#F5A623' },
  { threshold: 5,  label: 'Prepare To Send',     color: '#FF8C00' },
  { threshold: 0,  label: 'SEND NOW',            color: '#FF453A' },
];

const DEFAULT_MESSAGE_TEMPLATE =
  'RALLY COORDINATION\n\nType: {type}\nTarget: Sunfire Castle\nImpact: {impact} UTC\nSend: {send} UTC\n\nJoin now. Do not solo.\nWait for countdown.';

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
  const hms = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return s < 0 ? `-${hms}` : hms;
}

function parseHHMM(str) {
  // Accepts HH:mm or HH:mm:ss
  if (!str) return null;
  const parts = str.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function fmtHHMM(totalSecs) {
  if (totalSecs == null) return '';
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.floor(totalSecs % 60);
  if (s === 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function fmtMarchSecs(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec === 0 ? `${m}m` : `${m}m ${sec}s`;
}

function getStage(secsLeft) {
  if (secsLeft <= 0)  return STAGE_RULES[3];
  if (secsLeft <= 5)  return STAGE_RULES[2];
  if (secsLeft <= 10) return STAGE_RULES[1];
  if (secsLeft <= 30) return STAGE_RULES[0];
  return null;
}

function calcSendTime(impactSecs, marchSecs, offsetSecs) {
  if (impactSecs == null || marchSecs == null) return null;
  return impactSecs - marchSecs + (offsetSecs || 0);
}

function hasPassed(impactSecs) {
  return impactSecs != null && impactSecs < utcNowSecs();
}

// ── Load/Save ──────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

const DEFAULT_STATE = {
  timers: [],
  calculator: {
    impactTime: '',
    leaders: [],
    messageTemplate: DEFAULT_MESSAGE_TEMPLATE,
  },
};

// ── UTC Clock ──────────────────────────────────────────────────
function UTCClock() {
  const [time, setTime] = useState(utcNowStr());
  useEffect(() => {
    const id = setInterval(() => setTime(utcNowStr()), 1000);
    return () => clearInterval(id);
  }, []);

  // Time until reset
  const now     = new Date();
  const secsLeft = 86400 - (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds());

  return (
    <div style={{ background: C.section, borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>UTC Time</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.gold, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em' }}>{time}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Reset in</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.icy }}>{secsToHHMMSS(secsLeft)}</div>
      </div>
    </div>
  );
}

// ── Timer Card ─────────────────────────────────────────────────
function TimerCard({ timer, onEdit, onDelete, onLeaderMode }) {
  const [now, setNow] = useState(utcNowSecs());

  useEffect(() => {
    const id = setInterval(() => setNow(utcNowSecs()), 250);
    return () => clearInterval(id);
  }, []);

  const impactSecs = parseHHMM(timer.impactTime);
  const secsLeft   = impactSecs != null ? impactSecs - now : null;
  const isFired    = secsLeft != null && secsLeft <= 0;
  const stage      = secsLeft != null ? getStage(secsLeft) : null;
  const color      = RALLY_COLORS[timer.type] || C.gold;
  const passed     = hasPassed(impactSecs);

  // Progress: 0–100 over last 5 minutes before impact
  const WINDOW = 300;
  const progress = secsLeft != null
    ? Math.max(0, Math.min(100, ((WINDOW - Math.max(0, secsLeft)) / WINDOW) * 100))
    : 0;

  return (
    <div style={{ background: C.card, borderRadius: 14, overflow: 'hidden', marginBottom: 12, border: `1px solid ${isFired ? color : C.border}`, boxShadow: isFired ? `0 0 16px ${color}44` : 'none' }}>
      {/* Progress bar */}
      <div style={{ height: 4, background: C.border }}>
        <div style={{ height: '100%', width: `${progress}%`, background: color, transition: 'width 250ms linear' }} />
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>{timer.name || timer.type}</div>
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>{timer.type}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onLeaderMode(timer)} style={{ height: 32, padding: '0 10px', borderRadius: 16, background: color + '22', border: `1px solid ${color}44`, color, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Full screen</button>
            <button onClick={() => onEdit(timer)} style={{ height: 32, padding: '0 10px', borderRadius: 16, background: C.section, border: `1px solid ${C.border}`, color: C.icy, fontSize: 12, cursor: 'pointer' }}>Edit</button>
            <button onClick={() => onDelete(timer.id)} style={{ height: 32, width: 32, borderRadius: 16, background: 'none', border: 'none', color: C.red + '88', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* Stage message */}
        {stage && (
          <div style={{ background: stage.color + '22', border: `1px solid ${stage.color}44`, borderRadius: 8, padding: '6px 12px', marginBottom: 10, textAlign: 'center' }}>
            <div style={{ fontSize: isFired ? 20 : 14, fontWeight: 800, color: stage.color, letterSpacing: isFired ? '0.1em' : 0 }}>
              {stage.label}
            </div>
          </div>
        )}

        {/* Countdown */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: isFired ? color : C.white, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em', lineHeight: 1 }}>
            {secsLeft != null ? secsToHHMMSS(secsLeft) : '--:--:--'}
          </div>
          {passed && secsLeft > 0 === false && secsLeft !== 0 && (
            <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>This UTC time has already passed today</div>
          )}
        </div>

        {/* Impact + Send times */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: C.section, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Impact</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.gold }}>{timer.impactTime || '--:--'} UTC</div>
          </div>
          <div style={{ background: C.section, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Your send time</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.icy }}>
              {timer.marchSecs ? fmtHHMM(calcSendTime(impactSecs, timer.marchSecs, 0)) + ' UTC' : 'Set march time'}
            </div>
          </div>
        </div>

        {timer.notes && <div style={{ fontSize: 12, color: C.icy, marginTop: 8, fontStyle: 'italic' }}>"{timer.notes}"</div>}
      </div>
    </div>
  );
}

// ── Timer Edit Sheet ───────────────────────────────────────────
function TimerSheet({ timer, open, onClose, onSave }) {
  const [t, setT] = useState(() => timer || newTimer());
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    if (open) setT(timer ? { ...timer } : newTimer());
  }, [open, timer?.id]);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  function upd(k, v) { setT(prev => ({ ...prev, [k]: v })); }

  function handleImpactChange(v) {
    upd('impactTime', v);
    const secs = parseHHMM(v);
    setPassed(secs != null && secs < utcNowSecs());
  }

  if (!open) return null;

  const impactSecs = parseHHMM(t.impactTime);
  const sendSecs   = t.marchSecs ? calcSendTime(impactSecs, t.marchSecs, 0) : null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000c', zIndex: 400, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '16px 20px 80px' }}>
        <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.white }}>{timer ? 'Edit timer' : 'New timer'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 28, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Name</label>
          <input value={t.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. Caroline counter" style={{ width: '100%', background: C.section, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 16, color: C.white, boxSizing: 'border-box', fontFamily: 'inherit' }} />
        </div>

        {/* Type */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Type</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {RALLY_TYPES.map(type => {
              const sel = t.type === type;
              const col = RALLY_COLORS[type];
              return (
                <button key={type} onClick={() => upd('type', type)} style={{ padding: '8px 14px', borderRadius: 20, minHeight: 38, border: `1px solid ${sel ? col : C.border}`, background: sel ? col + '22' : C.section, color: sel ? col : C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* Target impact time */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Target impact time (UTC)</label>
          <input
            value={t.impactTime}
            onChange={e => handleImpactChange(e.target.value)}
            placeholder="HH:mm  e.g. 19:00"
            style={{ width: '100%', background: C.section, border: `1px solid ${passed ? C.red : C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 18, color: C.white, boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.05em' }}
          />
          {passed && <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>⚠ This UTC time has already passed today. Timer will show negative countdown.</div>}
        </div>

        {/* March duration */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Your march duration (seconds)</label>
          <input
            type="number"
            inputMode="numeric"
            value={t.marchSecs || ''}
            onChange={e => upd('marchSecs', parseInt(e.target.value) || null)}
            placeholder="e.g. 78  (= 1m 18s)"
            style={{ width: '100%', background: C.section, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 16, color: C.white, boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          {t.marchSecs && <div style={{ fontSize: 12, color: C.icy, marginTop: 4 }}>= {fmtMarchSecs(t.marchSecs)}</div>}
        </div>

        {/* Calculated send time */}
        {sendSecs != null && (
          <div style={{ background: C.section, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Your send time</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.green, fontVariantNumeric: 'tabular-nums' }}>{fmtHHMM(sendSecs)} UTC</div>
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Notes</label>
          <textarea value={t.notes} onChange={e => upd('notes', e.target.value)} placeholder="Any instructions for the team…" style={{ width: '100%', minHeight: 72, background: C.section, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, color: C.white, resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, height: 52, borderRadius: 12, background: C.section, border: `1px solid ${C.border}`, color: C.icy, fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => { onSave(t); onClose(); vibe(8); }} style={{ flex: 2, height: 52, borderRadius: 12, background: C.gold, color: C.bg, fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer' }}>Save timer</button>
        </div>
      </div>
    </div>
  );
}

function newTimer() {
  return { id: uid(), name: '', type: 'Main Rally', impactTime: '', marchSecs: null, notes: '' };
}

// ── Leader Mode ────────────────────────────────────────────────
function LeaderMode({ timer, onClose }) {
  const [now, setNow] = useState(utcNowSecs());

  useEffect(() => {
    const id = setInterval(() => setNow(utcNowSecs()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const impactSecs = parseHHMM(timer.impactTime);
  const secsLeft   = impactSecs != null ? impactSecs - now : null;
  const isFired    = secsLeft != null && secsLeft <= 0;
  const stage      = secsLeft != null ? getStage(secsLeft) : null;
  const color      = RALLY_COLORS[timer.type] || C.gold;
  const sendSecs   = timer.marchSecs ? calcSendTime(impactSecs, timer.marchSecs, 0) : null;

  // Vibrate on stage transitions
  const lastStageRef = useRef(null);
  useEffect(() => {
    if (!stage) return;
    if (stage.label !== lastStageRef.current) {
      lastStageRef.current = stage.label;
      if (stage.label === 'SEND NOW') vibe([100, 50, 100, 50, 200]);
      else if (stage.label === 'Prepare To Send') vibe([50, 30, 50]);
      else vibe(30);
    }
  }, [stage?.label]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Close */}
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: C.muted, fontSize: 28, cursor: 'pointer' }}>✕</button>

      {/* Type + name */}
      <div style={{ fontSize: 14, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
        {timer.name || timer.type}
      </div>

      {/* Stage */}
      {stage && (
        <div style={{ fontSize: isFired ? 28 : 18, fontWeight: 800, color: stage.color, marginBottom: 20, textAlign: 'center', letterSpacing: isFired ? '0.1em' : 0 }}>
          {stage.label}
        </div>
      )}

      {/* Giant countdown */}
      <div style={{ fontSize: 80, fontWeight: 900, color: isFired ? color : C.white, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em', lineHeight: 1, marginBottom: 24, textAlign: 'center' }}>
        {secsLeft != null ? secsToHHMMSS(secsLeft) : '--:--:--'}
      </div>

      {/* Impact + Send */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Impact</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.gold }}>{timer.impactTime} UTC</div>
        </div>
        {sendSecs != null && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Send at</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>{fmtHHMM(sendSecs)} UTC</div>
          </div>
        )}
      </div>

      {timer.notes && (
        <div style={{ fontSize: 14, color: C.icy, fontStyle: 'italic', textAlign: 'center', maxWidth: 320 }}>
          "{timer.notes}"
        </div>
      )}

      <button onClick={onClose} style={{ position: 'absolute', bottom: 40, height: 48, padding: '0 32px', borderRadius: 24, background: C.section, border: `1px solid ${C.border}`, color: C.muted, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
        Exit full screen
      </button>
    </div>
  );
}

// ── Multi-Leader Calculator ────────────────────────────────────
function LeaderCalc({ calc, onChange }) {
  const [now, setNow] = useState(utcNowSecs());
  const [copied, setCopied]         = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(utcNowSecs()), 1000);
    return () => clearInterval(id);
  }, []);

  const impactSecs = parseHHMM(calc.impactTime);
  const passed     = hasPassed(impactSecs);

  function addLeader() {
    onChange({ ...calc, leaders: [...calc.leaders, { id: uid(), name: '', type: 'Main Rally', marchSecs: null, offset: 0, notes: '' }] });
  }

  function updLeader(id, patch) {
    onChange({ ...calc, leaders: calc.leaders.map(l => l.id === id ? { ...l, ...patch } : l) });
  }

  function removeLeader(id) {
    onChange({ ...calc, leaders: calc.leaders.filter(l => l.id !== id) });
  }

  function copyMessage(leader) {
    const sendSecs = calcSendTime(impactSecs, leader.marchSecs, leader.offset);
    const text = (calc.messageTemplate || DEFAULT_MESSAGE_TEMPLATE)
      .replace('{type}',   leader.type || 'Rally')
      .replace('{impact}', calc.impactTime || '--:--')
      .replace('{send}',   sendSecs != null ? fmtHHMM(sendSecs) : '--:--')
      .replace('{name}',   leader.name || '');
    navigator.clipboard.writeText(text).then(() => { setCopied(leader.id); setTimeout(() => setCopied(null), 2000); });
    vibe(8);
  }

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 4 }}>Send Calculator</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Set one impact time. Add each rally leader's march duration.</div>

      {/* Impact time input */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Target impact time (UTC)</label>
        <input
          value={calc.impactTime}
          onChange={e => onChange({ ...calc, impactTime: e.target.value })}
          placeholder="HH:mm  e.g. 19:00"
          style={{ width: '100%', background: C.section, border: `1px solid ${passed ? C.red : C.border}`, borderRadius: 10, padding: '14px', fontSize: 20, color: C.white, boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.05em' }}
        />
        {passed && <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>⚠ This UTC time has already passed today</div>}
      </div>

      {/* Leader rows */}
      {calc.leaders.map((leader, i) => {
        const sendSecs = impactSecs != null && leader.marchSecs
          ? calcSendTime(impactSecs, leader.marchSecs, leader.offset || 0)
          : null;

        return (
          <div key={leader.id} style={{ background: C.section, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                value={leader.name}
                onChange={e => updLeader(leader.id, { name: e.target.value })}
                placeholder="Leader name"
                style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 15, color: C.white, fontFamily: 'inherit' }}
              />
              <button onClick={() => removeLeader(leader.id)} style={{ width: 40, height: 40, borderRadius: 8, background: 'none', border: 'none', color: C.red + '88', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Type */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 10 }}>
              {RALLY_TYPES.slice(0, 4).map(type => {
                const sel = leader.type === type;
                const col = RALLY_COLORS[type];
                return (
                  <button key={type} onClick={() => updLeader(leader.id, { type })} style={{ padding: '6px 12px', borderRadius: 16, whiteSpace: 'nowrap', border: `1px solid ${sel ? col : C.border}`, background: sel ? col + '22' : C.card, color: sel ? col : C.muted, fontWeight: 600, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                    {type}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {/* March secs */}
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>March (seconds)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={leader.marchSecs || ''}
                  onChange={e => updLeader(leader.id, { marchSecs: parseInt(e.target.value) || null })}
                  placeholder="e.g. 78"
                  style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 15, color: C.white, boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                {leader.marchSecs && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{fmtMarchSecs(leader.marchSecs)}</div>}
              </div>

              {/* Landing offset */}
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Landing offset (s)</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {OFFSETS.map(o => (
                    <button key={o} onClick={() => updLeader(leader.id, { offset: o })} style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${leader.offset === o ? C.gold : C.border}`, background: leader.offset === o ? C.gold + '22' : C.card, color: leader.offset === o ? C.gold : C.muted, fontWeight: 600, fontSize: 11, cursor: 'pointer', minWidth: 32 }}>
                      {o > 0 ? `+${o}` : o}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Calculated send time */}
            {sendSecs != null ? (
              <div style={{ background: C.bg, borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Send at</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.green, fontVariantNumeric: 'tabular-nums' }}>{fmtHHMM(sendSecs)} UTC</div>
                  {leader.offset !== 0 && <div style={{ fontSize: 11, color: C.muted }}>Lands {leader.offset > 0 ? `+${leader.offset}s` : `${leader.offset}s`} from impact</div>}
                </div>
                <button onClick={() => copyMessage(leader)} style={{ height: 40, padding: '0 14px', borderRadius: 10, background: copied === leader.id ? C.green + '22' : C.section, border: `1px solid ${copied === leader.id ? C.green : C.border}`, color: copied === leader.id ? C.green : C.icy, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {copied === leader.id ? '✓ Copied' : '📋 Copy msg'}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '8px 0' }}>Enter march duration to see send time</div>
            )}

            <input
              value={leader.notes}
              onChange={e => updLeader(leader.id, { notes: e.target.value })}
              placeholder="Notes (optional)"
              style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.icy, boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 8 }}
            />
          </div>
        );
      })}

      <button onClick={addLeader} style={{ width: '100%', height: 44, borderRadius: 10, background: 'none', border: `1px dashed ${C.border}`, color: C.muted, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 16 }}>
        ＋ Add leader
      </button>

      {/* Message template */}
      <button onClick={() => setShowTemplate(!showTemplate)} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 13, cursor: 'pointer', padding: '4px 0', marginBottom: 8 }}>
        {showTemplate ? '▾' : '▸'} Edit message template
      </button>
      {showTemplate && (
        <div style={{ background: C.section, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
            Variables: {'{type}'} {'{impact}'} {'{send}'} {'{name}'}
          </div>
          <textarea
            value={calc.messageTemplate || DEFAULT_MESSAGE_TEMPLATE}
            onChange={e => onChange({ ...calc, messageTemplate: e.target.value })}
            style={{ width: '100%', minHeight: 140, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: C.white, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }}
          />
          <button onClick={() => onChange({ ...calc, messageTemplate: DEFAULT_MESSAGE_TEMPLATE })} style={{ fontSize: 12, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}

// ── LiveRallyRoom (main export) ────────────────────────────────
export function LiveRallyRoom({ onBack }) {
  const [state, setState] = useState(() => loadState() || DEFAULT_STATE);
  const [view, setView]   = useState('timers'); // 'timers' | 'calc'
  const [editingTimer, setEditingTimer] = useState(null);
  const [sheetOpen, setSheetOpen]       = useState(false);
  const [leaderTimer, setLeaderTimer]   = useState(null);

  // Persist on every state change
  useEffect(() => { saveState(state); }, [state]);

  function saveTimer(t) {
    setState(prev => ({
      ...prev,
      timers: prev.timers.some(x => x.id === t.id)
        ? prev.timers.map(x => x.id === t.id ? t : x)
        : [...prev.timers, t],
    }));
  }

  function deleteTimer(id) {
    setState(prev => ({ ...prev, timers: prev.timers.filter(t => t.id !== id) }));
  }

  function openNew() { setEditingTimer(null); setSheetOpen(true); }
  function openEdit(t) { setEditingTimer(t); setSheetOpen(true); }

  return (
    <>
      {/* Leader Mode overlay */}
      {leaderTimer && <LeaderMode timer={leaderTimer} onClose={() => setLeaderTimer(null)} />}

      <div style={{ padding: '16px 20px 0' }}>
        {/* Back */}
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: C.gold, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 16, padding: 0 }}>
          ← Back to Plans
        </button>

        {/* UTC Clock */}
        <UTCClock />

        {/* Sub-nav */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setView('timers')} style={{ flex: 1, height: 44, borderRadius: 20, background: view === 'timers' ? C.gold + '22' : C.section, border: `1px solid ${view === 'timers' ? C.gold : C.border}`, color: view === 'timers' ? C.gold : C.muted, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            ⏱ Live Timers
          </button>
          <button onClick={() => setView('calc')} style={{ flex: 1, height: 44, borderRadius: 20, background: view === 'calc' ? C.gold + '22' : C.section, border: `1px solid ${view === 'calc' ? C.gold : C.border}`, color: view === 'calc' ? C.gold : C.muted, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            🧮 Send Calculator
          </button>
        </div>

        {/* ── Timers view ── */}
        {view === 'timers' && (
          <div>
            {state.timers.length < 5 && (
              <button onClick={openNew} style={{ width: '100%', height: 52, borderRadius: 12, background: C.gold, color: C.bg, fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', marginBottom: 16 }}>
                ＋ New timer
              </button>
            )}
            {state.timers.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⏱</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 8 }}>No active timers</div>
                <div style={{ fontSize: 14, color: C.muted }}>Add a timer for each rally you're coordinating. Up to 5 at once.</div>
              </div>
            )}
            {state.timers.map(t => (
              <TimerCard key={t.id} timer={t} onEdit={openEdit} onDelete={deleteTimer} onLeaderMode={setLeaderTimer} />
            ))}
            {state.timers.length >= 5 && (
              <div style={{ textAlign: 'center', fontSize: 13, color: C.muted, padding: '8px 0' }}>Maximum 5 active timers. Delete one to add another.</div>
            )}
          </div>
        )}

        {/* ── Calculator view ── */}
        {view === 'calc' && (
          <LeaderCalc
            calc={state.calculator}
            onChange={calculator => setState(prev => ({ ...prev, calculator }))}
          />
        )}
      </div>

      {/* Timer sheet */}
      <TimerSheet
        timer={editingTimer}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={saveTimer}
      />
    </>
  );
}
