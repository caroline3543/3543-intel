// ── rallyRoomHelpers.js ────────────────────────────────────────
// Pure helpers shared across all LiveRallyRoom sub-components.
// No React. No side-effects.

import {
  parseMarchInput, validateMarchInput, fmtMarch,
  parseImpactInput, validateImpactInput,
} from '../../../services/rallyTimingParser.js';

export { parseMarchInput, validateMarchInput, fmtMarch, parseImpactInput, validateImpactInput };

export const RALLY_TYPES = [
  'Main Rally','Counter Rally','Counter-Counter',
  'Switch Fight','Garrison Entry','Reinforcement','Custom',
];

export const RALLY_COLORS = {
  'Main Rally':'#F5A623','Counter Rally':'#FF453A','Counter-Counter':'#FF8C00',
  'Switch Fight':'#30D158','Garrison Entry':'#6B8CAE','Reinforcement':'#7BAE8C','Custom':'#A8C4D8',
};

export const OFFSETS       = [-5,-2,-1,0,1,2,5];
export const RALLY_DURATIONS = [1,3,5];

export const STORAGE_KEY = 'svs_live_rally_room_v2';

export const DEFAULT_MSG =
`{type} — {name}
Impact: {impact} UTC
Open rally at: {open} UTC

Priority joiners:
{joiners}

Ratio: {ratio}
Join now. Do not solo.`;

// ── Utility functions ──────────────────────────────────────────
export function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
export function utcNowSecs() { const n = new Date(); return n.getUTCHours()*3600 + n.getUTCMinutes()*60 + n.getUTCSeconds(); }
export function utcNowStr()  { const n = new Date(); return [n.getUTCHours(), n.getUTCMinutes(), n.getUTCSeconds()].map(x => String(x).padStart(2,'0')).join(':'); }

export function secsToHHMMSS(s) {
  if (s == null || isNaN(s)) return '--:--:--';
  const abs = Math.abs(Math.round(s));
  const str = [Math.floor(abs/3600), Math.floor((abs%3600)/60), abs%60].map(x => String(x).padStart(2,'0')).join(':');
  return s < 0 ? `-${str}` : str;
}

export function calcSendSecs(impactSecs, marchSecs, offset = 0) {
  if (impactSecs == null || marchSecs == null) return null;
  return impactSecs - marchSecs + offset;
}

export function calcRallyOpenSecs(impactSecs, marchSecs, rallyDurationMins) {
  if (impactSecs == null || marchSecs == null || rallyDurationMins == null) return null;
  return impactSecs - marchSecs - (rallyDurationMins * 60);
}

export function fmtSend(secs) {
  if (secs == null) return '--:--';
  const norm = ((secs % 86400) + 86400) % 86400;
  const h = Math.floor(norm / 3600), m = Math.floor((norm % 3600) / 60), s = norm % 60;
  return s === 0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── 6-phase stage system ───────────────────────────────────────
export function getTimerStage(secsToOpen, secsToImpact) {
  if (secsToImpact == null) return null;
  if (secsToImpact <= 0)                     return { stage:'impact',    label:'✓ Impact',                      color:'#30D158', bg:'#0A2A14' };
  if (secsToOpen != null && secsToOpen <= 0) return { stage:'filling',   label:'✓ Rally Open — Joiners Joining', color:'#30D158', bg:'#0A2A14' };
  if (secsToOpen == null) {
    if (secsToImpact <= 10) return { stage:'open_now',  label:'⚠ OPEN RALLY NOW',      color:'#FF453A', bg:'#3A0A0A' };
    if (secsToImpact <= 30) return { stage:'prepare',   label:'Prepare To Open Rally', color:'#FF8C00', bg:'#2A1500' };
    if (secsToImpact <= 90) return { stage:'get_ready', label:'Get Ready',             color:'#A8C4D8', bg:'#0A1A2A' };
    return null;
  }
  if (secsToOpen <= 0)   return { stage:'open_now',  label:'⚠ OPEN RALLY NOW',      color:'#FF453A', bg:'#3A0A0A' };
  if (secsToOpen <= 5)   return { stage:'prepare',   label:'Prepare To Open Rally', color:'#FF8C00', bg:'#2A1500' };
  if (secsToOpen <= 30)  return { stage:'get_ready', label:'Get Ready',             color:'#A8C4D8', bg:'#0A1A2A' };
  if (secsToOpen <= 120) return { stage:'standby',   label:'Stand By',              color:'#5A7A94', bg:'#1E3A52'  };
  return null;
}

// ── Persistence ────────────────────────────────────────────────
export function loadState(DEFAULT_STATE, defaultMsg) {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) {
      const p = JSON.parse(r);
      return {
        timers:        Array.isArray(p.timers)        ? p.timers        : [],
        archived:      Array.isArray(p.archived)      ? p.archived      : [],
        marchRegistry: Array.isArray(p.marchRegistry) ? p.marchRegistry : [],
        calculator: {
          impactTimeRaw:   p.calculator?.impactTimeRaw   || '',
          impactSecs:      p.calculator?.impactSecs      || null,
          rallyDuration:   p.calculator?.rallyDuration   || 3,
          leaders:         Array.isArray(p.calculator?.leaders) ? p.calculator.leaders : [],
          messageTemplate: p.calculator?.messageTemplate || defaultMsg,
        },
      };
    }
  } catch {}
  return null;
}

export function saveState(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }

// SmartInputs (MarchInput, ImpactInput) live in ./SmartInputs.jsx
// Import them directly from there — not from this file.
