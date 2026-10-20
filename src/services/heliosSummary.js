// Local copy of FC_ORDER (battleConstants.js) so this service file has no
// dependency on the battle components folder — keep the two in sync.
const FC_ORDER = ['FC1','FC2','FC3','FC4','FC5','FC6','FC7','FC8','Helios FC5','Helios FC6','Helios FC7','Helios FC8'];

// ── Tier-age + early-Helios summary helpers ─────────────────────
// Shared by SnapshotEditor (the "updated X ago" line) and EventsTab's
// copy buttons (the early-Helios summary block).

/** "today", "3d ago", "5w ago", "4mo ago" — or null when there's no date. */
export function ageLabel(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const days = Math.floor(ms / 86400000);
  if (days < 1) return 'today';
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Days since the iso date, or null. */
export function ageDays(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 86400000) : null;
}

/** When furnace/troops were last set. Falls back to the profile's
 *  last-edit time (any field), flagged via `approximate`. */
export function tiersUpdatedInfo(player) {
  if (player?.tiersUpdatedAt) return { iso: player.tiersUpdatedAt, approximate: false };
  if (player?.profileLastUpdated) return { iso: player.profileLastUpdated, approximate: true };
  return { iso: null, approximate: false };
}

/** At least one of the three troop types is a Helios tier. */
export function isHeliosPlayer(player) {
  return ['infantry', 'lancer', 'marksman'].some(k => String(player?.troops?.[k] || '').startsWith('Helios'));
}

/** Has Norah as a joiner hero. */
export function hasNorah(player) {
  return (player?.joinerHeroes || []).some(j => /norah/i.test(j?.hero || ''));
}

function bestTierIdx(player) {
  const idx = ['infantry', 'lancer', 'marksman'].map(k => FC_ORDER.indexOf(player?.troops?.[k]));
  return Math.max(-1, ...idx);
}

/**
 * Arriving early = on the participant list and NOT flagged late,
 * intermittent or unsure. (Leaving early doesn't disqualify — they
 * still arrive at the start.)
 */
export function isArrivingEarly(snap) {
  const r = snap?.rsvp || {};
  return !r.willBeLate && !r.intermittent && !r.unsure;
}

/**
 * Early-arriving Helios players, Norah owners first, each group
 * strongest troop tier first, then by name.
 */
export function buildEarlyHeliosSummary(participants, getSnapFor) {
  const early = participants.filter(p => isArrivingEarly(getSnapFor(p)));
  const helios = early.filter(isHeliosPlayer);
  const name = p => p.username || p.alias || 'Unknown';
  const cmp = (a, b) => bestTierIdx(b) - bestTierIdx(a) || name(a).localeCompare(name(b));
  const norah = helios.filter(hasNorah).sort(cmp);
  const others = helios.filter(p => !hasNorah(p)).sort(cmp);
  return { earlyTotal: early.length, norah, others, count: helios.length };
}

export function generateEarlyHeliosText(participants, getSnapFor) {
  const { earlyTotal, norah, others, count } = buildEarlyHeliosSummary(participants, getSnapFor);
  const name = p => p.username || p.alias || 'Unknown';
  const line = p => {
    const t = ['infantry', 'lancer', 'marksman']
      .map(k => p.troops?.[k]).filter(Boolean);
    return `${name(p)}${t.length ? ` (${[...new Set(t)].join('/')})` : ''}`;
  };
  const out = [`☀️ Early-arriving Helios: ${count} of ${earlyTotal} arriving early`];
  if (!count) return out.join('\n');
  if (norah.length) out.push(`Norah joiners (${norah.length}): ${norah.map(line).join(', ')}`);
  if (others.length) out.push(`Other Helios (${others.length}): ${others.map(line).join(', ')}`);
  return out.join('\n');
}
