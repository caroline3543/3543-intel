/**
 * joinerMeta.js
 * Gen 1–6 rally formation data from community spreadsheet.
 * Used by Rally Joiner Registry → Meta tab.
 */

export const JOINER_HEROES = [
  'Jessie','Jasser','Jeronimo','Seo-Yoon','Patrick','Sergey',
  'Philly','Alonso',
  'Mia','Logan','Greg',
  'Reina','Ahmose','Lynn',
  'Norah','Hector','Gwen',
  'Wu Ming','Renee','Wayne',
];export const JOINER_META = [
  {
    gen: 1, genLabel: 'Gen 1 — Jeronimo, Natalia, Molly, Zinman + Purple Heroes',
    formations: [
      { type:'Defense', ratio:'60/40/0 or 60/10/30', leaders:['Jeronimo','Molly & Zinman'],   j1:'Jessie*', j2:'Seeyoon', j3:'Patrick', j4:'Patrick', alt1:'Sergey**', alt2:'Ling Xue', comments:'Jeronimo is Jessie + Seyoon already so stacking happens' },
      { type:'Offense', ratio:'50/20/30 or 30/20/50', leaders:['Jeronimo','Molly & Zinman'],   j1:'Jessie*', j2:'Seeyoon', j3:'Patrick', j4:'Jessie*/Patrick', alt1:'Sergey**', alt2:'Ling Xue', comments:'Jeronimo is Jessie + Seyoon already so stacking happens' },
    ],
  },
  {
    gen: 2, genLabel: 'Gen 2 — Flint, Philly, Alonso',
    formations: [
      { type:'Defense', ratio:'60/40/0 or 60/10/30', leaders:['Flint & Philly & Zinman'],    j1:'Patrick', j2:'Jessie*', j3:'Seeyoon', j4:'Sergey**', alt1:'Patrick', alt2:'Jessie*' },
      { type:'Offense', ratio:'50/20/30 or 30/20/50', leaders:['Jeronimo & Philly & Alonso'], j1:'Patrick', j2:'Jessie*', j3:'Seeyoon', j4:'Zinman',   alt1:'Patrick', alt2:'20% ones', comments:'Jeronimo is Jessie + Seyoon already so stacking happens' },
    ],
  },
  {
    gen: 3, genLabel: 'Gen 3 — Logan, Mia, Greg',
    formations: [
      { type:'Defense', ratio:'60/30/10 or 60/10/30', leaders:['Logan & Philly & Zinman'],    j1:'Mia',     j2:'Patrick', j3:'Jessie*', j4:'Seeyoon' },
      { type:'Offense', ratio:'50/20/30 or 30/20/50', leaders:['Jeronimo & Mia & Greg'],      j1:'Jessie*', j2:'Seeyoon', j3:'Philly',  j4:'Patrick',    alt1:'Zinman',   comments:'Jeronimo is Jessie + Seyoon already so stacking happens' },
      { type:'Offense', ratio:'60/40/0 or 40/60/0',   leaders:['Jeronimo & Mia & Greg/Alonso'],j1:'Jessie*',j2:'Seeyoon', j3:'Philly',  j4:'Patrick',    alt1:'Zinman',   comments:'Jeronimo is Jessie + Seyoon already so stacking happens' },
    ],
  },
  {
    gen: 4, genLabel: 'Gen 4 — Ahmose, Reina, Lynn',
    formations: [
      { type:'Defense', ratio:'60/40/0 or 60/30/10', leaders:['Ahmose/Logan & Reina & Lynn'], j1:'Mia',     j2:'Patrick', j3:'Jessie*', j4:'Seeyoon',    alt1:'Zinman',   alt2:'Philly' },
      { type:'Offense', ratio:'50/20/30 or 30/20/50', leaders:['Jeronimo & Reina & Greg'],    j1:'Mia',     j2:'Philly',  j3:'Patrick', j4:'Zinman',     alt1:'Jessie*',  alt2:'Seeyoon', comments:'Jeronimo is Jessie + Seyoon already' },
      { type:'Offense', ratio:'48/4/48 or 40/10/50',  leaders:['Jeronimo & Mia & Greg/Alonso'],j1:'Patrick',j2:'Philly',  j3:'Zinman',  j4:'Reina',     alt1:'Jessie*',  alt2:'Seeyoon', comments:'Jeronimo is Jessie + Seyoon already' },
      { type:'Offense', ratio:'60/40/0 or 40/60/0',   leaders:['Jeronimo & Reina/Mia & Greg'],j1:'Patrick', j2:'Philly',  j3:'Zinman',  j4:'Mia/Reina',  alt1:'Jessie*',  alt2:'Seeyoon', comments:'ONLY 1 Mia, do not stack here. Jeronimo is Jessie + Seyoon already' },
    ],
  },
  {
    gen: 5, genLabel: 'Gen 5 — Hector, Norah, Gwen',
    formations: [
      { type:'Defense', ratio:'60/40/0',               leaders:['Hector & Norah & Zinman'],    j1:'Mia',     j2:'Patrick', j3:'Jessie*', j4:'Philly' },
      { type:'Offense', ratio:'50/20/30 or 30/20/50',  leaders:['Jeronimo & Reina & Gwen'],    j1:'Mia',     j2:'Jessie*', j3:'Seeyoon', j4:'Norah',     alt1:'Patrick',  alt2:'Philly' },
      { type:'Offense', ratio:'48/4/48 or 40/10/50',   leaders:['Jeronimo & Mia & Gwen'],      j1:'Norah',   j2:'Norah',   j3:'Norah',   j4:'Patrick',    alt1:'Philly',   alt2:'Zinman', comments:'Alternative joiners choice: Jessie, Seeyoon, 2xPatrick' },
      { type:'Offense', ratio:'60/40/0 or 40/60/0',    leaders:['Jeronimo & Norah & Greg'],    j1:'Mia',     j2:'Patrick', j3:'Jessie*', j4:'Philly',     alt1:'Zinman' },
    ],
  },
  {
    gen: 6, genLabel: 'Gen 6 — Wu Ming, Renee, Wayne',
    formations: [
      { type:'Defense', ratio:'60/40/0',               leaders:['Wu Ming & Norah & Zinman'],   j1:'Renee',   j2:'Mia',     j3:'Patrick', j4:'Jessie*',    alt1:'Wu Ming',  comments:'Wu Ming to counter his skills damages' },
      { type:'Offense', ratio:'50/20/30 or 30/20/50',  leaders:['Jeronimo & Renee & Gwen'],    j1:'Jessie*', j2:'Seeyoon', j3:'Mia',     j4:'Norah',      alt1:'Patrick',  alt2:'Wu Ming', comments:'Jeronimo is Jessie + Seyoon already so stacking happens. Wu Ming to counter his skills damages' },
      { type:'Offense', ratio:'48/4/48 or 40/10/50',   leaders:['Jeronimo/Hector & Mia & Wayne/Gwen'],j1:'Norah',j2:'Norah',j3:'Norah',j4:'Norah/Patrick',alt1:'or 25%', comments:'Alternative joiners choice: Jessie, Seeyoon, 2xPatrick. Wu Ming to counter his skills damages' },
      { type:'Offense', ratio:'60/40/0 or 40/60/0',    leaders:['Jeronimo & Renee & Greg'],    j1:'Mia',     j2:'Patrick', j3:'Jessie**',j4:'Seeyoon',    alt1:'Wu Ming',  alt2:'Philly', comments:'Jeronimo is Jessie + Seyoon already so stacking happens. Wu Ming to counter his skills damages' },
      { type:'NEW META Defense', ratio:'48/4/48 or 45/5/50', leaders:['Logan & Philly & Wayne'],     j1:'Norah',   j2:'Norah',   j3:'Norah',   j4:'Norah/Patrick',alt1:'or 25%', comments:'', isMeta:true },
      { type:'NEW Defense',      ratio:'45/16/40',      leaders:['Hector & Norah & Wayne'],     j1:'Mia',     j2:'Patrick', j3:'Philly',  j4:'Lynn',       alt1:'or 25%', isMeta:true },
    ],
  },
  // ── Gen 7–9: transcribed from a community spreadsheet screenshot.
  // Hero/ratio/joiner columns are transcribed with reasonable
  // confidence. The "Comments" column was cut off at the image's right
  // edge for these three generations and could NOT be reliably read —
  // left blank here rather than guessed. isMeta:true on all three
  // pending real-battle confirmation (see TestRallyLog on each rally
  // slot) — SPOT-CHECK THESE AGAINST THE ORIGINAL SOURCE before
  // relying on them in a live battle.
  {
    gen: 7, genLabel: 'Gen 7 — Edith, Gordon, Bradley',
    formations: [
      { type:'Defense', ratio:'60/40/0',              leaders:['Edith & Gordon & Bradley'],        j1:'Renee', j2:'Mia',   j3:'Reina', j4:'Jessie', alt1:'Wu Ming', comments:'', isMeta:true },
      { type:'Defense', ratio:'40/0/60 or 48/4/48',    leaders:['Edith & Molly/Philly & Bradley'],  j1:'Mia',   j2:'Norah', j3:'Norah', j4:'Lynn',   alt1:'or 25%',  comments:'', isMeta:true },
      { type:'Offense', ratio:'48/4/48 or 40/10/50',   leaders:['Jeronimo/Edith & Mia & Bradley'],  j1:'Norah', j2:'Norah', j3:'Norah', j4:'Patrick',alt1:'or 25%', alt2:'Philly', comments:'', isMeta:true },
    ],
  },
  {
    gen: 8, genLabel: 'Gen 8 — Gatot, Sonya, Hendrik',
    formations: [
      { type:'Defense', ratio:'60/40/0',               leaders:['Gatot & Sonya & Bradley'],         j1:'Renee', j2:'Patrick', j3:'Mia',   j4:'Hendrik', alt1:'or 25%', alt2:'Wu Ming', comments:'', isMeta:true },
      { type:'Defense', ratio:'40/0/60 or 48/4/48',    leaders:['Gatot & Molly/Philly & Bradley'],  j1:'Mia',   j2:'Patrick', j3:'Norah', j4:'Lynn',    alt1:'or 25%', comments:'', isMeta:true },
      { type:'Offense', ratio:'48/4/48',                leaders:['Jeronimo & Mia & Bradley'],       j1:'Norah', j2:'Norah',   j3:'Norah', j4:'Hendrik', alt1:'or 25%', comments:'', isMeta:true },
      { type:'Offense', ratio:'48/4/48 or 40/60',       leaders:['Edith & Mia & Hendrik'],           j1:'Norah', j2:'Norah',   j3:'Jessie',j4:'Seeyoon',  alt1:'or 25%', alt2:'Norah',   alt3:'Wu Ming', comments:'', isMeta:true },
      { type:'Offense', ratio:'60/40/0 or 60/40/0',     leaders:['Edith/Gatot & Sonya & Bradley'],  j1:'Renee', j2:'Mia',     j3:'Hendrik', j4:'Jessie', alt1:'or 25%', alt2:'Wu Ming', comments:'', isMeta:true },
      { type:'Offense', ratio:'60/40/0 or 60/40/0',     leaders:['Jeronimo & Gordon & Bradley'],    j1:'Renee', j2:'Mia',     j3:'Hendrik', j4:'Patrick',alt1:'or 25%', alt2:'Wu Ming', comments:'', isMeta:true },
    ],
  },
  {
    gen: 9, genLabel: 'Gen 9 — Magnus, Fred, Xura',
    formations: [
      { type:'Defense', ratio:'60/40/0',               leaders:['Magnus & Sonya & Bradley'],           j1:'Renee', j2:'Mia',   j3:'Patrick', j4:'Hendrik', alt1:'or 25%', alt2:'Wu Ming', alt3:'Gatot', comments:'', isMeta:true },
      { type:'Defense', ratio:'40/0/60 or 48/4/48',    leaders:['Magnus & Molly/Philly & Bradley/Xura'],j1:'Mia',   j2:'Patrick', j3:'Norah', j4:'Lynn',    alt1:'or 25%', alt2:'Gatot', comments:'', isMeta:true },
      { type:'Offense', ratio:'48/4/48 or 40/10/50',   leaders:['Magnus & Mia & Hendrik'],              j1:'Norah', j2:'Norah', j3:'Norah', j4:'Patrick', alt1:'or 25%', alt2:'Gatot', comments:'', isMeta:true },
      { type:'Offense', ratio:'60/40/0 or 60/40/0',    leaders:['Magnus & Fred & Bradley'],             j1:'Renee', j2:'Mia',   j3:'Norah', j4:'Hendrik', alt1:'or 25%', alt2:'Wu Ming', alt3:'Gatot', comments:'', isMeta:true },
    ],
  },
];

