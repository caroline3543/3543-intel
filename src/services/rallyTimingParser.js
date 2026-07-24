/**
 * rallyTimingParser.js
 *
 * Fast input parsing for rally timing in Live Rally Room.
 * All functions return null on invalid input.
 */

// ── March time parser ──────────────────────────────────────────
// Last 2 digits = seconds, everything before = minutes.
// 412 → 4m 12s, 45 → 0m 45s, 105 → 1m 05s
// Returns total seconds (a DURATION, not a point in time), or null if invalid.

export function parseMarchInput(raw) {
  if (!raw && raw !== 0) return null;
  const str = String(raw).replace(/[^0-9]/g, '');
  if (!str) return null;

  let mins, secs;

  if (str.includes(':')) {
    // Colon format: 4:12
    const parts = str.split(':').map(Number);
    if (parts.length !== 2) return null;
    [mins, secs] = parts;
  } else if (str.length === 1) {
    // e.g. 9 → 0m 9s
    mins = 0;
    secs = parseInt(str);
  } else {
    // Last 2 digits = seconds, rest = minutes
    secs = parseInt(str.slice(-2));
    mins = parseInt(str.slice(0, -2) || '0');
  }

  if (isNaN(mins) || isNaN(secs)) return null;
  if (secs >= 60) return null; // invalid
  if (mins < 0 || secs < 0)   return null;

  return mins * 60 + secs;
}

export function validateMarchInput(raw) {
  if (!raw) return { valid: false, error: null }; // empty is fine
  const str = String(raw).replace(/\s/g, '');
  if (!str) return { valid: false, error: null };

  // Check for invalid seconds
  let secs;
  if (str.includes(':')) {
    const parts = str.split(':').map(Number);
    secs = parts[1];
  } else if (str.length <= 1) {
    secs = parseInt(str);
  } else {
    secs = parseInt(str.slice(-2));
  }

  if (!isNaN(secs) && secs >= 60) {
    return { valid: false, error: `${secs}s is not valid — seconds must be 00–59` };
  }

  const result = parseMarchInput(str);
  if (result === null) return { valid: false, error: 'Invalid format' };
  return { valid: true, error: null, totalSecs: result };
}

export function fmtMarch(totalSecs) {
  if (totalSecs == null || isNaN(totalSecs)) return '';
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function fmtMarchCompact(totalSecs) {
  return fmtMarch(totalSecs);
}

// ── Impact time parser ─────────────────────────────────────────
// Accepts: 2200, 22:00, 220030, 22:00:30
//
// Returns a REAL EPOCH TIMESTAMP (epochSecs), not seconds-since-midnight.
// The parsed h:m:s is anchored to the UTC calendar date of `refEpochSecs`
// (defaults to "now"). This is the same date the app already implicitly
// assumed — we're just making the assumption explicit and giving callers
// a timestamp that survives being compared against "now" correctly,
// instead of a bare 0–86399 value that silently breaks at UTC midnight.
//
// NOTE: this does NOT auto-roll a "already passed today" time to
// tomorrow — same behavior as before, just now expressed as a real
// timestamp so the "already passed" comparison itself is more robust.
// Auto-rollover would be a UX change beyond this pass's scope; flagged
// as a possible follow-up, not implemented here.
//
// Returns: { h, m, s, epochSecs, display } or null
export function parseImpactInput(raw, refEpochSecs) {
  if (!raw) return null;
  const str = String(raw).trim();

  let h, m, s = 0;

  if (str.includes(':')) {
    // Colon format
    const parts = str.split(':').map(Number);
    if (parts.length === 2) [h, m] = parts;
    else if (parts.length === 3) [h, m, s] = parts;
    else return null;
  } else {
    // No-colon format
    const digits = str.replace(/[^0-9]/g, '');
    if (digits.length === 3) {
      // e.g. 900 → ambiguous, treat as HMM
      h = parseInt(digits[0]);
      m = parseInt(digits.slice(1));
      s = 0;
    } else if (digits.length === 4) {
      // e.g. 2200 → 22:00
      h = parseInt(digits.slice(0, 2));
      m = parseInt(digits.slice(2, 4));
      s = 0;
    } else if (digits.length === 6) {
      // e.g. 220030 → 22:00:30
      h = parseInt(digits.slice(0, 2));
      m = parseInt(digits.slice(2, 4));
      s = parseInt(digits.slice(4, 6));
    } else if (digits.length === 1 || digits.length === 2) {
      // treat as HH:00
      h = parseInt(digits);
      m = 0;
      s = 0;
    } else {
      return null;
    }
  }

  if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
  if (h < 0 || h > 23) return null;
  if (m < 0 || m > 59) return null;
  if (s < 0 || s > 59) return null;

  const ref     = refEpochSecs != null ? refEpochSecs : Math.floor(Date.now() / 1000);
  const refDate = new Date(ref * 1000);
  const epochSecs = Math.floor(
    Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate(), h, m, s) / 1000
  );

  const display = s > 0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

  return { h, m, s, epochSecs, display };
}

export function validateImpactInput(raw, refEpochSecs) {
  if (!raw) return { valid: false, error: null };
  const result = parseImpactInput(raw, refEpochSecs);
  if (!result) return { valid: false, error: 'Enter a valid UTC time — e.g. 2200 or 22:00' };
  return { valid: true, error: null, ...result };
}
