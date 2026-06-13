import { useEffect, useRef, useCallback } from 'react';
import { parseImpactInput, calcRallyOpenSecs, utcNowSecs } from './rallyRoomHelpers.js';

// ── useVoiceCountdown ──────────────────────────────────────────
// Drives all SpeechSynthesis announcements for active rally timers.
//
// Design decisions:
//   - One setInterval at 1 s — no per-timer intervals, no re-renders.
//   - Announced cues tracked in a ref (Set) keyed by "{timerId}:{cueKey}".
//     The set is cleared when a timer is deleted or impact passes.
//   - speechSynthesis.cancel() before each new utterance so cues don't queue.
//   - iOS/Android: speech works in background provided the *first* call
//     happened during a user gesture. Start Timers button satisfies this.
//
// Args:
//   timers   – active timer objects array (from LiveRallyRoom state)
//   voiceOn  – boolean
//   cues     – VoiceCues object (see DEFAULT_CUES below)
//
// Returns: nothing (side-effects only)

export const DEFAULT_CUES = {
  s30:    '30 seconds',
  s20:    '20 seconds',
  s10:    '10 seconds',
  c5:     '5',
  c4:     '4',
  c3:     '3',
  c2:     '2',
  c1:     '1',
  launch: 'Open rally now',
};

// Keys and the secsToOpen value at which each fires (inclusive window ±0.9 s)
const CUE_SCHEDULE = [
  { key:'s30',    secs:30 },
  { key:'s20',    secs:20 },
  { key:'s10',    secs:10 },
  { key:'c5',     secs:5  },
  { key:'c4',     secs:4  },
  { key:'c3',     secs:3  },
  { key:'c2',     secs:2  },
  { key:'c1',     secs:1  },
  { key:'launch', secs:0  },
];

export function useVoiceCountdown(timers, voiceOn, cues) {
  // Tracks which "{timerId}:{cueKey}" have already been spoken this session.
  const spokenRef = useRef(new Set());
  // Keep latest args accessible inside the interval without re-creating it.
  const argsRef   = useRef({ timers, voiceOn, cues });
  useEffect(() => { argsRef.current = { timers, voiceOn, cues }; }, [timers, voiceOn, cues]);

  // Prune stale keys when timers are removed
  useEffect(() => {
    const activeIds = new Set(timers.map(t => t.id));
    for (const key of spokenRef.current) {
      const timerId = key.split(':')[0];
      if (!activeIds.has(timerId)) spokenRef.current.delete(key);
    }
  }, [timers]);

  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utt       = new SpeechSynthesisUtterance(text);
      utt.rate        = 1.1;
      utt.pitch       = 1;
      utt.volume      = 1;
      utt.lang        = 'en-US';
      window.speechSynthesis.speak(utt);
    } catch {}
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const { timers: ts, voiceOn: on, cues: c } = argsRef.current;
      if (!on || !ts.length) return;

      const now = utcNowSecs();

      for (const timer of ts) {
        // ASAP timers use asapLaunchAt directly
        let targetSecs;
        if (timer.asap && timer.asapLaunchAt != null) {
          targetSecs = timer.asapLaunchAt;
        } else {
          if (!timer.impactTime || timer.marchSecs == null) continue;
          const parsed = parseImpactInput(timer.impactTime);
          if (!parsed) continue;
          const impactSecs = parsed.totalSecs;
          const openSecs   = timer.rallyDuration
            ? calcRallyOpenSecs(impactSecs, timer.marchSecs, timer.rallyDuration)
            : null;
          targetSecs = openSecs ?? impactSecs;
        }

        const secsLeft = Math.round(targetSecs - now);

        for (const { key, secs } of CUE_SCHEDULE) {
          const spokenKey = `${timer.id}:${key}`;
          if (spokenRef.current.has(spokenKey)) continue;
          // Fire within a 1-second window around the cue point
          if (secsLeft <= secs && secsLeft > secs - 1) {
            spokenRef.current.add(spokenKey);
            const text = (c?.[key] || DEFAULT_CUES[key] || '').trim();
            if (text) speak(text);
            break; // one cue per timer per tick
          }
        }

        // Clear spoken keys for this timer once it's past impact so it
        // would re-announce if somehow reused with the same id
        if (secsLeft < -5) {
          for (const { key } of CUE_SCHEDULE) {
            spokenRef.current.delete(`${timer.id}:${key}`);
          }
        }
      }
    }, 1000);

    return () => clearInterval(id);
  }, [speak]); // stable — argsRef handles the rest
}

// ── Voice settings persistence ─────────────────────────────────
const VOICE_KEY = 'svs_voice_settings';

export function loadVoiceSettings() {
  try {
    const raw = localStorage.getItem(VOICE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        voiceOn: p.voiceOn !== false,
        cues:    { ...DEFAULT_CUES, ...(p.cues || {}) },
      };
    }
  } catch {}
  return { voiceOn: true, cues: { ...DEFAULT_CUES } };
}

export function saveVoiceSettings(settings) {
  try { localStorage.setItem(VOICE_KEY, JSON.stringify(settings)); } catch {}
}
