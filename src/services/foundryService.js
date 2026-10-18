import { buildingName, PHASES } from '../data/foundry.js';
export function memberLabel(member, players) {
  const p=players.find(p=>p.id===member.playerId);
  return p ? `${p.username}${p.fid ? ` (${p.fid})` : ''}${p.furnaceLevel ? ` · ${p.furnaceLevel}` : ''}` : member.name || 'Removed member';
}
export function battleSheet(plan,players) {
  return [`${plan.title} · Legion ${plan.legion}`,`${plan.date} ${plan.time} UTC`,plan.notes,
    ...plan.teams.flatMap(t=>[`\n${t.name.toUpperCase()}`,...PHASES.map((p,i)=>`${p}: ${t.targets[i].map(buildingName).join(' + ') || 'Support / gather'}${t.instructions[i] ? ` · ${t.instructions[i]}` : ''}`),
      ...t.members.map(m=>`${m.role==='leader'?'★':'•'} ${memberLabel(m,players)}${m.note ? ` · ${m.note}` : ''}`)])].filter(Boolean).join('\n');
}
export function validateFoundry(plan) {
  const seen=new Set(),warnings=[];
  for(const t of plan.teams) for(const m of t.members) {
    const key=m.playerId || m.name?.trim().toLowerCase();
    if(key && seen.has(key)) warnings.push('A player is assigned to multiple teams.');
    seen.add(key);
  }
  for(const t of plan.teams) if(t.members.length && !t.members.some(m=>m.role==='leader') && !t.loot) warnings.push(`${t.name} needs a rally leader.`);
  if(!plan.date || !plan.time) warnings.push('Set the battle date and UTC time before sharing.');
  return [...new Set(warnings)];
}

// Event membership is explicit: an empty legion never falls back to the alliance.
export function foundryEventRoster(event, players) {
  const ids=new Set(event?.participantIds || []);
  return players.filter(p=>ids.has(p.id)).map(p=>({...p,
    foundrySubstitute:!!event.snapshots?.find(s=>s.playerId===p.id)?.rsvp?.substitute}));
}
export function withFoundryEvent(plan, events) {
  const event=events.find(e=>e.id===plan.eventId && e.type==='Foundry');
  return event ? {...plan,legion:String(event.legion || ''),date:event.date || '',time:event.time || ''} : plan;
}
