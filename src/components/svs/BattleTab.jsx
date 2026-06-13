import { useState } from 'react';
import { LiveRallyRoom } from './LiveRallyRoom.jsx';
import { PlanList }   from './battle/PlanList.jsx';
import { PlanDetail } from './battle/PlanDetail.jsx';

// ── BattleTab ──────────────────────────────────────────────────
// Thin coordinator. Owns the view stack (plans → detail → liveRoom)
// and the four plan-level mutations (create / update / delete / duplicate).
export function BattleTab({ plans, players, events, onSave, onDelete, showToast, onGoToMembers, settings }) {
  const [view, setView]                 = useState('plans');
  const [activePlanId, setActivePlanId] = useState(null);
  const [liveRoomPlan, setLiveRoomPlan] = useState(null);

  const activePlan   = plans.find(p => p.id === activePlanId);
  const existingTags = [...new Set(players.map(p => p.allianceTag).filter(Boolean))];

  function createPlan(plan)    { onSave([...plans, plan]); setActivePlanId(plan.id); showToast('Plan created ✓'); }
  function updatePlan(updated) { onSave(plans.map(p => p.id === updated.id ? updated : p)); }

  function deletePlan(id) {
    onDelete(id);
    setActivePlanId(null);
    showToast('Plan deleted');
  }

  function duplicatePlan(plan) {
    const copy = {
      ...plan,
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: `${plan.name || 'Plan'} (copy)`,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    onSave([...plans, copy]);
  }

  function handleGoLive(plan) { setLiveRoomPlan(plan); setView('liveRoom'); }

  if (view === 'liveRoom') {
    return <LiveRallyRoom onBack={() => setView('plans')} players={players} planData={liveRoomPlan}/>;
  }

  if (activePlan) {
    return (
      <PlanDetail
        plan={activePlan}
        players={players}
        onUpdate={updatePlan}
        onBack={() => setActivePlanId(null)}
        onGoLive={handleGoLive}
        onGoToMembers={onGoToMembers}
        maxGeneration={settings?.maxGeneration || 6}
      />
    );
  }

  return (
    <PlanList
      plans={plans}
      onSelectPlan={setActivePlanId}
      onCreatePlan={createPlan}
      onDuplicate={duplicatePlan}
      onDelete={deletePlan}
      onOpenLiveRoom={() => { setLiveRoomPlan(null); setView('liveRoom'); }}
      existingTags={existingTags}
      showToast={showToast}
    />
  );
}
