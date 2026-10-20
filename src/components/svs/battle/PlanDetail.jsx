import { PlanOutputs } from './PlanOutputs.jsx';
import { PlanCreationControls } from './PlanCreationControls.jsx';
import { PlanHeader } from './PlanHeader.jsx';
import { useState } from 'react';
import { HoldingBoard } from './HoldingBoard.jsx';
import { BattlePoolPanel } from './BattlePoolPanel.jsx';
import { AllocationPreview } from './AllocationPreview.jsx';
import { allocateBattle } from '../../../services/battleAllocationService.js';
import { poolSummary,isReady,isCommitted,eligibleTypes,assignmentIds,waveOf } from '../../../services/battlePoolService.js';
import { CommandAssignments } from './CommandAssignments.jsx';
import { C, EVENT_ICONS, JOINER_COVERAGE_EVENTS } from '../../../utils/constants.js';
import { vibe } from '../../../utils/vibe.js';
import { newRallySlot } from '../../../data/playerSchema.js';
import { RALLY_ICONS, isAttending, playerCanFillSlot, meetsTroopReqs, suggestJoinerHeroes, timingTier, bestTroopTierIndex } from './battleConstants.js';
import { getCurrentTroopPower, calcMetrics, isMvpJoiner } from '../../../data/metrics.js';
import { RallySlotCard } from './RallySlotCard.jsx';
import { ChecklistManagerSheet } from './ChecklistManagerSheet.jsx';

