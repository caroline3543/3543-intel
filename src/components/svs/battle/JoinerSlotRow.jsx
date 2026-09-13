import { useState } from 'react';
import { C } from '../../../utils/constants.js';
import { meetsTroopReqs, playerCanFillSlot, resolveHero, CUSTOM_HERO_OPTIONS } from './battleConstants.js';
import { calcMetrics, isMvpJoiner } from '../../../data/metrics.js';

// ── JoinerSlotRow ──────────────────────────────────────────────
// One priority-joiner row inside a rally slot.
//
// HERO-FIRST flow: the required hero is fixed first (either preset by
// FormationPicker's auto-fill, or picked here manually), and only
// members who can actually fulfill that hero are ever shown —
// eligible = owns the hero at Skill 5, meets the rally's troop-tier
// minimums, and isn't already assigned elsewhere in this plan (the
// Rally Leader is excluded upstream in RallySlotCard, which never
// includes them in the `players` array passed down here at all).
//
// NOTE — the `players` array arrives already attendance-filtered:
// RallySlotCard gates it on `linkedEvent` via `isAttending()` before
// this component ever sees it, so nothing here re-checks whether
// someone is coming to the event at all. (An earlier version of this
// comment said Battle Plans weren't linked to a specific Event —
// that's no longer true, `plan.eventId`/`linkedEvent` exist now;
// corrected here.)
//
// Ranking beyond raw eligibility, most-preferred first:
//   1. Timing tier, from this player's RSVP on `linkedEvent` —
//      full-window/no flags, then partial-window (willBeLate OR
//      willLeaveEarly), then `intermittent` ("pops in randomly")
//      LAST — deliberately checked before MVP/reliability below it,
//      so an unpredictable joiner never outranks a dependable one for
//      a specific priority slot, no matter how good their event-wide
//      numbers are. Nobody is ever removed from the list for this,
//      only sorted down and labelled — same non-exclusionary approach
//      reliabilityScore already used.
//   2. MVP Joiner status (ever joined Discord voice — see metrics.js)
//   3. `reliabilityScore` (real historical attendance rate)
//   4. Name
//
// Props:
//   slot            – joiner slot object { heroName, playerId, ... }
//   index           – 0-based position
//   players         – roster array, already leader- and attendance-
//                     filtered upstream
//   events          – full events array (for reliability/MVP ranking)
//   linkedEvent     – the Event this plan is linked to — its
//                     snapshots carry each attendee's RSVP timing
//                     (willBeLate / willLeaveEarly / intermittent)
//   onUpdate        – (updatedSlot) => void
//   allAssignedIds  – Set of playerIds already assigned elsewhere in this plan
//   troopReqs       – { infantry, lancer, marksman } minimum FC strings
export function JoinerSlotRow({ slot, index, players, events = [], linkedEvent = null, onUpdate, allAssignedIds, troopReqs = {} }) {
  const [open, setOpen]             = useState(false);
  const [pickingHero, setPickingHero] = useState(false);

  const isComplete = !!(slot.playerName && slot.heroName);
  const isUnavail  = slot.confirmed === false && slot.playerId;
  const hasReqs     = Object.values(troopReqs || {}).some(Boolean);

  // Six distinct RSVP timing states, ranked worst-to-best as tiers
  // 0 (best) through 5 (worst) — kept separate rather than lumped
  // together since "arriving late" and "leaving early" mean opposite
  // things for which rallies someone actually fits:
  //   0 = confirmed full-window (presentWholeTime) or no flags set
  //   1 = willLeaveEarly only — present for the early part of the event
  //   2 = willBeLate only — present for the later part of the event
  //   3 = both late AND leaving early — narrow window either way
  //   4 = unsure — hasn't committed either way
  //   5 = intermittent ("pops in randomly") — always last, overriding
  //       MVP/reliability below it, see header note
  // NOTE: this default ordering (leaving-early ranked above arriving-
  // late) assumes a plan for the START of the event, where an early
  // leaver is still around for most rallies but a late arrival isn't.
  // That assumption inverts for a plan covering the MIDDLE of a
  // 5-hour event — flagged as an open question, not yet built.
  function timingTier(p) {
    const rsvp = linkedEvent?.snapshots?.find(s => s.playerId === p.id)?.rsvp;
    if (!rsvp) return 0;
    if (rsvp.intermittent) return 5;
    if (rsvp.unsure) return 4;
    if (rsvp.willBeLate && rsvp.willLeaveEarly) return 3;
    if (rsvp.willBeLate) return 2;
    if (rsvp.willLeaveEarly) return 1;
    return 0;
  }

  function timingLabel(tier) {
    switch (tier) {
      case 5: return { text:'🎲 intermittent',          color:C.muted };
      case 4: return { text:'❓ unsure',                 color:C.muted };
      case 3: return { text:'⏰ late + leaves early',    color:C.gold  };
      case 2: return { text:'⏰ arriving late',          color:C.gold  };
      case 1: return { text:'🚪 leaving early',          color:C.gold  };
      default: return null;
    }
  }

  // Eligible members for a given required hero — hard-filtered, then
  // ranked by: timing tier first (see timingTier above), then MVP
  // Joiner status (ever joined Discord voice — see metrics.js), then
  // historical reliability, then name.
  function eligibleFor(hero) {
    return players
      .filter(p => !allAssignedIds.has(p.id) || p.id === slot.playerId)
      .filter(p => playerCanFillSlot(p, hero))
      .filter(p => !hasReqs || meetsTroopReqs(p, troopReqs).ok)
      .sort((a, b) => {
        const tA = timingTier(a), tB = timingTier(b);
        if (tA !== tB) return tA - tB;
        const mvpA = isMvpJoiner(a, events), mvpB = isMvpJoiner(b, events);
        if (mvpA !== mvpB) return mvpA ? -1 : 1;
        const ra = calcMetrics(a, events)?.reliabilityScore || 0;
        const rb = calcMetrics(b, events)?.reliabilityScore || 0;
        if (rb !== ra) return rb - ra;
        return (a.username || a.alias || '').localeCompare(b.username || b.alias || '');
      });
  }

  const eligible = slot.heroName ? eligibleFor(slot.heroName) : [];

  // Alternate heroes accepted for whatever's currently required — e.g.
  // "Jessie" also accepts Jasser/Jeronimo per the community spreadsheet
  // substitution notes. Surfaced as quick-tap swaps rather than making
  // the officer hunt through the full hero list for a known substitute,
  // even when the current hero came from a Gen-suggested formation.
  const currentAlternatives = slot.heroName ? (resolveHero(slot.heroName)?.alternatives || []) : [];

  function setHero(hero) {
    // Changing the required hero can invalidate whoever was previously
    // assigned (they may not own the new hero) — clear the member so
    // the eligible list is re-derived cleanly for the new requirement.
    onUpdate({ ...slot, heroName: hero, playerId: null, playerName: '', confirmed: true, replacedBy: null });
    setPickingHero(false);
  }

  function assignMember(p) {
    onUpdate({ ...slot, playerId: p.id, playerName: p.username || p.alias || '', confirmed: true, replacedBy: null });
  }

  function clearMember() {
    onUpdate({ ...slot, playerId: null, playerName: '', confirmed: true, replacedBy: null });
  }

  // Replacement suggestions when marked unavailable mid-battle — same
  // eligibility rules as the main picker, just excluding whoever's
  // currently (unavailable) assigned.
  const suggestions = isUnavail && slot.heroName
    ? eligibleFor(slot.heroName).filter(p => p.id !== slot.playerId).slice(0, 3)
    : [];

  return (
    <div style={{ background: C.bg, borderRadius: 10, marginBottom: 6, border: `1px solid ${isComplete ? C.green + '33' : C.border + '44'}` }}>
      {/* Row header — required hero first, then who's fulfilling it */}
      <div onClick={() => setOpen(!open)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', cursor:'pointer' }}>
        <div style={{ width:22, height:22, borderRadius:'50%', background: isComplete ? C.green+'33' : C.border, border: `1.5px solid ${isComplete ? C.green : C.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color: isComplete ? C.green : C.muted, flexShrink:0 }}>
          {isComplete ? '✓' : index + 1}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          {slot.heroName ? (
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <span style={{ fontSize:14, fontWeight:700, color:C.gold }}>{slot.heroName}</span>
              <span style={{ fontSize:13, color:C.muted }}>→</span>
              {slot.playerName ? (
                <>
                  <span style={{ fontSize:14, fontWeight:700, color: isUnavail ? C.muted : C.white, textDecoration: isUnavail ? 'line-through' : 'none' }}>
                    {slot.replacedBy ? slot.replacedBy.playerName : slot.playerName}
                  </span>
                  <span style={{ fontSize:13, color:C.green }}>✓</span>
                  {isUnavail && <span style={{ fontSize:11, color:C.red, fontWeight:600 }}>Unavailable</span>}
                  {slot.replacedBy && <span style={{ fontSize:11, color:C.green }}>← sub</span>}
                </>
              ) : (
                <span style={{ fontSize:13, color:C.muted }}>Select member</span>
              )}
            </div>
          ) : (
            <span style={{ fontSize:14, color:C.muted }}>Priority joiner {index + 1} — set required hero</span>
          )}
        </div>
        <span style={{ color:C.muted, fontSize:13 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding:'0 12px 12px' }}>

          {/* Required hero */}
          <div style={{ marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em' }}>Required hero</label>
              {slot.heroName && (
                <button onClick={() => setPickingHero(!pickingHero)} style={{ background:'none', border:'none', color:C.gold, fontSize:11, fontWeight:600, cursor:'pointer', padding:0 }}>
                  {pickingHero ? 'Cancel' : 'Change'}
                </button>
              )}
            </div>
            {(!slot.heroName || pickingHero) && (
              <div>
                {pickingHero && currentAlternatives.length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, color:C.gold, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>
                      Alternates for {slot.heroName}
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {currentAlternatives.map(alt => (
                        <button key={alt} onClick={() => setHero(alt)}
                          style={{ padding:'6px 12px', borderRadius:14, border:`1px solid ${C.gold}`, background:C.gold+'18', color:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                          ⇄ {alt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {CUSTOM_HERO_OPTIONS.map(hero => (
                    <button key={hero} onClick={() => setHero(hero)}
                      style={{ padding:'6px 12px', borderRadius:14, border:`1px solid ${slot.heroName===hero?C.gold:C.border}`, background:slot.heroName===hero?C.gold+'22':C.section, color:slot.heroName===hero?C.gold:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                      {hero}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Eligible member list — only once a hero requirement exists */}
          {slot.heroName && !pickingHero && (
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>
                Eligible attendees
                <span style={{ fontSize:10, color:C.muted, fontWeight:400, marginLeft:8 }}>{eligible.length} eligible</span>
              </label>

              {eligible.length === 0 ? (
                <div style={{ background:C.red+'0a', border:`1px solid ${C.red}33`, borderRadius:8, padding:12 }}>
                  <div style={{ fontSize:13, color:C.red, fontWeight:700, marginBottom:6 }}>⚠ No eligible attendees</div>
                  <div style={{ fontSize:12, color:C.muted }}>Required hero: <span style={{ color:C.white }}>{slot.heroName}</span></div>
                  {hasReqs && <div style={{ fontSize:12, color:C.muted }}>Minimum troop tier requirements apply</div>}
                  <div style={{ fontSize:12, color:C.muted }}>Eligible attendees: 0</div>
                </div>
              ) : (
                  <div style={{ maxHeight:160, overflowY:'auto', display:'flex', flexWrap:'wrap', gap:6 }}>
                  {eligible.map(p => {
                    const sel = slot.playerId === p.id;
                    const mvp = isMvpJoiner(p, events);
                    const tier = timingTier(p);
                    const tag  = timingLabel(tier);
                    return (
                      <button key={p.id} onClick={() => assignMember(p)}
                        style={{ padding:'6px 12px', borderRadius:14, border:`1px solid ${sel?C.gold:mvp?C.green+'88':C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.icy, fontWeight:600, fontSize:13, cursor:'pointer', opacity: tier===5 ? 0.65 : 1 }}>
                        {sel ? '✓ ' : ''}{mvp && <span style={{ color:C.green }}>🎙️MVP </span>}{p.username || p.alias}{p.furnaceLevel ? ` · ${p.furnaceLevel}` : ''}
                        {tag && <span style={{ color:tag.color, marginLeft:5, fontWeight:400 }}>{tag.text}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Mark unavailable + clear */}
          {slot.playerId && (
            <div style={{ display:'flex', gap:8, marginBottom: suggestions.length > 0 ? 10 : 0 }}>
              <button onClick={() => onUpdate({ ...slot, confirmed: slot.confirmed === false ? true : false })}
                style={{ flex:1, height:36, borderRadius:8, border:`1px solid ${slot.confirmed===false?C.green:C.red}44`, background:slot.confirmed===false?C.green+'18':C.red+'18', color:slot.confirmed===false?C.green:C.red, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                {slot.confirmed === false ? '✓ Mark available' : '⚠ Mark unavailable'}
              </button>
              <button onClick={clearMember}
                style={{ height:36, padding:'0 12px', borderRadius:8, border:`1px solid ${C.border}`, background:'none', color:C.muted, fontSize:12, cursor:'pointer' }}>
                Clear
              </button>
            </div>
          )}

          {/* Replacement suggestions */}
          {suggestions.length > 0 && (
            <div style={{ background:C.green+'0a', borderRadius:8, padding:10 }}>
              <div style={{ fontSize:11, color:C.green, fontWeight:700, marginBottom:6 }}>Suggested replacements (have {slot.heroName}):</div>
              {suggestions.map(p => (
                <button key={p.id} onClick={() => onUpdate({ ...slot, replacedBy:{ playerId:p.id, playerName:p.username||p.alias, heroName:slot.heroName } })}
                  style={{ display:'block', width:'100%', padding:'7px 10px', marginBottom:4, borderRadius:8, border:`1px solid ${C.green}44`, background:C.green+'18', color:C.green, fontWeight:600, fontSize:13, cursor:'pointer', textAlign:'left' }}>
                  ＋ {p.username||p.alias} → {slot.heroName}{p.furnaceLevel ? ` · ${p.furnaceLevel}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
