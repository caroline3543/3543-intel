/**
 * formationMessage.js
 *
 * Builds the copy-to-clipboard message for a recommended formation —
 * "this leader uses these heroes, this ratio, these priority joiners."
 * Pure function, no React, no side effects — the actual
 * navigator.clipboard.writeText() call belongs in whichever component
 * wires up the Copy button (RallySlotCard.jsx or wherever the
 * formation picker ends up living).
 *
 * Mirrors the Calculator's existing copy-message pattern
 * (rally/Calculator.jsx's copyMsg) but for the pre-battle formation
 * assignment stage, not live rally timing.
 */

export function buildFormationMessage(formation, prioritizedJoiners, leaderName) {
  if (!formation) return '';

  const leaderHeroes = (formation.leaders || []).join(' & ');
  const header = leaderName
    ? `⚔️ ${formation.type} — Ratio ${formation.ratio}\nRally Leader: ${leaderName} (${leaderHeroes})`
    : `⚔️ ${formation.type} — Ratio ${formation.ratio}\nRally Leader heroes: ${leaderHeroes}`;

  const joinersText = (prioritizedJoiners || [])
    .map((slot, i) => {
      const who = slot.player ? (slot.player.username || slot.player.alias || 'Unknown') : 'UNASSIGNED — needs an officer to fill this';
      return `${i + 1}. ${who} → ${slot.hero}`;
    })
    .join('\n') || 'Not yet assigned';

  const altsText = [formation.alt1, formation.alt2, formation.alt3].filter(Boolean).join(', ');

  return [
    header,
    '',
    'Priority Joiners:',
    joinersText,
    altsText ? `\nAlternatives if unavailable: ${altsText}` : '',
    formation.comments ? `\nNote: ${formation.comments}` : '',
    '\nJoin now. Do not solo.',
  ].filter(Boolean).join('\n');
}