export function PlanDetail({ plan, plans = [], players, events = [], onUpdate, onBack, onGoLive, onGoToMembers, selectedGenerations = [], checklist = [], onSaveChecklist, poolController }) {
  const [proposal,setProposal]=useState(null);
  const [allocationUndo,setAllocationUndo]=useState(null);
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

  const siblingPlans = plan.eventId ? plans.filter(p => p.id !== plan.id && p.eventId === plan.eventId) : [];

  function assignedInOtherSlots(currentSlotId) {
    const ids = new Set();
    slots.forEach(s => {
      if (s.id === currentSlotId || waveOf(s)!==waveOf(slots.find(x=>x.id===currentSlotId)||{})) return;
      (s.troopFillers||[]).forEach(f=>ids.add(f.playerId));
      (s.joiners || []).forEach(j => { if (j.playerId) ids.add(j.playerId); });
      if (s.leaderId) ids.add(s.leaderId); // leading elsewhere rules out joining here
    });
    siblingPlans.forEach(sp => {
      (sp.rallySlots || []).filter(s=>waveOf(s)===waveOf(slots.find(x=>x.id===currentSlotId)||{})).forEach(s => {
        (s.troopFillers||[]).forEach(f=>ids.add(f.playerId));
        (s.joiners || []).forEach(j => { if (j.playerId) ids.add(j.playerId); });
        if (s.leaderId) ids.add(s.leaderId);
      });
    });
    return ids;
  }

  const allLeaderIds = new Set();
  slots.forEach(s => { if (s.leaderId) allLeaderIds.add(s.leaderId); });
  siblingPlans.forEach(sp => (sp.rallySlots || []).forEach(s => { if (s.leaderId) allLeaderIds.add(s.leaderId); }));

  const allocationSignature=JSON.stringify({plan,pool:poolController?.pool,players});
  function autoFillPlan(slotsToFill,rebalance=false) {
    if(!linkedEvent)return;
    const base={...plan,rallySlots:slotsToFill||slots};
    const result=allocateBattle({plan:base,players,event:linkedEvent,events,pool:poolController?.pool,siblings:siblingPlans,rebalance,mode:plan.allocationMode||'balanced'});
    setProposal({...result,signature:allocationSignature});setConfirmAutoFill(false);
  }
  function applyAllocation(){if(!proposal||proposal.signature!==allocationSignature)return;const next={...plan,rallySlots:proposal.slots};setAllocationUndo({slots:slots,expected:JSON.stringify(proposal.slots),pool:JSON.stringify(poolController?.pool)});onUpdate(next);setProposal(null);setAutoFillResult(null);vibe(8);}

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
        .filter(p => isReady(p,linkedEvent))
        .filter(p => !slot.allianceTag || p.allianceTag === slot.allianceTag);
      (slot.joiners || []).forEach(j => {
        if (!j.heroName) return;
        const eligible = pool.filter(p => playerCanFillSlot(p, j.heroName) && eligibleTypes(p,slot).length>0);
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

  const allAssignedPlanWide = new Set();
  slots.forEach(s => { (s.joiners || []).forEach(j => { if (j.playerId) allAssignedPlanWide.add(j.playerId); }); (s.troopFillers||[]).forEach(f=>allAssignedPlanWide.add(f.playerId)); });
  siblingPlans.forEach(sp => (sp.rallySlots || []).forEach(s => (s.joiners || []).forEach(j => { if (j.playerId) allAssignedPlanWide.add(j.playerId); })));
  const unallocated = players.filter(p =>
    !allAssignedPlanWide.has(p.id) && !allLeaderIds.has(p.id) && (!linkedEvent || isReady(p,linkedEvent)) && !isCommitted(p,poolController?.pool)
  );
  const hasJoinerHero = p => (p.joinerHeroes || []).some(jh => jh.skillLevel >= 5);
  const unallocatedEligible   = unallocated.filter(hasJoinerHero);
  const unallocatedIneligible = unallocated.filter(p => !hasJoinerHero(p));

  const linkableEvents = events.filter(e => e.status !== 'completed');

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
      <PlanHeader plan={plan} onBack={onBack} updPlan={updPlan} eventPickerOpen={eventPickerOpen} setEventPickerOpen={setEventPickerOpen} linkedEvent={linkedEvent} linkableEvents={linkableEvents}/>
      {poolController&&<BattlePoolPanel controller={poolController} players={players} event={linkedEvent} slots={slots}/>}
      <AllocationPreview proposal={proposal} stale={proposal?.signature!==allocationSignature} onApply={applyAllocation} onCancel={()=>setProposal(null)}/>
      {allocationUndo&&<button onClick={()=>{if(JSON.stringify(slots)!==allocationUndo.expected||JSON.stringify(poolController?.pool)!==allocationUndo.pool)return;updPlan({rallySlots:allocationUndo.slots});setAllocationUndo(null);}} disabled={JSON.stringify(slots)!==allocationUndo.expected||JSON.stringify(poolController?.pool)!==allocationUndo.pool} style={{minHeight:44,padding:'8px 14px',background:C.section,border:`1px solid ${C.border}`,borderRadius:10,color:C.icy,fontSize:14,marginBottom:12}}>Undo allocation</button>}
      {poolSummary(players,linkedEvent,slots,poolController?.pool,plan).warnings.map((w,i)=><div key={i} style={{fontSize:14,color:C.gold,marginBottom:10}}>{w}</div>)}
      <HoldingBoard controller={poolController} players={players} assignments={plan.commandAssignments}/>
      <CommandAssignments plan={plan} players={players} onUpdate={onUpdate}/>

      <PlanCreationControls linkedEvent={linkedEvent} slots={slots} turretCount={turretCount} setTurretCount={setTurretCount} castleCount={castleCount} setCastleCount={setCastleCount} createAndAutoFillLeaders={createAndAutoFillLeaders} plan={plan} updPlan={updPlan} autoFillPlan={autoFillPlan} confirmAutoFill={confirmAutoFill} setConfirmAutoFill={setConfirmAutoFill} autoFillResult={autoFillResult}/>

      {unfillableCount > 0 && (
        <div style={{ background:C.red+'0e', border:`1px solid ${C.red}44`, borderRadius:12, padding:'12px 14px', marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.red }}>⚠ {unfillableCount} priority joiner{unfillableCount !== 1 ? 's have' : ' has'} no eligible attendee</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>See Leadership Checklist below for details.</div>
        </div>
      )}


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
          poolController={poolController}
          linkedEvent={linkedEvent}
        />
      ))}

      {slots.length > 0 && (
        <button onClick={addSlot} style={{ width:'100%', height:48, borderRadius:12, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', marginBottom:16 }}>
          ＋ Add rally slot
        </button>
      )}

      <PlanOutputs plan={plan} slots={slots} readySlots={readySlots} summaryText={summaryText} setSummaryText={setSummaryText} generateSummary={generateSummary} copySummary={copySummary} summaryCopied={summaryCopied} regenerateSummary={regenerateSummary} linkedEvent={linkedEvent} unallocated={unallocated} unallocatedEligible={unallocatedEligible} unallocatedIneligible={unallocatedIneligible} checklist={checklist} autoFlags={autoFlags} setChecklistManagerOpen={setChecklistManagerOpen} updPlan={updPlan} copyChecklist={copyChecklist} checklistCopied={checklistCopied} checklistManagerOpen={checklistManagerOpen} onSaveChecklist={onSaveChecklist} onGoLive={onGoLive}/>
    </div>
  );
}
