import { C, ALLIANCE_RANKS, LEGION_COLORS } from '../utils/constants.js';
import { fmtDateShort } from '../utils/dates.js';

export function initials(n) {
  return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
}

// Groups a player list by allianceRank, R5 first, unranked last —
// used both for the on-screen subheadings and the copy-as-text output,
// so the two never drift out of sync.
export function groupByRank(list) {
  const groups = {};
  ALLIANCE_RANKS.forEach(r => { groups[r] = []; });
  groups.Unranked = [];
  list.forEach(p => {
    const key = ALLIANCE_RANKS.includes(p.allianceRank) ? p.allianceRank : 'Unranked';
    groups[key].push(p);
  });
  return groups;
}

// An event archives itself the moment either is true — no need to
// remember to tap "Done" for it to stop cluttering the main list.
// Date strings are always 'YYYY-MM-DD' (see playerSchema.js), so a
// plain string comparison against today sorts correctly with no
// timezone math involved.
export function isArchived(ev, todayStr) {
  return ev.status === 'completed' || ev.date < todayStr;
}

// Legion 1 and Legion 2 events on the same date are the SAME real
// occasion split into two groups — a player can only physically be
// in one. "Sibling" = same date, same type, the opposite Legion.
export function findSiblingLegionEvent(ev, allEvents) {
  if (!ev?.legion) return null;
  const otherLegion = ev.legion === 1 ? 2 : 1;
  return allEvents.find(e => e.id !== ev.id && e.date === ev.date && e.type === ev.type && e.legion === otherLegion) || null;
}

// Persistent accent color for Legion-split events — only Foundry and
// Canyon Clash actually split into Legion 1/2 (see TROOP_POWER_EVENTS
// in constants.js), so this returns null for every other event type.
// Applied everywhere on an event page (header, participant borders,
// list card accents) so which Legion you're looking at is a color you
// register at a glance, not text you have to read. See LEGION_COLORS
// in constants.js for the actual dark/light pairs per event type.
export function legionColor(type, legion) {
  if (!legion) return null;
  return LEGION_COLORS[type]?.[legion] || null;
}

export function eventMs(ev) {
  return new Date(`${ev.date}T${ev.time || '00:00'}:00`).getTime();
}

// Filtered to CURRENT participantIds membership — removing someone via
// the ✕ button only strips them from participantIds, it doesn't delete
// their snapshot, so counting raw snapshots here would let a removed
// person's stale data keep inflating "participating"/"total" even
// though they no longer appear anywhere in the visible list.
export function evSum(ev) {
  const idSet = new Set(ev.participantIds || []);
  const sn = (ev.snapshots||[]).filter(s => idSet.has(s.playerId));
  if (ev.status === 'upcoming') {
    return { total:sn.length, participating:sn.filter(s=>s.rsvp?.participating).length };
  }
  return {
    total:sn.length,
    attended:sn.filter(s=>s.attendance?.attended===true).length,
    noShow:sn.filter(s=>s.attendance?.noShow).length,
    excused:sn.filter(s=>s.attendance?.noShow && s.attendance?.excused).length,
    voice:sn.filter(s=>s.voice?.joined===true).length,
  };
}

// Consecutive no-shows for one player, at one event TYPE only — a
// Foundry streak and an SvS streak are tracked independently, never
// mixed. Walks backward through past (non-upcoming) events of the
// same type, most recent first, counting while they were marked
// no-show; stops at the first event they weren't. An event where the
// player has no snapshot at all (wasn't part of that event) is
// skipped rather than breaking the streak — we simply don't know
// anything about their attendance there.
export function noShowStreak(playerId, eventType, excludeEventId, events) {
  const sameType = events
    .filter(e => e.type === eventType && e.id !== excludeEventId && e.status !== 'upcoming')
    .sort((a,b) => `${b.date}T${b.time||'00:00'}`.localeCompare(`${a.date}T${a.time||'00:00'}`));
  let streak = 0;
  for (const ev of sameType) {
    const snap = (ev.snapshots||[]).find(s => s.playerId === playerId);
    if (!snap) continue;
    // An excused absence is a sanctioned no-show — it neither extends
    // nor breaks the streak, it's simply set aside, same as an event
    // the player wasn't part of at all.
    if (snap.attendance?.noShow && snap.attendance?.excused) continue;
    if (snap.attendance?.noShow) streak++;
    else break;
  }
  return streak;
}

// Capped display — a wall of hearts past 3 stops being informative
// and starts breaking the row layout. This cap wasn't specified;
// easy to change.
export function noShowBadge(streak) {
  if (streak <= 0) return null;
  return streak <= 3 ? '💔'.repeat(streak) : `💔×${streak}`;
}

// Copyable, Discord-ready roster text — grouped by rank the same way
// the on-screen list is, so what you copy always matches what you
// see. Plain text, no code-fence wrapping — this gets pasted straight
// into Discord as a normal message. Header includes time and Legion
// (when set) so the text is self-identifying once posted — otherwise
// a Legion 1 and Legion 2 roster posted the same day are
// indistinguishable once separated from the app. Rally Leads get the
// same 👑 marker the on-screen row uses.
export function generateParticipantsText(activeEvent, participantsList, substitutesList) {
  if (!activeEvent) return '';
  const headerParts = [activeEvent.name || activeEvent.type, fmtDateShort(activeEvent.date)];
  if (activeEvent.time)   headerParts.push(`🕐 ${activeEvent.time}`);
  if (activeEvent.legion) headerParts.push(`Legion ${activeEvent.legion}`);
  const lines = [`📋 ${headerParts.join(' — ')}`, ''];
  const nameLine = p => `  ${p.roles?.includes('Rally Lead') ? '👑 ' : ''}${p.username || p.alias || '?'}`;
  const groups = groupByRank(participantsList);
  lines.push(`PARTICIPANTS (${participantsList.length})`);
  [...ALLIANCE_RANKS, 'Unranked'].forEach(rank => {
    const group = groups[rank];
    if (!group.length) return;
    lines.push(`${rank} (${group.length})`);
    group.forEach(p => lines.push(nameLine(p)));
  });
  if (substitutesList.length > 0) {
    lines.push('', `SUBSTITUTES (${substitutesList.length})`);
    substitutesList.forEach(p => lines.push(nameLine(p)));
  }
  return lines.join('\n').trim();
}

