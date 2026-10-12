import { isAttending, timingTier, FC_ORDER } from '../components/svs/battle/battleConstants.js';
export const TYPES = ['infantry','lancer','marksman'];
export const POOL_STATUSES = ['Ready','Busy','Returning','Healing','Offline','Unknown'];
export const nameOf = p => p?.username || p?.alias || 'Unknown player';
export const waveOf = s => s.waveId || 'main';
export function parseRatio(raw) {
  const text=String(raw||'').trim();
  if(!/^\d+(\.\d+)?\/\d+(\.\d+)?(\/\d+(\.\d+)?)?$/.test(text))return null;
  const numbers=text.split('/').map(Number);if(numbers.length===2)numbers.push(0);
  const total=numbers.reduce((a,b)=>a+b,0);return total===100?Object.fromEntries(TYPES.map((k,i)=>[k,numbers[i]/100])):null;
}
export function mergePoolPlayers(players,pool={}) {
  return [...players,...(pool.temporary||[])].map(p=>{const o=pool.overrides?.[p.id]||{};return {...p,...o,troops:{...p.troops,...o.troops},joinerHeroes:o.joinerHeroes??p.joinerHeroes,poolStatus:o.status,poolConfirmedAt:o.confirmedAt};});
}
export function isReady(p,event,phase='start') {
  if(p.blacklisted)return false;
  if(p.poolStatus)return p.poolStatus==='Ready';
  return isAttending(p.id,event)&&timingTier(p,event,phase)<=1;
}
export function statusOf(p,event) {return p.poolStatus || (isAttending(p.id,event)?'Ready':'Unknown');}
export function activeCommitments(pool={}) {return Object.entries(pool.commitments||{}).filter(([,c])=>c.active).map(([id,c])=>({id,...c}));}
export function isCommitted(p,pool={},wave='main') {return activeCommitments(pool).some(c=>c.playerIds?.includes(p.id));}
export function eligibleTypes(p,slot,allowFallback=false) {
  const ratio=parseRatio(slot.ratio);if(!ratio)return [];
  return TYPES.filter(k=>{
    if(!ratio[k])return false;const tier=p.troops?.[k];if(!tier || FC_ORDER.indexOf(tier)<0 && tier!=='T10')return false;
    if(p.availableTroops?.[k]===0)return false;
    if(slot.tierPolicy==='helios')return tier.startsWith('Helios');
    const min=slot.tierPolicy==='best'?null:slot.troopReqs?.[k];if(!min || allowFallback&&slot.tierPolicy==='preferred')return true;
    return min==='Helios'?tier.startsWith('Helios'):FC_ORDER.indexOf(tier)>=FC_ORDER.indexOf(min);
  });
}
export function isQualifiedLeader(p) {return p.roles?.includes('Rally Lead')||['leader','both'].includes(p.leaderProfile?.role);}
export function reservedIds(plan,pool={}) {return new Set([...Object.values(pool.structures||{}).flatMap(s=>[s.leaderId,s.backupId]),...['garrisonId','backupId','reinforcementId'].map(k=>plan.commandAssignments?.[k]),...Object.entries(pool.overrides||{}).filter(([,p])=>p.reserved).map(([id])=>id)].filter(Boolean));}
export function assignmentIds(slot) {return [slot.leaderId,...(slot.joiners||[]).map(j=>j.playerId),...(slot.troopFillers||[]).map(f=>f.playerId)].filter(Boolean);}
export function poolSummary(players,event,slots=[],pool={},plan={}) {
  const reserved=reservedIds(plan||{},pool);
  const ready=players.filter(p=>isReady(p,event)&&!p.reserved&&!reserved.has(p.id)&&!isCommitted(p,pool));
  const warnings=[];const waves=[...new Set(slots.map(waveOf))];
  for(const wave of waves){const rallies=slots.filter(s=>waveOf(s)===wave && !['Garrison Entry','Reinforcement'].includes(s.type));
    const leaders=new Set(slots.filter(s=>waveOf(s)===wave).map(s=>s.leaderId).filter(Boolean));
    const available=ready.filter(p=>!leaders.has(p.id)&&rallies.some(s=>(!s.allianceTag||p.allianceTag===s.allianceTag)&&eligibleTypes(p,s).length));
    const needed=rallies.reduce((n,s)=>n+(Number(s.targetJoiners)||10),0);
    if(needed>available.length)warnings.push(`${wave}: ${needed} joiners requested · ${available.length} available · short by ${needed-available.length}`);
  }
  const commitments=new Map();for(const s of slots)for(const id of assignmentIds(s)){const key=waveOf(s)+':'+id;if(commitments.has(key))warnings.push(`${waveOf(s)}: ${nameOf(players.find(p=>p.id===id))} assigned more than once`);commitments.set(key,s.id);}
  for(const s of slots){for(const id of assignmentIds(s)){const p=players.find(p=>p.id===id);if(p&&!isReady(p,event,s.planPhase))warnings.push(`${s.leaderName||s.type}: ${nameOf(p)} is ${statusOf(p,event)}`);if(p&&id!==s.leaderId&&!eligibleTypes(p,s).length)warnings.push(`${s.leaderName||s.type}: ${nameOf(p)} has no eligible required troop type`);}}
  return {ready:ready.length,reserved:players.filter(p=>p.reserved||reserved.has(p.id)).length,busy:players.filter(p=>isCommitted(p,pool)||['Busy','Returning','Healing'].includes(statusOf(p,event))).length,offline:players.filter(p=>statusOf(p,event)==='Offline').length,unknown:players.filter(p=>statusOf(p,event)==='Unknown').length,warnings};
}
