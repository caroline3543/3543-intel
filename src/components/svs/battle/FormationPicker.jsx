import { useState } from 'react';
import { C } from '../../../utils/constants.js';
import { getRecommendedFormation, FORMATION_GEN_CUTOFF } from '../../../data/joinerMeta.js';
import { suggestPriorityJoiners } from '../../../data/metrics.js';
import { newJoinerSlot } from '../../../data/playerSchema.js';
import { resolveHero, playerCanFillSlot, meetsTroopReqs, CUSTOM_HERO_OPTIONS, LEADER_HERO_OPTIONS } from './battleConstants.js';

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
export function FormationPicker({ slot, upd, color, players, events = [], selectedGenerations = [], assignedInOtherSlots, leaderPlayer = null }) {
  // Once a formation is selected, show only that one card — the rest
  // stay accessible via "Change formation" rather than occupying
  // screen space. Resets to the compact view every time a NEW
  // selection is made (see selectFormation).
  const [showAll, setShowAll] = useState(false);
  const [expandedIndices, setExpandedIndices] = useState(new Set());
  const [chosenGen, setChosenGen] = useState(null);
  const isCustom = slot.formationMode === 'custom';

  // Only ask "which generation" when Settings has genuinely more than
  // one selected — with exactly one (or none, meaning "show
  // everything"), there's nothing ambiguous to ask about, so this
  // stays out of the way and behaves as before. This intentionally
  // does NOT reopen the "no per-plan override" decision — Settings is
  // still the only source of which generations are even choosable
  // here; this just asks the officer to pick one FROM that set before
  // browsing, instead of mixing every selected generation together.
  const needsGenChoice = selectedGenerations.length > 1;

  const gensToShow = needsGenChoice
    ? (chosenGen ? [chosenGen] : [])
    : selectedGenerations.length > 0
      ? selectedGenerations
      : Array.from({ length: FORMATION_GEN_CUTOFF }, (_, i) => i + 1);

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

  // Coverage should reflect true remaining availability — excluding
  // anyone already committed as a joiner elsewhere (this slot's other
  // 3 priority joiners, another slot in this plan, or another plan
  // linked to the same event — see assignedInOtherSlots, which
  // RallySlotCard now passes as the FULL combined exclusion set, not
  // just "other slots in this plan"). Otherwise "✓ Full coverage" could
  // count someone who's actually already spoken for.
  //
  // Hero requirements can STACK — some formations genuinely call for
  // the same hero 2-3+ times (e.g. 3x Norah), not 4 distinct heroes.
  // Checking each slot independently would show "✓ covered" on all 3
  // Norah slots even with only 1 available Norah owner, since each
  // check only asked "is there at least 1" in isolation. Grouping by
  // resolved hero name and checking DISTINCT owners against the total
  // copies needed fixes this. If a hero's own owners run short, the
  // formation's alt1/alt2 (its own alternates, separate from the
  // */** substitution notation already baked into resolveHero) are
  // tried next before giving up — matching the spreadsheet's actual
  // "alternative joiners choice" intent, not just a text hint.
  function getCoverage(f) {
    const excludeIds = assignedInOtherSlots || new Set();
    const availablePool = players.filter(p => !excludeIds.has(p.id));
    const heroSlots = [f.j1, f.j2, f.j3, f.j4].filter(Boolean);

    const counts = {};
    heroSlots.forEach(raw => {
      const key = resolveHero(raw)?.display || raw;
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts).map(([heroKey, needed]) => {
      const raw = heroSlots.find(r => (resolveHero(r)?.display || r) === heroKey);
      const resolved = resolveHero(raw);
      const owners = availablePool.filter(p => playerCanFillSlot(p, raw));
      if (owners.length >= needed) {
        return { heroRaw: raw, display: resolved?.display, alternatives: resolved?.alternatives, count: owners.length, needed, ok: true };
      }
      // Primary hero (and its built-in */** alternates) can't cover
      // the need — check the formation's own alt1/alt2 next.
      for (const altRaw of [f.alt1, f.alt2, f.alt3].filter(Boolean)) {
        const altOwners = availablePool.filter(p => playerCanFillSlot(p, altRaw));
        if (altOwners.length >= needed) {
          return { heroRaw: raw, display: resolved?.display, alternatives: resolved?.alternatives, count: owners.length, needed, ok: true, viaAlt: resolveHero(altRaw)?.display || altRaw };
        }
      }
      return { heroRaw: raw, display: resolved?.display, alternatives: resolved?.alternatives, count: owners.length, needed, ok: false };
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
  // anyone below the rally's minimum troop tier requirements. If given,
  // formationAlts (a formation's own alt1/alt2 — a different thing
  // from */** substitution notation) are appended as a LAST-RESORT
  // fallback on every slot: only tried once the slot's own hero (and
  // its built-in alternates) come up with nobody available.
  function autoSuggestJoiners(heroSlotStrings, formationAlts = []) {
    const altOptions = formationAlts.filter(Boolean).flatMap(raw => {
      const r = resolveHero(raw);
      return r ? [r.display, ...r.alternatives] : [raw];
    });
    const resolvedSlots = heroSlotStrings.filter(Boolean).map(raw => {
      const r = resolveHero(raw);
      const primary = r ? [r.display, ...r.alternatives] : [raw];
      return { slotLabel: raw, heroOptions: [...primary, ...altOptions] };
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
      joiners:           autoSuggestJoiners([f.j1, f.j2, f.j3, f.j4], [f.alt1, f.alt2, f.alt3]),
    });
    setShowAll(false);
  }

  function customAutoSuggest() {
    upd({ joiners: autoSuggestJoiners(slot.requestedHeroes || []) });
  }

  // Apply a Rally Leader's saved team setup (from their Rally Leader
  // Profile) — always a suggestion the officer can then edit, never a
  // forced assignment. Falls into Custom mode since a leader's own
  // saved setup isn't one of joinerMeta.js's gen-based formations.
  const isDefenseType = slot.type?.toLowerCase().includes('garrison')
    || slot.type?.toLowerCase().includes('reinforcement')
    || slot.type === 'Counter Rally';
  const wantedTeamType = isDefenseType ? 'defense' : 'offense';
  const leaderTeams = (leaderPlayer?.leaderProfile?.teams || []).filter(t => t.type === wantedTeamType);

  function applyLeaderTeam(team) {
    upd({
      formationMode:     'custom',
      selectedFormation: null,
      leaderRallyHeroes: (team.leadHeroes || []).filter(Boolean),
      requestedHeroes:   (team.priorityJoinerHeroes || []).filter(Boolean),
      ratio:             team.ratio || slot.ratio,
      joiners:           autoSuggestJoiners(team.priorityJoinerHeroes || []),
    });
  }

  const heroesLocked = (slot.leaderRallyHeroes || []).length === 3;

  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Formation</label>
      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
        {needsGenChoice
          ? `Alliance uses Gen ${selectedGenerations.join(', ')} — pick one below for this rally.`
          : selectedGenerations.length > 0
            ? `Showing Gen ${selectedGenerations.join(', ')}. Change in ⚙️ Settings.`
            : 'Showing all generations — pick which ones apply to you in ⚙️ Settings.'}
      </div>

      {/* Rally Leader's saved setup — MUCH more prominent than a
          regular recommendation card, since it's the leader's own
          confirmed data, not a generic community formation. Always
          shown fully expanded (never collapsed) for that reason. */}
      {leaderTeams.length > 0 && (
        <div style={{ background:C.gold+'14', border:`2px solid ${C.gold}`, borderRadius:14, padding:16, marginBottom:16, boxShadow:`0 0 0 4px ${C.gold}0e` }}>
          <div style={{ fontSize:15, color:C.gold, fontWeight:800, marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>👑</span> {leaderPlayer.username || leaderPlayer.alias}'s saved {wantedTeamType} setup
          </div>
          {leaderTeams.map((team, i) => {
            const leadHeroes = (team.leadHeroes || []).filter(Boolean);
            const joinerHeroes = (team.priorityJoinerHeroes || []).filter(Boolean);
            return (
              <button key={team.id} onClick={() => applyLeaderTeam(team)}
                style={{ display:'block', width:'100%', textAlign:'left', padding:'12px 14px', marginBottom:8, borderRadius:10, background:C.card, border:`1.5px solid ${i===0?C.gold:C.border}`, cursor:'pointer' }}>
                <div style={{ fontSize:13, fontWeight:800, color:C.gold, marginBottom:6 }}>{i === 0 ? '⭐ Recommended' : `Alternative ${i}`}{team.ratio ? ` · ${team.ratio}` : ''}</div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>Lead heroes</div>
                <div style={{ fontSize:13, color:C.white, fontWeight:600, marginBottom:8 }}>
                  {leadHeroes.length > 0 ? leadHeroes.map(h => `${h}${team.widgets?.[h] != null ? ` (${team.widgets[h]} widgets)` : ''}`).join(' + ') : 'None set'}
                </div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>Recommended joiners</div>
                <div style={{ fontSize:13, color:C.icy, fontWeight:600 }}>
                  {joinerHeroes.length > 0 ? joinerHeroes.join(', ') : 'None set'}
                </div>
                {team.notes && <div style={{ fontSize:12, color:C.muted, marginTop:8, fontStyle:'italic' }}>{team.notes}</div>}
              </button>
            );
          })}
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Tap to apply — based on {leaderPlayer.username || leaderPlayer.alias}'s saved rally setup. You can still change anything after.</div>
        </div>
      )}

      {/* Which generation? — only asked when Settings has more than
          one selected; otherwise this whole gate is skipped and the
          toggle/cards show immediately as before. */}
      {needsGenChoice && !chosenGen ? (
        <div style={{ background:C.section, borderRadius:12, padding:16 }}>
          <div style={{ fontSize:13, color:C.gold, fontWeight:700, marginBottom:10 }}>Which generation for this rally?</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {selectedGenerations.map(g => (
              <button key={g} onClick={() => setChosenGen(g)}
                style={{ padding:'12px 18px', borderRadius:12, border:`1px solid ${C.border}`, background:C.card, color:C.white, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Gen {g}
              </button>
            ))}
          </div>
        </div>
      ) : (
      <>
      {needsGenChoice && chosenGen && (
        <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
          Showing Gen {chosenGen}.{' '}
          <button onClick={() => setChosenGen(null)} style={{ background:'none', border:'none', color:C.gold, fontSize:12, cursor:'pointer', padding:0, textDecoration:'underline' }}>Change</button>
        </div>
      )}

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
              {LEADER_HERO_OPTIONS.map(hero => {
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
            <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:2 }}>
              Requested joiner heroes {(slot.requestedHeroes || []).length > 0 && <span style={{ color:C.gold, fontWeight:700 }}>· {(slot.requestedHeroes || []).length}/4</span>}
            </label>
            <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Tap a hero to add it — tap the same one again to stack it (e.g. Norah ×3).</div>

            {(slot.requestedHeroes || []).length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                {Object.entries((slot.requestedHeroes || []).reduce((acc, h) => { acc[h] = (acc[h]||0)+1; return acc; }, {})).map(([hero, count]) => (
                  <button key={hero} onClick={() => {
                    const c = [...(slot.requestedHeroes || [])];
                    c.splice(c.lastIndexOf(hero), 1);
                    upd({ requestedHeroes: c });
                  }} style={{ padding:'6px 12px', borderRadius:14, border:`1px solid ${C.gold}`, background:C.gold+'22', color:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    {hero}{count > 1 ? ` ×${count}` : ''} ✕
                  </button>
                ))}
              </div>
            )}

            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {CUSTOM_HERO_OPTIONS.map(hero => {
                const atCap = (slot.requestedHeroes || []).length >= 4;
                return (
                  <button key={hero} disabled={atCap} onClick={() => {
                    if (atCap) return;
                    upd({ requestedHeroes: [...(slot.requestedHeroes || []), hero] });
                  }} style={{ padding:'5px 10px', borderRadius:12, border:`1px solid ${C.border}`, background:C.card, color:atCap?C.muted+'66':C.muted, fontWeight:400, fontSize:12, cursor:atCap?'default':'pointer', opacity:atCap?0.5:1 }}>
                    {hero}
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
          (two if "All" is picked: one offense, one defense). Each card
          defaults to COMPACT: just the leader heroes and a single
          coverage check, so a first-time officer sees a short list of
          simple choices rather than a wall of ratios/joiners/alternates
          up front. Tapping "More info" reveals the rest without
          selecting; tapping the card itself selects it. */}
      {!isCustom && (() => {
        function toggleExpand(i) {
          setExpandedIndices(prev => {
            const next = new Set(prev);
            next.has(i) ? next.delete(i) : next.add(i);
            return next;
          });
        }

        function renderCard(f, i) {
          const isSelected = selectedFormation &&
            f.gen === selectedFormation.gen &&
            f.leaders.join() === selectedFormation.leaders.join() &&
            f.type === selectedFormation.type;
          const coverage   = getCoverage(f);
          const allCovered = coverage.every(c => c.ok);
          const fColor     = f.type.toLowerCase().includes('offense') ? '#F5A623' : '#6B8CAE';
          const isExpanded = expandedIndices.has(i);

          return (
            <div key={i} style={{ background:isSelected?fColor+'18':C.section, border:`1.5px solid ${isSelected?fColor:C.border}`, borderRadius:12, marginBottom:8, overflow:'hidden' }}>
              <div onClick={() => selectFormation(f)} style={{ padding:14, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12, color:fColor, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>
                    Gen {f.gen} · {f.type}{f.isMeta ? ' · ⚠ unverified' : ''}
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{f.leaders.join(' + ')}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                  {isSelected && <span style={{ fontSize:11, color:fColor, fontWeight:700 }}>✓ Selected</span>}
                  <span style={{ fontSize:11, color:allCovered?C.green:C.gold, fontWeight:600, whiteSpace:'nowrap' }}>
                    {allCovered ? '✓ Full coverage' : '⚠ Check coverage'}
                  </span>
                </div>
              </div>

              <button onClick={e => { e.stopPropagation(); toggleExpand(i); }}
                style={{ width:'100%', height:32, background:'none', border:'none', borderTop:`1px solid ${C.border}44`, color:C.muted, fontSize:11, cursor:'pointer' }}>
                {isExpanded ? '▲ Less info' : '▼ More info — ratio, joiners, alternates'}
              </button>

              {isExpanded && (
                <div style={{ padding:'0 14px 14px' }}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>{f.ratio}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:f.comments?6:0 }}>
                    {coverage.map((c, ci) => (
                      <div key={ci} style={{ background:C.card, borderRadius:8, padding:'6px 10px', display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:c.ok?C.green:C.red, flexShrink:0 }}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:C.white }}>{c.display}{c.needed > 1 ? ` ×${c.needed}` : ''}</div>
                          {c.alternatives?.length > 0 && <div style={{ fontSize:10, color:C.muted }}>or {c.alternatives.join('/')}</div>}
                          {c.viaAlt && <div style={{ fontSize:10, color:C.gold }}>✓ via alternate: {c.viaAlt}</div>}
                        </div>
                        <div style={{ fontSize:11, color:c.ok?C.green:C.red, fontWeight:700 }}>{c.count}/{c.needed}</div>
                      </div>
                    ))}
                  </div>
                  {[f.alt1, f.alt2, f.alt3].filter(Boolean).length > 0 && (
                    <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>Alt: {[f.alt1, f.alt2, f.alt3].filter(Boolean).join(' · ')}</div>
                  )}
                  {f.comments && <div style={{ fontSize:11, color:C.gold, marginTop:4, fontStyle:'italic' }}>⚠ {f.comments}</div>}
                </div>
              )}
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
                {gensToShow.every(g => g > FORMATION_GEN_CUTOFF)
                  ? `No guided formations exist yet for Gen ${gensToShow.join(', ')} — this isn't a bug, community formation data currently only covers Gen 1–${FORMATION_GEN_CUTOFF}. Use 🔬 Custom mode above.`
                  : `No ${slot.formationFilter || ''} formation found for the selected generation${gensToShow.length !== 1 ? 's' : ''}.`}
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
      </>
      )}
    </div>
  );
}
