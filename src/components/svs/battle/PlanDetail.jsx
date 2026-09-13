import { useState } from 'react';
import { C, EVENT_ICONS, JOINER_COVERAGE_EVENTS } from '../../../utils/constants.js';
import { vibe } from '../../../utils/vibe.js';
import { newRallySlot } from '../../../data/playerSchema.js';
import { RALLY_ICONS, isAttending, playerCanFillSlot, meetsTroopReqs, suggestJoinerHeroes, timingTier, bestTroopTierIndex } from './battleConstants.js';
import { getCurrentTroopPower, calcMetrics, isMvpJoiner } from '../../../data/metrics.js';
import { RallySlotCard } from './RallySlotCard.jsx';
import { ChecklistManagerSheet } from './ChecklistManagerSheet.jsx';

// ── PlanDetail ─────────────────────────────────────────────────
// The open-plan view: header, all rally slots, Go Live sticky bar.
// Props:
//   plan          – the active SvsPlan object
//   players       – full roster array
//   events        – full events array (needed for auto-suggest scoring,
//                   and to pick which one this plan links to)
//   onUpdate      – (updatedPlan) => void
//   onBack        – () => void
//   onGoLive      – (plan) => void
//   onGoToMembers – () => void
//   selectedGenerations – number[] from Settings — explicit list, NOT
//                         cumulative; empty array means "no filter,
//                         show everything" (see SettingsPanel.jsx)
//   checklist       – alliance-wide Leadership Checklist item defs
//   onSaveChecklist – (items[]) => void — replaces the whole item list
export function PlanDetail({ plan, plans = [], players, events = [], onUpdate, onBack, onGoLive, onGoToMembers, selectedGenerations = [], checklist = [], onSaveChecklist }) {
  const [eventPickerOpen, setEventPickerOpen]         = useState(false);
  const [checklistManagerOpen, setChecklistManagerOpen] = useState(false);
  const [summaryText, setSummaryText] = useState(null); // lazily generated, hand-editable
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [checklistCopied, setChecklistCopied] = useState(false);
  const [confirmAutoFill, setConfirmAutoFill] = useState(false);
  const [autoFillResult, setAutoFillResult]   = useState(null); // { leadersFilled, heroesSet, joinersFilled } or null
  const [turretCount, setTurretCount] = useState(0);
  const [castleCount, setCastleCount] = useState(0);

  function updPlan(patch) { onUpdate({ ...plan, ...patch }); }

  function addSlot() {
    const type = (plan.rallySlots || []).length === 0 ? 'Main Rally' : 'Counter Rally';
    updPlan({ rallySlots:[...(plan.rallySlots || []), newRallySlot({ type })] });
    vibe(8);
  }

  function updSlot(updated) {
    updPlan({ rallySlots:(plan.rallySlots || []).map(s => s.id === updated.id ? updated : s) });
  }
  function delSlot(id) {
    updPlan({ rallySlots:(plan.rallySlots || []).filter(s => s.id !== id) });
  }
  function moveSlot(index, direction) {
    const slots  = [...(plan.rallySlots || [])];
    const target = index + direction;
    if (target < 0 || target >= slots.length) return;
    [slots[index], slots[target]] = [slots[target], slots[index]];
    updPlan({ rallySlots:slots });
  }

  const slots      = plan.rallySlots || [];
  const readySlots = slots.filter(s => s.leaderName);
  const linkedEvent = events.find(e => e.id === plan.eventId) || null;

  // ── Plan-wide priority-joiner exclusivity ─────────────────────
  // A priority joiner should only be usable in ONE rally slot across
  // the whole battle plan/event, not just unique within one slot's own
  // 4 joiners — AND not just within this one plan. If a second,
  // separate Battle Plan is linked to the SAME event (e.g. a main
  // assault plan and a garrison plan for the same SvS), someone
  // already committed there can't be double-booked here either, or
  // coverage counts would silently be wrong. Sibling plans are any
  // OTHER plan sharing this plan's eventId.
  const siblingPlans = plan.eventId ? plans.filter(p => p.id !== plan.id && p.eventId === plan.eventId) : [];

  function assignedInOtherSlots(currentSlotId) {
    const ids = new Set();
    slots.forEach(s => {
      if (s.id === currentSlotId) return;
      (s.joiners || []).forEach(j => { if (j.playerId) ids.add(j.playerId); });
      if (s.leaderId) ids.add(s.leaderId); // leading elsewhere rules out joining here
    });
    siblingPlans.forEach(sp => {
      (sp.rallySlots || []).forEach(s => {
        (s.joiners || []).forEach(j => { if (j.playerId) ids.add(j.playerId); });
        if (s.leaderId) ids.add(s.leaderId);
      });
    });
    return ids;
  }

  // Everyone leading ANY rally, in this plan or a sibling plan for the
  // same event — a rally leader is already spoken for and should never
  // show up as an "available backup" joiner candidate, even if they
  // aren't currently assigned as anyone's joiner.
  const allLeaderIds = new Set();
  slots.forEach(s => { if (s.leaderId) allLeaderIds.add(s.leaderId); });
  siblingPlans.forEach(sp => (sp.rallySlots || []).forEach(s => { if (s.leaderId) allLeaderIds.add(s.leaderId); }));

  // ── Auto-Fill (by Power) ────────────────────────────────────────
  // Fills BLANKS only — an existing leader or joiner someone picked by
  // hand is never overwritten. Two passes, in this order, because the
  // second depends on the first:
  //   1. LEADERS — every blank slot gets the strongest eligible
  //      attendee (troop power). "Eligible" now also requires
  //      timingTier ≤ 1 for that slot's own planPhase — constantly
  //      present, or safely there for whichever half of the event
  //      this rally is planned for (see battleConstants.js's
  //      timingTier). Rally-Lead-tagged members are preferred among
  //      eligible candidates.
  //   2. JOINERS — required heroes are derived from the meta table
  //      (same lookup FormationPicker uses) same as before, but this
  //      now ALSO picks the actual PERSON for each hero slot — a
  //      reversal of the prior "hero only, officer picks the person"
  //      design, done because Caroline asked for it directly. Slots
  //      are processed strongest-leader-first, so the strongest
  //      leaders get first pick of the best available troop-tier
  //      joiners (bestTroopTierIndex — FC_ORDER-based, distinct from
  //      the power number used to rank leaders). Same timingTier ≤ 1
  //      restriction applies to joiners as to leaders.
  // Accepts an optional slotsToFill override so the "Create Rally
  // Slots" wizard below can create new slots and auto-fill them in
  // the same pass, before `slots` (derived from the plan prop) has
  // re-rendered with them.
  // Runs as one batch over a single snapshot of attendance/roster
  // data, so results are deterministic rather than reading updated
  // state mid-loop.
  function autoFillPlan(slotsToFill) {
    if (!linkedEvent) return;
    const baseSlots = slotsToFill || slots;
    const attendingPool = players.filter(p => isAttending(p.id, linkedEvent) && !p.blacklisted);

    // Seed with everyone already committed anywhere — this plan's
    // existing manual picks, plus sibling plans on the same event —
    // so auto-fill never double-books someone the officer already
    // placed by hand.
    const usedIds = new Set();
    baseSlots.forEach(s => {
      if (s.leaderId) usedIds.add(s.leaderId);
      (s.joiners || []).forEach(j => { if (j.playerId) usedIds.add(j.playerId); });
    });
    siblingPlans.forEach(sp => (sp.rallySlots || []).forEach(s => {
      if (s.leaderId) usedIds.add(s.leaderId);
      (s.joiners || []).forEach(j => { if (j.playerId) usedIds.add(j.playerId); });
    }));

    let leadersFilled = 0, heroesSet = 0, joinersFilled = 0;
    const working = baseSlots.map(slot => ({ ...slot, joiners: slot.joiners.map(j => ({ ...j })) }));

    // ── Pass 1: leaders ──────────────────────────────────────────
    working.forEach(slot => {
      if (slot.leaderId) return;
      const pool = attendingPool
        .filter(p => !usedIds.has(p.id))
        .filter(p => !slot.allianceTag || p.allianceTag === slot.allianceTag)
        .filter(p => timingTier(p, linkedEvent, slot.planPhase) <= 1)
        .sort((a, b) => (getCurrentTroopPower(b, events) || 0) - (getCurrentTroopPower(a, events) || 0));
      const candidate = pool.find(p => p.roles?.includes('Rally Lead')) || pool[0] || null;
      if (candidate) {
        slot.leaderId   = candidate.id;
        slot.leaderName = candidate.username || candidate.alias;
        usedIds.add(candidate.id);
        leadersFilled++;
      }
    });

    // ── Pass 2: required heroes, then joiners — strongest-leader
    // slots first so they get first pick of the best troop-tier
    // eligible joiners.
    const byLeaderPowerDesc = [...working].sort((a, b) => {
      const pa = a.leaderId ? (getCurrentTroopPower(players.find(p => p.id === a.leaderId), events) || 0) : -1;
      const pb = b.leaderId ? (getCurrentTroopPower(players.find(p => p.id === b.leaderId), events) || 0) : -1;
      return pb - pa;
    });

    byLeaderPowerDesc.forEach(slot => {
      const leaderPlayer = slot.leaderId ? players.find(p => p.id === slot.leaderId) : null;

      const hasAnyHero = slot.joiners.some(j => j.heroName);
      if (!hasAnyHero && leaderPlayer) {
        const suggestion = suggestJoinerHeroes(leaderPlayer, slot.type, slot.leaderRallyHeroes);
        if (suggestion?.suggestedHeroes?.length) {
          suggestion.suggestedHeroes.slice(0, 4).forEach((hero, i) => {
            if (slot.joiners[i] && !slot.joiners[i].heroName) {
              slot.joiners[i].heroName = hero;
              heroesSet++;
            }
          });
        }
      }

      const hasReqs = Object.values(slot.troopReqs || {}).some(Boolean);
      slot.joiners.forEach(j => {
        if (!j.heroName || j.playerId) return; // no hero required, or already hand-picked
        const candidate = attendingPool
          .filter(p => !usedIds.has(p.id) && p.id !== slot.leaderId)
          .filter(p => !slot.allianceTag || p.allianceTag === slot.allianceTag)
          .filter(p => playerCanFillSlot(p, j.heroName))
          .filter(p => !hasReqs || meetsTroopReqs(p, slot.troopReqs).ok)
          .filter(p => timingTier(p, linkedEvent, slot.planPhase) <= 1)
          .sort((a, b) => {
            const ta = bestTroopTierIndex(a), tb = bestTroopTierIndex(b);
            if (tb !== ta) return tb - ta;
            const mvpA = isMvpJoiner(a, events), mvpB = isMvpJoiner(b, events);
            if (mvpA !== mvpB) return mvpA ? -1 : 1;
            const ra = calcMetrics(a, events)?.reliabilityScore || 0;
            const rb = calcMetrics(b, events)?.reliabilityScore || 0;
            return rb - ra;
          })[0];
        if (candidate) {
          j.playerId   = candidate.id;
          j.playerName = candidate.username || candidate.alias || '';
          j.confirmed  = true;
          usedIds.add(candidate.id);
          joinersFilled++;
        }
      });
    });

    updPlan({ rallySlots: working });
    setAutoFillResult({ leadersFilled, heroesSet, joinersFilled });
    setConfirmAutoFill(false);
    vibe(8);
  }

  // ── Create Rally Slots wizard ────────────────────────────────────
  // "How many rally leaders do you want, and for what (turret/
  // castle)?" — creates that many blank slots with the target set,
  // then immediately runs autoFillPlan on the combined (existing +
  // new) slot list so leaders/heroes/joiners for the NEW slots come
  // pre-filled. Passes the combined array explicitly rather than
  // relying on `slots` (derived from the plan prop), which won't
  // reflect the new slots until after this render.
  function createAndAutoFillLeaders() {
    if (!linkedEvent || turretCount + castleCount === 0) return;
    const created = [];
    for (let i = 0; i < turretCount; i++) {
      created.push(newRallySlot({ type: (slots.length === 0 && created.length === 0) ? 'Main Rally' : 'Counter Rally', target: 'turret' }));
    }
    for (let i = 0; i < castleCount; i++) {
      created.push(newRallySlot({ type: (slots.length === 0 && created.length === 0) ? 'Main Rally' : 'Counter Rally', target: 'castle' }));
    }
    autoFillPlan([...slots, ...created]);
    setTurretCount(0);
    setCastleCount(0);
  }

  // ── Auto-flagged action items ──────────────────────────────────
  // Computed fresh from the plan's current state every render — not
  // manually toggled like the custom checklist items below. Two kinds:
  //  - "ask": a rally's leader-rally-heroes includes a hero that isn't
  //    recorded in that leader's saved Rally Leader Profile teams —
  //    the officer picked/changed something the leader hasn't
  //    confirmed, so it needs a real check-in before relying on it.
  //  - "coverage": a priority joiner hero has zero eligible attendees.
  // Grouped ONE LINE PER RALLY, not one line per hero — three unset
  // heroes for the same leader used to produce three separate "Ask
  // Chaz..." lines; now it's one line naming all three. unfillableCount
  // (the plan-wide banner) still counts individual heroes underneath,
  // just the checklist TEXT is what's grouped for readability.
  const askIssues = [];
  const coverageIssues = [];
  slots.forEach(slot => {
    if (slot.leaderId && slot.leaderName) {
      const leaderPlayer = players.find(p => p.id === slot.leaderId);
      const savedHeroes = new Set();
      (leaderPlayer?.leaderProfile?.teams || []).forEach(t => (t.leadHeroes || []).forEach(h => h && savedHeroes.add(h)));
      (slot.leaderRallyHeroes || []).forEach(h => {
        if (h && !savedHeroes.has(h)) askIssues.push({ slotId: slot.id, leaderName: slot.leaderName, hero: h });
      });
    }
    if (linkedEvent) {
      const hasReqs = Object.values(slot.troopReqs || {}).some(Boolean);
      const pool = players
        .filter(p => p.id !== slot.leaderId)
        .filter(p => isAttending(p.id, linkedEvent))
        .filter(p => !slot.allianceTag || p.allianceTag === slot.allianceTag);
      (slot.joiners || []).forEach(j => {
        if (!j.heroName) return;
        const eligible = pool.filter(p => playerCanFillSlot(p, j.heroName) && (!hasReqs || meetsTroopReqs(p, slot.troopReqs).ok));
        if (eligible.length === 0) coverageIssues.push({ slotId: slot.id, leaderName: slot.leaderName || 'this', hero: j.heroName });
      });
    }
  });

  function groupFlags(issues, type, buildText) {
    const bySlot = new Map();
    issues.forEach(i => {
      if (!bySlot.has(i.slotId)) bySlot.set(i.slotId, { leaderName: i.leaderName, heroes: [] });
      bySlot.get(i.slotId).heroes.push(i.hero);
    });
    return Array.from(bySlot.entries()).map(([slotId, g]) => ({
      id: `${slotId}-${type}`,
      type,
      text: buildText(g.leaderName, g.heroes),
    }));
  }

  const autoFlags = [
    ...groupFlags(askIssues, 'ask', (leader, heroes) => `Ask ${leader} if they have ${heroes.join(', ')} — not in their saved setup`),
    ...groupFlags(coverageIssues, 'coverage', (leader, heroes) => `${heroes.join(', ')} needed for ${leader}'s rally — no one eligible yet`),
  ];
  const unfillableCount = coverageIssues.length;

  // ── Unallocated backups ────────────────────────────────────────
  // Attending roster members not currently used as a priority joiner
  // AND not leading any rally — quick reference for who can sub in if
  // someone drops offline mid-event. Split into who's actually
  // eligible to fill a hero-based joiner slot (has at least one
  // Skill-5 joiner hero recorded) vs. who currently isn't.
  const allAssignedPlanWide = new Set();
  slots.forEach(s => (s.joiners || []).forEach(j => { if (j.playerId) allAssignedPlanWide.add(j.playerId); }));
  siblingPlans.forEach(sp => (sp.rallySlots || []).forEach(s => (s.joiners || []).forEach(j => { if (j.playerId) allAssignedPlanWide.add(j.playerId); })));
  const unallocated = players.filter(p =>
    !allAssignedPlanWide.has(p.id) && !allLeaderIds.has(p.id) && (!linkedEvent || isAttending(p.id, linkedEvent))
  );
  const hasJoinerHero = p => (p.joinerHeroes || []).some(jh => jh.skillLevel >= 5);
  const unallocatedEligible   = unallocated.filter(hasJoinerHero);
  const unallocatedIneligible = unallocated.filter(p => !hasJoinerHero(p));

  const linkableEvents = events.filter(e => e.status !== 'completed');

  // ── Plan-wide copy summary — one block for every rally, replacing
  // the old per-rally-slot copy button entirely.
  function generateSummary() {
    const lines = [`📋 ${plan.name || 'Battle Plan'} — ${plan.date}`, ''];
    lines.push("Priority joiners must join FIRST, before anyone else. If a priority joiner is pulled from a rally, whoever joins in their place must match that slot's ratio and hero before joining.");
    lines.push('');
    slots.forEach(slot => {
      if (!slot.leaderName) return;
      lines.push(`${RALLY_ICONS[slot.type] || '⚔️'} ${slot.type} — ${slot.leaderName}`);
      if (slot.ratio) lines.push(`Ratio: ${slot.ratio}`);
      if ((slot.leaderRallyHeroes || []).length) lines.push(`Lead heroes: ${slot.leaderRallyHeroes.join(', ')}`);
      const filled = (slot.joiners || []).filter(j => j.heroName);
      if (filled.length) lines.push(`Priority joiners: ${filled.map(j => `${j.heroName} → ${j.playerName || '?'}`).join(', ')}`);
      lines.push('');
    });
    return lines.join('\n').trim();
  }
  function regenerateSummary() { setSummaryText(generateSummary()); }
  function copySummary() {
    const text = summaryText ?? generateSummary();
    navigator.clipboard.writeText(text).then(() => { setSummaryCopied(true); setTimeout(() => setSummaryCopied(false), 2000); });
  }

  // ── Leadership Checklist as plain text — pastes directly into the
  // game (no code fence). Matches the plain-text convention used by
  // generateSummary() above; the earlier fenced version broke pasting
  // into the game, which is this text's actual destination.
  function generateChecklistText() {
    const lines = [`📋 ${plan.name || 'Battle Plan'} — Leadership Checklist`, ''];
    if (autoFlags.length > 0) {
      lines.push('NEEDS ATTENTION');
      autoFlags.forEach(f => lines.push(`${f.type === 'coverage' ? '⚠' : '❓'} ${f.text}`));
      lines.push('');
    }
    if (checklist.length > 0) {
      lines.push('CHECKLIST');
      checklist.forEach(item => lines.push(`${(plan.checklist || {})[item.id] ? '☑' : '☐'} ${item.name}`));
    }
    return lines.join('\n').trim();
  }
  function copyChecklist() {
    navigator.clipboard.writeText(generateChecklistText()).then(() => { setChecklistCopied(true); setTimeout(() => setChecklistCopied(false), 2000); });
  }

  return (
    <div style={{ padding:'16px 20px 0', paddingBottom:readySlots.length > 0 ? 160 : 20 }}>
      {/* Back + breadcrumb */}
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:4, padding:0 }}>
        ← Battle Plans
      </button>
      <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>{plan.name || 'Battle Plan'}</div>

      {/* Plan header */}
      <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:C.white }}>{plan.name || 'Battle Plan'}</div>
            <div style={{ fontSize:13, color:C.muted }}>{plan.date}{plan.allianceTag ? ` · [${plan.allianceTag}]` : ''}</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {[['draft','Draft',C.muted],['live','🔴 Live',C.red],['completed','✓ Done',C.green]].map(([s,l,c]) => (
              <button key={s} onClick={() => updPlan({ status:s })}
                style={{ height:36, padding:'0 12px', borderRadius:14, border:`1px solid ${plan.status===s?c:C.border}`, background:plan.status===s?c+'22':C.section, color:plan.status===s?c:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={plan.notes || ''}
          onChange={e => updPlan({ notes:e.target.value })}
          placeholder="Strategy overview — target, objective, key timings…"
          style={{ width:'100%', minHeight:60, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}
        />
      </div>

      {/* Linked event — required before leader/joiner planning unlocks */}
      <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Linked event</div>
        {linkedEvent ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{EVENT_ICONS[linkedEvent.type] || '📋'} {linkedEvent.name || linkedEvent.type}</div>
              <div style={{ fontSize:12, color:C.muted }}>{linkedEvent.date}</div>
            </div>
            <button onClick={() => setEventPickerOpen(!eventPickerOpen)}
              style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:16, padding:'6px 14px', color:C.gold, fontWeight:600, fontSize:12, cursor:'pointer' }}>
              {eventPickerOpen ? 'Cancel' : 'Change'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:13, color:C.red, fontWeight:600, marginBottom:10 }}>⚠ No event linked — leader and joiner planning is locked until you link one.</div>
            <button onClick={() => setEventPickerOpen(!eventPickerOpen)}
              style={{ width:'100%', height:44, borderRadius:10, background:C.gold+'18', border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
              🔗 Link an event
            </button>
          </div>
        )}
        {eventPickerOpen && (
          <div style={{ marginTop:10, maxHeight:220, overflowY:'auto' }}>
            {linkableEvents.length === 0 ? (
              <div style={{ fontSize:12, color:C.muted, textAlign:'center', padding:'10px 0' }}>No upcoming or active events yet. Create one in the Events tab first.</div>
            ) : (
              linkableEvents.map(ev => (
                <button key={ev.id} onClick={() => { updPlan({ eventId:ev.id }); setEventPickerOpen(false); }}
                  style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 12px', borderRadius:8, background:C.section, border:`1px solid ${plan.eventId===ev.id?C.gold:C.border}`, color:C.white, fontSize:13, marginBottom:6, cursor:'pointer' }}>
                  {EVENT_ICONS[ev.type] || '📋'} {ev.name || ev.type} · {ev.date}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Create Rally Slots — "how many rally leaders, and for what?"
          Creates the slots and immediately auto-fills them (leaders,
          heroes, joiners) via autoFillPlan. Target (turret/castle) only
          means anything for SvS/Castle Battle-type events, same gate
          RallySlotCard uses for the per-slot target field. */}
      {linkedEvent && JOINER_COVERAGE_EVENTS.includes(linkedEvent.type) && (
        <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:4 }}>➕ Create Rally Slots</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
            How many rally leaders do you need, and for what? Creates the slots and auto-fills them immediately.
          </div>
          <div style={{ display:'flex', gap:12, marginBottom:12 }}>
            {[['🗼 Turret', turretCount, setTurretCount], ['🏰 Castle', castleCount, setCastleCount]].map(([label, val, setVal]) => (
              <div key={label} style={{ flex:1, background:C.section, borderRadius:10, padding:10, textAlign:'center' }}>
                <div style={{ fontSize:12, color:C.icy, fontWeight:600, marginBottom:6 }}>{label}</div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                  <button onClick={() => setVal(Math.max(0, val - 1))}
                    style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.border}`, background:C.card, color:C.icy, fontSize:16, fontWeight:700, cursor:'pointer' }}>−</button>
                  <div style={{ fontSize:18, fontWeight:800, color:C.white, minWidth:20 }}>{val}</div>
                  <button onClick={() => setVal(val + 1)}
                    style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.border}`, background:C.card, color:C.icy, fontSize:16, fontWeight:700, cursor:'pointer' }}>+</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={createAndAutoFillLeaders} disabled={turretCount + castleCount === 0}
            style={{ width:'100%', height:48, borderRadius:12, background:(turretCount+castleCount)>0?C.gold:C.section, border:(turretCount+castleCount)>0?'none':`1px solid ${C.border}`, color:(turretCount+castleCount)>0?C.bg:C.muted, fontWeight:700, fontSize:14, cursor:(turretCount+castleCount)>0?'pointer':'default' }}>
            {turretCount + castleCount > 0 ? `＋ Create ${turretCount + castleCount} slot${turretCount+castleCount!==1?'s':''} & Auto-Fill` : 'Set a count above'}
          </button>
        </div>
      )}

      {/* Auto-Fill by Power — fills blank leader/joiner slots only.
          Works for any rally-based plan (Castle Battle is the primary
          use case) since it operates on the same rally-slot structure
          regardless of event type. */}
      {linkedEvent && slots.length > 0 && (
        <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:4 }}>⚡ Auto-Fill by Power</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
            Fills empty rally leader slots with the strongest, most reliably-present available attendees, then sets required joiner heroes and assigns the best troop-tier eligible joiner for each — strongest leaders get first pick. Existing manual picks are always left untouched.
          </div>
          <button onClick={() => confirmAutoFill ? autoFillPlan() : setConfirmAutoFill(true)}
            style={{ width:'100%', height:48, borderRadius:12, background:confirmAutoFill?C.gold:C.section, border:confirmAutoFill?'none':`1px solid ${C.border}`, color:confirmAutoFill?C.bg:C.icy, fontWeight:700, fontSize:14, cursor:'pointer' }}>
            {confirmAutoFill ? 'Tap again to fill empty slots' : '⚡ Auto-Fill Empty Slots'}
          </button>
          {autoFillResult && (
            <div style={{ fontSize:12, color:C.muted, marginTop:8, textAlign:'center' }}>
              Filled {autoFillResult.leadersFilled} leader{autoFillResult.leadersFilled!==1?'s':''}, set {autoFillResult.heroesSet} required joiner hero{autoFillResult.heroesSet!==1?'es':''}, and assigned {autoFillResult.joinersFilled} joiner{autoFillResult.joinersFilled!==1?'s':''}. Open any rally to review or swap picks.
            </div>
          )}
        </div>
      )}

      {/* Plan-wide flag — priority joiners with nobody eligible */}
      {unfillableCount > 0 && (
        <div style={{ background:C.red+'0e', border:`1px solid ${C.red}44`, borderRadius:12, padding:'12px 14px', marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.red }}>⚠ {unfillableCount} priority joiner{unfillableCount !== 1 ? 's have' : ' has'} no eligible attendee</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>See Leadership Checklist below for details.</div>
        </div>
      )}

      {/* Empty state */}
      {slots.length === 0 && (
        <div style={{ textAlign:'center', padding:'32px 20px', background:C.section, borderRadius:12, marginBottom:16 }}>
          <div style={{ fontSize:32, marginBottom:10 }}>⚔️</div>
          <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:6 }}>No rally slots yet</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Add a slot for each rally in this plan — main rally, counter, switch fight, etc.</div>
          <button onClick={addSlot} style={{ height:48, padding:'0 24px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>＋ Add first slot</button>
        </div>
      )}

      {slots.map((slot, i) => (
        <RallySlotCard
          key={slot.id}
          slot={slot}
          index={i}
          totalSlots={slots.length}
          players={players}
          events={events}
          onUpdate={updSlot}
          onDelete={delSlot}
          onMoveUp={() => moveSlot(i, -1)}
          onMoveDown={() => moveSlot(i, 1)}
          onGoToMembers={onGoToMembers}
          selectedGenerations={selectedGenerations}
          assignedInOtherSlots={assignedInOtherSlots(slot.id)}
          linkedEvent={linkedEvent}
        />
      ))}

      {slots.length > 0 && (
        <button onClick={addSlot} style={{ width:'100%', height:48, borderRadius:12, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', marginBottom:16 }}>
          ＋ Add rally slot
        </button>
      )}

      {/* Plan-wide copy summary — ALL rallies in one block, not one
          button per rally slot */}
      {readySlots.length > 0 && (
        <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:8 }}>📋 Plan Summary</div>
          <textarea
            value={summaryText ?? generateSummary()}
            onChange={e => setSummaryText(e.target.value)}
            style={{ width:'100%', minHeight:140, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13, color:C.white, resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }}
          />
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button onClick={copySummary}
              style={{ flex:2, height:44, borderRadius:10, background:summaryCopied?C.green+'18':C.gold+'18', border:`1px solid ${summaryCopied?C.green:C.gold}44`, color:summaryCopied?C.green:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {summaryCopied ? '✓ Copied' : '📋 Copy summary'}
            </button>
            <button onClick={regenerateSummary}
              style={{ flex:1, height:44, borderRadius:10, background:'none', border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
              ↺ Reset
            </button>
          </div>
        </div>
      )}

      {/* Unallocated */}
      {slots.length > 0 && (
        <div style={{ background:C.section, borderRadius:12, padding:14, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.icy, marginBottom:2 }}>🔁 Unallocated</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>{linkedEvent ? 'Attending members' : 'Members'} not leading or already used as a priority joiner in this plan.</div>
          {unallocated.length === 0 ? (
            <div style={{ fontSize:12, color:C.muted }}>Everyone available is already allocated somewhere in this plan.</div>
          ) : (
            <>
              {unallocatedEligible.length > 0 && (
                <div style={{ marginBottom: unallocatedIneligible.length > 0 ? 12 : 0 }}>
                  <div style={{ fontSize:10, color:C.green, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>✓ Eligible — has joiner heroes</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {unallocatedEligible.map(p => {
                      const heroes = (p.joinerHeroes || []).filter(jh => jh.skillLevel >= 5).map(jh => jh.hero);
                      return (
                        <div key={p.id} style={{ padding:'6px 12px', borderRadius:16, background:C.card, border:`1px solid ${C.green}44` }}>
                          <span style={{ fontSize:13, fontWeight:600, color:C.white }}>{p.username || p.alias || '?'}</span>
                          <span style={{ fontSize:11, color:C.gold, marginLeft:6 }}>{heroes.slice(0,2).join(', ')}{heroes.length > 2 ? ` +${heroes.length-2}` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {unallocatedIneligible.length > 0 && (
                <div>
                  <div style={{ fontSize:10, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>✗ Not currently eligible — no joiner heroes recorded</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {unallocatedIneligible.map(p => (
                      <div key={p.id} style={{ padding:'6px 12px', borderRadius:16, background:C.card, border:`1px solid ${C.border}`, opacity:0.7 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:C.muted }}>{p.username || p.alias || '?'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Leadership Checklist — moved to the bottom; auto-detected
          action items shown above the manual checkable list. Styled
          and copyable as a Discord-ready code block (fenced text keeps
          the ☐/☑ alignment when pasted, unlike plain chat text). */}
      <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white }}>📋 Leadership Checklist</div>
          <button onClick={() => setChecklistManagerOpen(true)} style={{ background:'none', border:'none', color:C.gold, fontSize:12, fontWeight:600, cursor:'pointer' }}>Manage</button>
        </div>

        <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:14, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
          {autoFlags.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:C.gold, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>⚠ Needs attention</div>
              {autoFlags.map(flag => (
                <div key={flag.id} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'6px 0' }}>
                  <span style={{ fontSize:13, color:flag.type==='coverage'?C.red:C.gold, flexShrink:0 }}>{flag.type==='coverage'?'⚠':'❓'}</span>
                  <span style={{ fontSize:13, color:C.icy }}>{flag.text}</span>
                </div>
              ))}
            </div>
          )}

          {checklist.length === 0 ? (
            <div style={{ fontSize:13, color:C.muted }}>No checklist items yet. Tap Manage to add some — e.g. "Rally leads briefed", "Formations locked", "Backup joiners identified".</div>
          ) : (
            checklist.map(item => {
              const checked = !!(plan.checklist || {})[item.id];
              return (
                <div key={item.id} onClick={() => updPlan({ checklist:{ ...(plan.checklist || {}), [item.id]:!checked } })}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', cursor:'pointer' }}>
                  <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${checked?C.green:C.border}`, background:checked?C.green+'33':'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {checked && <span style={{ color:C.green, fontSize:13, fontWeight:700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:14, color:checked?C.muted:C.white, textDecoration:checked?'line-through':'none' }}>{item.name}</span>
                </div>
              );
            })
          )}
        </div>

        {(autoFlags.length > 0 || checklist.length > 0) && (
          <button onClick={copyChecklist}
            style={{ width:'100%', height:44, borderRadius:10, marginTop:10, background:checklistCopied?C.green+'18':C.gold+'18', border:`1px solid ${checklistCopied?C.green:C.gold}44`, color:checklistCopied?C.green:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
            {checklistCopied ? '✓ Copied' : '📋 Copy checklist'}
          </button>
        )}
      </div>

      <ChecklistManagerSheet
        open={checklistManagerOpen}
        onClose={() => setChecklistManagerOpen(false)}
        items={checklist}
        onSaveItems={onSaveChecklist}
      />

      {/* Sticky Go Live bar — sits above the app's 60px bottom tab nav
          (see CONSTITUTION.md) rather than bottom:0, which rendered it
          partly underneath the nav and cut the button off. */}
      {readySlots.length > 0 && (
        <div style={{ position:'fixed', bottom:60, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, background:C.bg, borderTop:`1px solid ${C.border}`, padding:'12px 20px 16px', boxSizing:'border-box', zIndex:50 }}>
          <button onClick={() => onGoLive(plan)} style={{ width:'100%', height:56, borderRadius:12, background:C.red, color:'#fff', fontWeight:800, fontSize:17, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            🔴 Go Live — {readySlots.length} slot{readySlots.length !== 1 ? 's' : ''}
            <span style={{ fontSize:13, fontWeight:400, opacity:0.8 }}>
              {readySlots.map(s => s.leaderName).join(' · ')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