// "Fully upgraded" — all three troops match each other (same
// definition used for the mismatch flag on the member card and in the
// event export's Rally Leader Heroes work). With fewer than 2 troops
// set there's nothing to compare, so it's treated as not-partial by
// default rather than flagging a gap that can't actually be confirmed.
function isFullyUpgraded(p) {
  const set = [p.troops?.infantry, p.troops?.lancer, p.troops?.marksman].filter(Boolean);
  if (set.length < 2) return true;
  return set.every(t => t === set[0]);
}

// Which troop types are at a Helios stage — a player can have more
// than one, e.g. Helios on both Infantry and Lancer.
function heliosTypesFor(p) {
  const types = [];
  if (p.troops?.infantry?.startsWith('Helios')) types.push('Inf');
  if (p.troops?.lancer?.startsWith('Helios'))   types.push('Lan');
  if (p.troops?.marksman?.startsWith('Helios')) types.push('Mar');
  return types;
}

function rsvpStatusText(snap) {
  const r = snap?.rsvp || {};
  if (r.unsure) return 'Unsure';
  if (r.participating === false) return 'Not confirmed';
  if (r.intermittent) return 'Pops in randomly';
  if (r.willBeLate) return 'Coming late';
  if (r.willLeaveEarly) return 'Leaving early';
  if (r.presentWholeTime && r.willJoinDiscord) return 'Present whole time + voice';
  if (r.presentWholeTime) return 'Present whole time';
  if (r.willJoinDiscord) return 'Joining voice chat';
  return 'Confirmed';
}

function attendanceStatusText(snap) {
  const a = snap?.attendance || {};
  if (a.noShow && a.excused) return 'Excused absence';
  if (a.noShow) return 'No-show';
  if (a.joinedLateNoNotice) return 'Late (no notice)';
  if (a.attended === true) return snap?.voice?.joined ? 'Attended + voice' : 'Attended';
  return 'Not recorded';
}

// One line per player: flag emoji (👑 Rally Lead, ☀️ any Helios troop,
// 🎖️ R4 or R5), furnace level, whether all three troops match each
// other (Full/Partial), which troop type(s) are Helios if any, and
// their current RSVP/attendance status.
function attendanceLine(p, snap, isUpcoming) {
  const flags = [];
  if (p.roles?.includes('Rally Lead')) flags.push('👑');
  const heliosTypes = heliosTypesFor(p);
  if (heliosTypes.length > 0) flags.push('☀️');
  if (p.allianceRank === 'R4' || p.allianceRank === 'R5') flags.push('🎖️');
  const flagStr = flags.length ? flags.join('') + ' ' : '';

  const fc = p.furnaceLevel || '?';
  const fullness = isFullyUpgraded(p) ? 'Full' : 'Partial';
  const heliosDetail = heliosTypes.length > 0 ? ` · Helios: ${heliosTypes.join('/')}` : '';
  const status = isUpcoming ? rsvpStatusText(snap) : attendanceStatusText(snap);

  return `  ${flagStr}${p.username || p.alias || '?'} — ${fc} (${fullness})${heliosDetail} · ${status}`;
}

// Copyable, Discord-ready ATTENDANCE text — richer than
// generateParticipantsText above (which is just names grouped by
// rank): shows furnace level, whether the player's troops are fully
// or only partially upgraded to match each other, which troop type(s)
// are Helios-tier, and current RSVP/attendance status, with 👑/☀️/🎖️
// flags for Rally Lead, any Helios troop, and R4+ respectively. Plain
// text, no code-fence — same "pastes straight into Discord" rule as
// every other copy feature in this app.
export function generateAttendanceText(activeEvent, participantsList, substitutesList) {
  if (!activeEvent) return '';
  const isUpcoming = activeEvent.status === 'upcoming';
  const snapFor = pid => (activeEvent.snapshots || []).find(s => s.playerId === pid);

  const headerParts = [activeEvent.name || activeEvent.type, fmtDateShort(activeEvent.date)];
  if (activeEvent.time)   headerParts.push(`🕐 ${activeEvent.time}`);
  if (activeEvent.legion) headerParts.push(`Legion ${activeEvent.legion}`);
  const lines = [`📋 ${headerParts.join(' — ')} — Attendance`, ''];

  const groups = groupByRank(participantsList);
  lines.push(`PARTICIPANTS (${participantsList.length})`);
  [...ALLIANCE_RANKS, 'Unranked'].forEach(rank => {
    const group = groups[rank];
    if (!group.length) return;
    lines.push(`${rank} (${group.length})`);
    group.forEach(p => lines.push(attendanceLine(p, snapFor(p.id), isUpcoming)));
  });

  if (substitutesList.length > 0) {
    lines.push('', `SUBSTITUTES (${substitutesList.length})`);
    substitutesList.forEach(p => lines.push(attendanceLine(p, snapFor(p.id), isUpcoming)));
  }

  return lines.join('\n').trim();
}
