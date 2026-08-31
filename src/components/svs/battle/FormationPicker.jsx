import { useState } from 'react';
import { C } from '../../../utils/constants.js';
import { getRecommendedFormation } from '../../../data/joinerMeta.js';
import { suggestPriorityJoiners } from '../../../data/metrics.js';
import { newJoinerSlot } from '../../../data/playerSchema.js';
import { buildFormationMessage } from '../../../services/formationMessage.js';
import { resolveHero, playerCanFillSlot, meetsTroopReqs, CUSTOM_HERO_OPTIONS } from './battleConstants.js';

// ── FormationPicker ────────────────────────────────────────────
// Renders the guided/custom formation section inside a RallySlotCard.
//
// Redesigned: instead of browsing every formation for every generation
// up to a cumulative cap, this shows ONE clear recommendation per
// selected generation (via joinerMeta.js's getRecommendedFormation) —
// exactly the generations chosen in Settings, nothing else. Selecting
// a recommendation auto-fills the leader heroes, ratio, AND the 4
// priority joiner slots (via suggestPriorityJoiners, weighted by who
// owns the required heroes and is currently available) — the officer
// can still hand-edit anything afterward.
//
// Props:
//   slot           – rally slot object
//   upd            – (patch) => void  — updates the parent slot
//   color          – accent colour for this rally type
//   players        – full roster array (for coverage checks + auto-suggest)
//   events         – full events array (for auto-suggest's reliability scoring)
//   selectedGenerations – number[] from Settings, explicit not cumulative;
//                        empty means "no filter, show every generation"
//   assignedInOtherSlots – Set of playerIds already used elsewhere in
//                          this plan — auto-suggest won't propose them
export function FormationPicker({ slot, upd, color, players, events = [], selectedGenerations = [], assignedInOtherSlots }) {
  const [copied, setCopied] = useState(false);
  // Once a formation is selected, show only that one card — the rest
  // stay accessible via "Change formation" rather than occupying
  // screen space. Resets to the compact view every time a NEW
  // selection is made (see selectFormation).
  const [showAll, setShowAll] = useState(false);
  const isCustom = slot.formationMode === 'custom';

  const gensToShow = selectedGenerations.length > 0
    ? selectedGenerations
    : Array.from({ length: 6 }, (_, i) => i + 1);

  // Real formation data sometimes packs multiple heroes into one array
  // element (e.g. ['Jeronimo', 'Molly & Zinman']) — flatten to a clean
  // list of individual hero names so "3 heroes chosen" checks (see
  // RatioPicker.jsx) work against real data, not just custom mode's
  // already-flat toggle list. "/" alternatives take the first option.
  function flattenLeaders(leadersArr) {
    return (leadersArr || [])
      .flatMap(l => l.split('&').map(part => part.trim().split('/')[0].trim()))
      .filter(Boolean);
  }

  function recsForGen(gen) {
    if (slot.formationFilter) {
      const rec = getRecommendedFormation(gen, slot.formationFilter);
      return rec ? [rec] : [];
    }
    // "All" — one offense pick and one defense pick, not a full browse list
    return [getRecommendedFormation(gen, 'offense'), getRecommendedFormation(gen, 'defense')].filter(Boolean);
  }

  const recommendations = gensToShow.flatMap(recsForGen);

  function getCoverage(f) {
    return [f.j1, f.j2, f.j3, f.j4].filter(Boolean).map(heroRaw => {
      const resolved = resolveHero(heroRaw);
      const count    = players.filter(p => playerCanFillSlot(p, heroRaw)).length;
      return { heroRaw, display: resolved?.display, alternatives: resolved?.alternatives, count, ok: count >= 1 };
    });
  }

  const selectedFormation = slot.selectedFormation
    ? recommendations.find(f =>
        f.gen === slot.selectedFormation.gen &&
        f.leaders.join() === slot.selectedFormation.leaders.join() &&
        f.type === slot.selectedFormation.type)
    : null;

  // Auto-suggest the 4 priority joiners for a formation's hero slots —
  // resolves substitution notation ("Jessie*" -> Jessie/Jasser/Jeronimo),
  // excludes anyone already used elsewhere in this plan, AND excludes
  // anyone below the rally's minimum troop tier requirements (used to
  // only check hero ownership, never troop tier).
  function autoSuggestJoiners(heroSlotStrings) {
    const resolvedSlots = heroSlotStrings.filter(Boolean).map(raw => {
      const r = resolveHero(raw);
      return { slotLabel: raw, heroOptions: r ? [r.display, ...r.alternatives] : [raw] };
    });
    const excludeIds = assignedInOtherSlots || new Set();
    const eligiblePlayers = players
      .filter(p => !excludeIds.has(p.id))
      .filter(p => meetsTroopReqs(p, slot.troopReqs).ok);
    const suggested = suggestPriorityJoiners(resolvedSlots, eligiblePlayers, events);
    return suggested.map(s => newJoinerSlot({
      playerId:   s.player?.id || null,
      playerName: s.player ? (s.player.username || s.player.alias || '') : '',
      heroName:   s.hero || '',
      confirmed:  true,
    }));
  }

  function selectFormation(f) {
    const isSelected = selectedFormation &&
      f.gen === selectedFormation.gen && f.leaders.join() === selectedFormation.leaders.join() && f.type === selectedFormation.type;

    if (isSelected) { upd({ selectedFormation: null }); setShowAll(true); return; }

    upd({
      selectedFormation: { gen:f.gen, leaders:f.leaders, type:f.type },
      leaderRallyHeroes: flattenLeaders(f.leaders),
      requestedHeroes:   [f.j1, f.j2, f.j3, f.j4].filter(Boolean).map(h => resolveHero(h)?.display).filter(Boolean),
      ratio:             f.ratio,
      joiners:           autoSuggestJoiners([f.j1, f.j2, f.j3, f.j4]),
    });
    setShowAll(false);
  }

  function customAutoSuggest() {
    upd({ joiners: autoSuggestJoiners(slot.requestedHeroes || []) });
  }

  function copyInstructions() {
    const formation = selectedFormation || {
      type: slot.type, ratio: slot.ratio, leaders: slot.leaderRallyHeroes || [],
    };
    const messageJoiners = (slot.joiners || []).map(j => ({
      player: j.playerId ? { username: j.playerName } : null,
      hero:   j.heroName,
    }));
    const text = buildFormationMessage(formation, messageJoiners, slot.leaderName);
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const heroesLocked = (slot.leaderRallyHeroes || []).length === 3;

  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Formation</label>
      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
        {selectedGenerations.length > 0
          ? `Showing Gen ${selectedGenerations.join(', ')}. Change in ⚙️ Settings.`
          : 'Showing all generations — pick which ones apply to you in ⚙️ Settings.'}
      </div>

      {/* All / Offense / Defense / Custom toggle */}
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        {[
          ['All',      null,      '#A8C4D8'],
          ['⚔️ Offense','offense', '#F5A623'],
          ['🛡️ Defense','defense', '#6B8CAE'],
          ['🔬 Custom', 'custom',  '#30D158'],
        ].map(([label, val, c]) => {
          const active = val === 'custom'
            ? isCustom
            : !isCustom && slot.formationFilter === val;
          return (
            <button key={label} onClick={() => {
              if (val === 'custom') upd({ formationMode:'custom', selectedFormation:null });
              else upd({ formationMode:'guided', formationFilter:val, selectedFormation:null });
            }} style={{ flex:1, height:38, borderRadius:10, border:`1px solid ${active?c:C.border}`, background:active?c+'22':C.section, color:active?c:C.muted, fontWeight:700, fontSize:12, cursor:'pointer' }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Custom mode */}
      {isCustom && (
        <div style={{ background:C.section, borderRadius:12, padding:14 }}>
          <div style={{ fontSize:12, color:C.green, fontWeight:700, marginBottom:10 }}>🔬 Custom formation — enter any heroes and ratio</div>

          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:6 }}>Leader rally heroes {heroesLocked && <span style={{ color:C.gold }}>· 3 chosen ✓</span>}</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {['Jeronimo','Natalia','Molly','Zinman','Flint','Philly','Alonso','Logan','Mia','Greg','Ahmose','Reina','Lynn','Hector','Norah','Gwen','Wu Ming','Renee','Wayne'].map(hero => {
                const sel = (slot.leaderRallyHeroes || []).includes(hero);
                return (
                  <button key={hero} onClick={() => {
                    const c = slot.leaderRallyHeroes || [];
                    upd({ leaderRallyHeroes: sel ? c.filter(h => h !== hero) : [...c, hero] });
                  }} style={{ padding:'5px 10px', borderRadius:12, border:`1px solid ${sel?color:C.border}`, background:sel?color+'22':C.card, color:sel?color:C.muted, fontWeight:sel?700:400, fontSize:12, cursor:'pointer' }}>
                    {sel ? '✓ ' : ''}{hero}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:6 }}>Requested joiner heroes</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {CUSTOM_HERO_OPTIONS.map(hero => {
                const sel = (slot.requestedHeroes || []).includes(hero);
                return (
                  <button key={hero} onClick={() => {
                    const c = slot.requestedHeroes || [];
                    upd({ requestedHeroes: sel ? c.filter(h => h !== hero) : [...c, hero] });
                  }} style={{ padding:'5px 10px', borderRadius:12, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.card, color:sel?C.gold:C.muted, fontWeight:sel?700:400, fontSize:12, cursor:'pointer' }}>
                    {sel ? '✓ ' : ''}{hero}
                  </button>
                );
              })}
            </div>
          </div>

          {(slot.requestedHeroes || []).length > 0 && (
            <button onClick={customAutoSuggest}
              style={{ width:'100%', height:44, borderRadius:10, background:C.gold+'18', border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
              🔄 Auto-suggest joiners from requested heroes
            </button>
          )}
        </div>
      )}

      {/* Guided recommendation cards — one per selected generation
          (two if "All" is picked: one offense, one defense) */}
      {!isCustom && (() => {
        function renderCard(f, i) {
          const isSelected = selectedFormation &&
            f.gen === selectedFormation.gen &&
            f.leaders.join() === selectedFormation.leaders.join() &&
            f.type === selectedFormation.type;
          const coverage   = getCoverage(f);
          const allCovered = coverage.every(c => c.ok);
          const fColor     = f.type.toLowerCase().includes('offense') ? '#F5A623' : '#6B8CAE';

          return (
            <div key={i} onClick={() => selectFormation(f)}
              style={{ background:isSelected?fColor+'18':C.section, border:`1.5px solid ${isSelected?fColor:C.border}`, borderRadius:12, padding:14, marginBottom:8, cursor:'pointer' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:12, color:fColor, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>
                    Gen {f.gen} · {f.type}{f.isMeta ? ' · ⚠ unverified' : ''}
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.white }}>
                    {f.leaders.join(' + ')}
                  </div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{f.ratio}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                  {isSelected && <span style={{ fontSize:11, color:fColor, fontWeight:700 }}>✓ Selected</span>}
                  <span style={{ fontSize:11, color:allCovered?C.green:C.gold, fontWeight:600 }}>
                    {allCovered ? '✓ Full coverage' : '⚠ Check coverage'}
                  </span>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:f.comments?6:0 }}>
                {coverage.map((c, ci) => (
                  <div key={ci} style={{ background:C.card, borderRadius:8, padding:'6px 10px', display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:c.ok?C.green:C.red, flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:C.white }}>{c.display}</div>
                      {c.alternatives?.length > 0 && <div style={{ fontSize:10, color:C.muted }}>or {c.alternatives.join('/')}</div>}
                    </div>
                    <div style={{ fontSize:11, color:c.ok?C.green:C.red, fontWeight:700 }}>×{c.count}</div>
                  </div>
                ))}
              </div>

              {[f.alt1, f.alt2].filter(Boolean).length > 0 && (
                <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>Alt: {[f.alt1, f.alt2].filter(Boolean).join(' · ')}</div>
              )}
              {f.comments && <div style={{ fontSize:11, color:C.gold, marginTop:4, fontStyle:'italic' }}>⚠ {f.comments}</div>}
            </div>
          );
        }

        const showCompact = selectedFormation && !showAll;
        const cardsToShow = showCompact
          ? recommendations.filter(f =>
              f.gen === selectedFormation.gen &&
              f.leaders.join() === selectedFormation.leaders.join() &&
              f.type === selectedFormation.type)
          : recommendations;

        return (
          <div>
            {recommendations.length === 0 && (
              <div style={{ fontSize:13, color:C.muted, textAlign:'center', padding:'20px 0' }}>
                No {slot.formationFilter || ''} formation found for the selected generation{gensToShow.length !== 1 ? 's' : ''}.
              </div>
            )}
            {cardsToShow.map((f, i) => renderCard(f, i))}
            {showCompact && (
              <button onClick={() => setShowAll(true)}
                style={{ width:'100%', height:36, borderRadius:8, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:12, cursor:'pointer', marginTop:2 }}>
                Change formation ▾
              </button>
            )}
          </div>
        );
      })()}

      {/* Copy alliance-wide instructions — available once a formation
          is selected (guided) or heroes are chosen (custom) */}
      {(selectedFormation || heroesLocked) && (
        <button onClick={copyInstructions}
          style={{ width:'100%', height:44, borderRadius:10, marginTop:8, background:copied?C.green+'18':C.section, border:`1px solid ${copied?C.green:C.border}`, color:copied?C.green:C.icy, fontWeight:700, fontSize:13, cursor:'pointer' }}>
          {copied ? '✓ Copied' : '📋 Copy formation instructions'}
        </button>
      )}
    </div>
  );
}
