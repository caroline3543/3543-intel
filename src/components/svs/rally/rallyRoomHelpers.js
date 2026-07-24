// ── rallyRoomHelpers.js ────────────────────────────────────────
// Pure helpers shared across all LiveRallyRoom sub-components.
// No React. No side-effects (except localStorage read/write in the
// persistence functions at the bottom).

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

// "Open offset" — same field, used consistently in both timing modes.
// See Calculator.jsx for the mode-specific sign behavior (flagged as a
// found ambiguity — see commit notes).
export const OFFSETS       = [-5,-2,-1,0,1,2,5];
export const RALLY_DURATIONS = [1,3,5];

// Presets for "Start first rally in" (countdown mode), in seconds.
export const COUNTDOWN_PRESETS = [10, 30, 60, 120, 300];
export const COUNTDOWN_MIN     = 5;      // clamp floor
export const COUNTDOWN_MAX     = 1800;   // clamp ceiling (30 min)
export const COUNTDOWN_STEP    = 15;     // custom stepper increment
export const COUNTDOWN_DEFAULT = 60;

export const STORAGE_KEY = 'svs_live_rally_room_v2';

export const DEFAULT_MSG =
`{type} — {name}
Impact: {impact} UTC
Open rally at: {open} UTC

Priority joiners:
{joiners}

Ratio: {ratio}
Join now. Do not solo.`;

// ── Time ─────────────────────────────────────────────────────
// Real epoch seconds — replaces the old utcNowSecs() (which returned
// seconds-since-midnight and silently broke at UTC day boundaries).
export function nowEpochSecs() { return Math.floor(Date.now() / 1000); }

export function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// Display-only "clock face" string — unaffected by the epoch migration,
// this never fed into scheduling math.
export function utcNowStr()  { const n = new Date(); return [n.getUTCHours(), n.getUTCMinutes(), n.getUTCSeconds()].map(x => String(x).padStart(2,'0')).join(':'); }

export function secsToHHMMSS(s) {
  if (s == null || isNaN(s)) return '--:--:--';
  const abs = Math.abs(Math.round(s));
  const str = [Math.floor(abs/3600), Math.floor((abs%3600)/60), abs%60].map(x => String(x).padStart(2,'0')).join(':');
  return s < 0 ? `-${str}` : str;
}

// ── Scheduling math ────────────────────────────────────────────
// Unchanged formulas — pure duration arithmetic on a timestamp. Works
// identically whether the timestamp domain is "seconds since midnight"
// (old) or real epoch seconds (new) — only the *meaning* of the inputs
// changed, not this math.
export function calcSendSecs(impactSecs, marchSecs, offset = 0) {
  if (impactSecs == null || marchSecs == null) return null;
  return impactSecs - marchSecs + offset;
}

export function calcRallyOpenSecs(impactSecs, marchSecs, rallyDurationMins, offset = 0) {
  if (impactSecs == null || marchSecs == null || rallyDurationMins == null) return null;
  return impactSecs - marchSecs - (rallyDurationMins * 60) - offset;
}

// firstOpenRallyAt + leaderOffsetSecs — countdown-mode open time for a
// given leader relative to the first rally's reference open time.
export function calcOpenFromReference(referenceOpenSecs, offset = 0) {
  if (referenceOpenSecs == null) return null;
  return referenceOpenSecs + offset;
}