/**
 * Highest generation with real, authored formation data. Computed from
 * JOINER_META itself — single source of truth for both SettingsPanel.jsx
 * (which generations to flag as "no guided formations yet") and
 * FormationPicker.jsx (which empty-state message to show), so neither
 * file hardcodes a number that could drift out of sync if more
 * generations get formation data added later.
 */
export const FORMATION_GEN_CUTOFF = Math.max(...JOINER_META.map(g => g.gen));

/**
 * Build a coverage report: for each joiner hero, how many players own it.
 */
export function buildCoverageReport(players, heroList) {
  return heroList.map(hero => {
    const owners = players.filter(p =>
      (p.joinerHeroes || []).some(jh => jh.hero === hero && jh.skillLevel >= 5)
    );
    return { hero, count: owners.length, owners };
  });
}

/**
 * Given a generation and attack/defense type, return ONE recommended
 * formation — not a browsable list of every variant. This is what
 * powers the simplified Battle Plan picker: pick gen + type, get a
 * single clear answer (leader heroes, ratio, joiners), not a menu of
 * every Offense A/B/C variant.
 *
 * When a generation has multiple matching formations (e.g. three
 * Offense variants), established (non-isMeta) entries are preferred
 * over "NEW"/isMeta ones — those are newer, less-verified picks (see
 * the December-update warning at the top of this file's source data)
 * and shouldn't be the default recommendation until more real-world
 * results confirm them.
 */
export function getRecommendedFormation(gen, type) {
  const genData = JOINER_META.find(g => g.gen === gen);
  if (!genData) return null;
  const wanted = (type || '').toLowerCase();
  const matches = genData.formations.filter(f => f.type.toLowerCase().includes(wanted));
  if (!matches.length) return null;
  const established = matches.filter(f => !f.isMeta);
  return established[0] || matches[0];
}

/**
 * Given gen/type/ratio filters, return the matching meta formation.
 */
export function getMetaSuggestion(gen, type, ratio) {
  const genData = JOINER_META.find(g => g.gen === gen);
  if (!genData) return null;
  let formations = genData.formations;
  if (type) formations = formations.filter(f => f.type.toLowerCase().includes(type.toLowerCase()));
  if (ratio && ratio !== 'Any') formations = formations.filter(f => f.ratio.includes(ratio));
  return formations[0] || null;
}
