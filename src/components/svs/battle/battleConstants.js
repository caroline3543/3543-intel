// ── battleConstants.js ─────────────────────────────────────────
// Shared constants and pure helper functions for BattleTab sub-components.
// No React. No side-effects. Import freely from any battle sub-component.

import { JOINER_META } from '../../../data/joinerMeta.js';

export const RALLY_TYPES = [
  'Main Rally','Counter Rally','Counter-Counter',
  'Switch Fight','Garrison Entry','Reinforcement','Custom',
];

export const RALLY_ICONS = {
  'Main Rally':'⚔️','Counter Rally':'🛡️','Counter-Counter':'🔄',
  'Switch Fight':'⚡','Garrison Entry':'🏰','Reinforcement':'🔰','Custom':'📋',
};

export const RALLY_COLORS = {
  'Main Rally':'#F5A623','Counter Rally':'#FF453A','Counter-Counter':'#FF8C00',
  'Switch Fight':'#30D158','Garrison Entry':'#6B8CAE','Reinforcement':'#7BAE8C','Custom':'#A8C4D8',
};

export const RATIO_PRESETS = [
  '60/40/0','50/20/30','48/4/48','40/60/0','60/0/40','0/40/60','50/50/0',
];

export const RALLY_DURATIONS = [1, 3, 5];

// Hero substitution rules from spreadsheet footnotes
export const HERO_SUBS = {
  'Jessie*':   ['Jessie','Jasser','Jeronimo'],
  'Seeyoon':   ['Seo-Yoon','Seeyoon'],
  'Sergey**':  ['Sergey','Bahiti','Lumak Bokan'],
  'Patrick':   ['Patrick'],
  'Mia':       ['Mia'],
  'Philly':    ['Philly'],
  'Zinman':    ['Zinman'],
  'Norah':     ['Norah'],
  'Reina':     ['Reina'],
  'Lynn':      ['Lynn'],
  'Logan':     ['Logan'],
  'Greg':      ['Greg'],
  'Flint':     ['Flint'],
  'Alonso':    ['Alonso'],
  'Ahmose':    ['Ahmose'],
  'Hector':    ['Hector'],
  'Gwen':      ['Gwen'],
  'Wu Ming':   ['Wu Ming'],
  'Wayne':     ['Wayne'],
  'Renee':     ['Renee'],
};

/** Resolve a raw hero name (possibly with * or **) to display + alternatives. */
export function resolveHero(raw) {
  if (!raw) return null;
  const clean = raw.replace(/\*/g,'').replace(/\*\*/g,'').trim();
  const subs  = HERO_SUBS[raw] || HERO_SUBS[clean] || [clean];
  return { display: subs[0], alternatives: subs.slice(1), raw };
}

/** True if player has any acceptable Skill-5 hero for this slot. */
export function playerCanFillSlot(player, heroRaw) {
  const resolved = resolveHero(heroRaw);
  if (!resolved) return false;
  const allAcceptable = [resolved.display, ...resolved.alternatives];
  return (player.joinerHeroes || []).some(
    jh => jh.skillLevel >= 5 && allAcceptable.some(h => h.toLowerCase() === jh.hero.toLowerCase())
  );
}

/**
 * Given the leader's heroes and slot type, return the best matching meta formation.
 * Returns null when no match is found.
 */
export function suggestJoinerHeroes(leaderPlayer, slotType, leaderRallyHeroes) {
  const heroSource = leaderRallyHeroes?.length > 0
    ? leaderRallyHeroes
    : (leaderPlayer?.joinerHeroes || []).filter(jh => jh.skillLevel >= 5).map(jh => jh.hero);

  if (!heroSource || heroSource.length === 0) return null;

  const isDefense =
    slotType?.toLowerCase().includes('garrison') ||
    slotType?.toLowerCase().includes('reinforcement') ||
    slotType === 'Counter Rally';
  const formationType = isDefense ? 'Defense' : 'Offense';

  let bestFormation = null;
  let bestScore     = -1;

  for (const gen of JOINER_META) {
    for (const f of gen.formations) {
      const leaderStr = f.leaders.join(' ').toLowerCase();
      let score = 0;
      for (const hero of heroSource) {
        if (leaderStr.includes(hero.toLowerCase())) score += 2;
      }
      if (f.type.toLowerCase().includes(formationType.toLowerCase())) score += 1;

      if (score > bestScore) {
        bestScore     = score;
        bestFormation = { ...f, gen: gen.gen, genLabel: gen.genLabel };
      }
    }
  }

  if (!bestFormation || bestScore === 0) return null;

  return {
    formation:      bestFormation,
    suggestedHeroes: [bestFormation.j1, bestFormation.j2, bestFormation.j3, bestFormation.j4]
      .filter(Boolean)
      .map(h => h.replace(/\*/g,'').replace(/\*\*/g,'').trim()),
    alternatives: [bestFormation.alt1, bestFormation.alt2].filter(Boolean),
    comments:     bestFormation.comments || '',
    genLabel:     bestFormation.genLabel,
  };
}

export const FC_ORDER = ['FC1','FC2','FC3','FC4','FC5'];