// ── Unified per-leader schedule calculation ────────────────────
// Single source of truth for both timing modes — used by the Calculator's
// live table preview AND by Start Timers, so the formula only lives here.
//
//   Mode 'impact':    openRallyAt = impactEpochSecs − marchSecs − rallyDurationSecs − offsetSecs
//   Mode 'countdown': openRallyAt = referenceTimeUtc + offsetSecs
//                      (referenceTimeUtc = firstOpenRallyAt, computed ONCE per
//                      Start-tap and shared across all leaders in that batch —
//                      pass it in via `referenceOverride` so every leader in
//                      the same action is scheduled off the same instant)
//
// NOTE (flagged ambiguity): in 'impact' mode, +offsetSecs shifts this
// leader's open (and final impact) EARLIER, per the literal formula
// given in the task spec. In 'countdown' mode, +offsetSecs shifts it
// LATER. This asymmetry is intentional per spec, not a bug — but worth
// confirming against real usage (see validation scenarios 4 vs 9).
export function computeLeaderTimes(leader, calc, referenceOverride) {
  const empty = { openRallyAtUtc: null, marchesAtUtc: null, impactAtUtc: null, referenceTimeUtc: null };
  if (!leader.marchSecs) return empty;
  const rallyDurMins = leader.rallyDuration || calc.rallyDuration || 3;
  const offset = leader.offset || 0;

  if (calc.timingMode === 'countdown') {
    if (!calc.countdownSecs) return empty;
    const referenceTimeUtc = referenceOverride ?? (nowEpochSecs() + calc.countdownSecs);
    const openRallyAtUtc = calcOpenFromReference(referenceTimeUtc, offset);
    const marchesAtUtc   = openRallyAtUtc + rallyDurMins * 60;
    const impactAtUtc    = marchesAtUtc + leader.marchSecs;
    return { openRallyAtUtc, marchesAtUtc, impactAtUtc, referenceTimeUtc };
  }

  // 'impact' mode
  if (calc.impactEpochSecs == null) return empty;
  const openRallyAtUtc = calcRallyOpenSecs(calc.impactEpochSecs, leader.marchSecs, rallyDurMins, offset);
  const marchesAtUtc   = openRallyAtUtc + rallyDurMins * 60;
  const impactAtUtc    = marchesAtUtc + leader.marchSecs;
  return { openRallyAtUtc, marchesAtUtc, impactAtUtc, referenceTimeUtc: calc.impactEpochSecs };
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

// ── Timer normalization / migration ────────────────────────────
// Every timer, regardless of which mode created it, ends up in this one
// shape. Old-shape timers (pre-unification: separate `asap`/`impactTime`
// fields, no stored epoch fields) are mapped onto it on load.
//
// Old ASAP timers stored `asapLaunchAt` as an intraday value
// (utcNowSecs() + 5, i.e. 0–86399-ish). That is NOT a valid epoch
// timestamp (a real epoch value is ~1.7 billion+), so we can detect and
// safely discard those rather than guess — misinterpreting a small
// leftover number as a real timestamp could show a wildly wrong
// countdown mid-battle. Old scheduled (impact-mode) timers ARE safely
// recoverable, since they stored the human-readable `impactTime` string,
// which we can just re-parse fresh.
const EPOCH_SANITY_FLOOR = 1_600_000_000; // ~Sept 2020 — anything below this is not a real epoch value

export function normalizeTimer(t) {
  // Already unified shape — pass through untouched.
  if (t.openRallyAtUtc != null || t.impactAtUtc != null) return t;

  // Old ASAP shape — cannot be safely recovered, drop it.
  if (t.asap && t.asapLaunchAt != null) {
    if (t.asapLaunchAt < EPOCH_SANITY_FLOOR) {
      console.warn(`[LiveRallyRoom] Discarding legacy ASAP timer "${t.name || t.id}" — pre-migration shape can't be safely recovered.`);
      return null;
    }
    // Already a real epoch value somehow — treat it as the open time.
    return {
      ...t,
      timingMode: 'countdown',
      leaderName: t.name, rallyType: t.type,
      openRallyAtUtc: t.asapLaunchAt,
      marchesAtUtc: null, impactAtUtc: null,
      createdAtUtc: t.createdAtUtc ?? nowEpochSecs(),
    };
  }

  // Old scheduled shape — re-derive from the still-readable impactTime string.
  if (t.impactTime) {
    const parsed = parseImpactInput(t.impactTime);
    if (!parsed) return t; // can't parse — leave as-is, TimerCard will show blanks
    const impactAtUtc = parsed.epochSecs;
    const openRallyAtUtc = t.rallyDuration != null
      ? calcRallyOpenSecs(impactAtUtc, t.marchSecs, t.rallyDuration, t.offset || 0)
      : null;
    const marchesAtUtc = openRallyAtUtc != null ? openRallyAtUtc + (t.rallyDuration * 60) : null;
    return {
      ...t,
      timingMode: 'impact',
      leaderName: t.name, rallyType: t.type,
      rallyDurationSecs: t.rallyDuration != null ? t.rallyDuration * 60 : null,
      offsetSecs: t.offset || 0,
      referenceTimeUtc: impactAtUtc,
      impactAtUtc, openRallyAtUtc, marchesAtUtc,
      createdAtUtc: t.createdAtUtc ?? nowEpochSecs(),
    };
  }

  return t;
}

// ── Persistence ────────────────────────────────────────────────
export function loadState(DEFAULT_STATE, defaultMsg) {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) {
      const p = JSON.parse(r);
      const rawTimers   = Array.isArray(p.timers)   ? p.timers   : [];
      const rawArchived = Array.isArray(p.archived) ? p.archived : [];
      return {
        timers:        rawTimers.map(normalizeTimer).filter(Boolean),
        archived:      rawArchived.map(normalizeTimer).filter(Boolean),
        marchRegistry: Array.isArray(p.marchRegistry) ? p.marchRegistry : [],
        calculator: {
          timingMode:      p.calculator?.timingMode      || 'impact',
          impactTimeRaw:   p.calculator?.impactTimeRaw    || '',
          // Never trust a persisted numeric impact value across a reload —
          // re-derive it fresh from the human-readable string, since the
          // old field may be an intraday value, not epoch.
          impactEpochSecs: p.calculator?.impactTimeRaw
            ? (parseImpactInput(p.calculator.impactTimeRaw)?.epochSecs ?? null)
            : null,
          countdownSecs:   p.calculator?.countdownSecs    || COUNTDOWN_DEFAULT,
          rallyDuration:   p.calculator?.rallyDuration    || 3,
          leaders:         Array.isArray(p.calculator?.leaders) ? p.calculator.leaders : [],
          messageTemplate: p.calculator?.messageTemplate  || defaultMsg,
        },
      };
    }
  } catch {}
  return null;
}

export function saveState(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }

// SmartInputs (MarchInput, ImpactInput) live in ./SmartInputs.jsx
// Import them directly from there — not from this file.
