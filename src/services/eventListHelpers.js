import { C, ALLIANCE_RANKS } from '../utils/constants.js';
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

// Persistent per-Legion color — applied everywhere on an event page
// (header, participant borders, list card accents) so which Legion
// you're looking at is a color you register at a glance, not text
// you have to read.
export function legionColor(legion) {
  if (legion === 1) return C.icy;
  if (legion === 2) return C.lan;
  return null;
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
  return { total:sn.length, attended:sn.filter(s=>s.attendance?.attended===true).length, noShow:sn.filter(s=>s.attendance?.noShow).length, voice:sn.filter(s=>s.voice?.joined===true).length };
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

// Copyable, Discord-ready code block of the full roster — grouped by
// rank the same way the on-screen list is, so what you copy always
// matches what you see. Header includes time and Legion (when set) so
// the code block is self-identifying once posted in Discord —
// otherwise a Legion 1 and Legion 2 roster posted the same day are
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
  return '```\n' + lines.join('\n').trim() + '\n```';
}
