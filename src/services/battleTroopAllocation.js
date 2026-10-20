import {TYPES,waveOf,isReady,isCommitted,eligibleTypes,nameOf,parseRatio} from './battlePoolService.js';
import {FC_ORDER} from '../components/svs/battle/battleConstants.js';
export function contribution(p,slot,remaining) {
 const types=eligibleTypes(p,slot),known=types.every(k=>Number.isFinite(p.availableTroops?.[k]))&&Number.isFinite(p.marchCapacity)&&p.marchCapacity>0;
 if(!known)return {playerId:p.id,playerName:nameOf(p),types,troops:null,estimated:true};
 let capacity=p.marchCapacity;const troops={infantry:0,lancer:0,marksman:0};
 const ordered=types.sort((a,b)=>(remaining?.[b]??0)-(remaining?.[a]??0));
 for(const k of ordered){const amount=Math.max(0,Math.min(p.availableTroops[k],capacity,remaining?.[k]??Infinity));troops[k]=amount;capacity-=amount;}
 return {playerId:p.id,playerName:nameOf(p),types,troops,estimated:false};
}
export function coverageFor(slot,players) {
 const ratio=parseRatio(slot.ratio),requirements=ratio&&slot.rallyCapacity>0?Object.fromEntries(TYPES.map(k=>[k,Math.floor(slot.rallyCapacity*ratio[k])])):null;
 const records=[...(slot.joiners||[]).filter(j=>j.playerId),...(slot.troopFillers||[])];
 const contributions=[];let remaining=requirements?{...requirements}:null;
 const leader=slot.leaderContribution;
 if(remaining&&leader)for(const k of TYPES)remaining[k]=Math.max(0,remaining[k]-(leader[k]||0));
 for(const r of records){const p=players.find(p=>p.id===r.playerId);if(!p)continue;const c=contribution(p,slot,remaining);contributions.push(c);if(remaining&&c.troops)for(const k of TYPES)remaining[k]=Math.max(0,remaining[k]-(c.troops[k]||0));}
 const provided=Object.fromEntries(TYPES.map(k=>[k,contributions.some(c=>c.types?.includes(k)&&(!c.troops||c.troops[k]>0))||leader?.[k]>0]));
 const exact=!!requirements&&!!leader&&TYPES.every(k=>Number.isFinite(leader[k]))&&contributions.every(c=>!c.estimated);
 return {ratio,remaining,provided,exact,contributions,count:new Set(records.map(r=>r.playerId)).size,missingTypes:ratio?TYPES.filter(k=>ratio[k]&&!provided[k]):TYPES};
}
export function allocateFillers({slots,players,event,pool,usedFor,reserved,mode,warnings}) {
 const active=new Set(Object.values(pool.commitments||{}).filter(c=>c.active).map(c=>c.slotId).filter(Boolean));
 const work=slots.filter(s=>!s.allocationLocked&&!active.has(s.id));
 const rounds=Math.max(0,...work.map(s=>Number(s.targetJoiners)||10));
 function eligibleAvailable(s){return players.filter(p=>isReady(p,event,s.planPhase)&&!isCommitted(p,pool)&&!reserved.has(p.id)&&!usedFor(waveOf(s)).has(p.id)&&(!s.allianceTag||p.allianceTag===s.allianceTag)&&eligibleTypes(p,s).length);}
 for(let round=0;round<rounds&&mode!=='castle';round++){
   const ordered=mode==='castle'?work: [...work].sort((a,b)=>coverageFor(a,players).count-coverageFor(b,players).count);
   for(const s of ordered){const coverage=coverageFor(s,players);if(coverage.count>=(Number(s.targetJoiners)||10))continue;
     if(!coverage.ratio){if(!warnings.includes(`${s.leaderName||s.type}: choose one exact ratio`))warnings.push(`${s.leaderName||s.type}: choose one exact ratio`);continue;}
     const available=eligibleAvailable(s);
     const scarcity=Object.fromEntries(TYPES.map(k=>[k,available.filter(p=>eligibleTypes(p,s).includes(k)).length]));
     const score=p=>eligibleTypes(p,s).reduce((n,k)=>n+(!coverage.provided[k]?1000:0)+(coverage.remaining?.[k]>0?100:0)+coverage.ratio[k]*10/(scarcity[k]||1)+(FC_ORDER.indexOf(p.troops[k])+1),0);
     available.sort((a,b)=>score(b)-score(a)||nameOf(a).localeCompare(nameOf(b)));
     const p=available[0];if(!p)continue;
     const c=contribution(p,s,coverage.remaining);if(c.troops&&!TYPES.some(k=>c.troops[k]>0))continue;
     s.troopFillers=[...(s.troopFillers||[]),c];usedFor(waveOf(s)).add(p.id);
   }
 }
 // Main priority mode fills the first castle before later slots.
 if(mode==='castle')for(const s of work){while(coverageFor(s,players).count<(Number(s.targetJoiners)||10)){
   const p=eligibleAvailable(s)[0];if(!p)break;const c=contribution(p,s,coverageFor(s,players).remaining);if(c.troops&&!TYPES.some(k=>c.troops[k]>0))break;s.troopFillers=[...(s.troopFillers||[]),c];usedFor(waveOf(s)).add(p.id);
 }}
 for(const s of slots){const c=coverageFor(s,players);if(c.missingTypes.length)warnings.push(`${s.leaderName||s.type}: ${c.missingTypes.join(', ')} coverage missing`);
   if(c.remaining&&TYPES.some(k=>c.remaining[k]>0))warnings.push(`${s.leaderName||s.type}: ${c.exact?'Projected troop shortage':'Known contributions below target; quantities incomplete'}`);
   if(!c.exact)warnings.push(`${s.leaderName||s.type}: troop coverage estimated`);
 }
}
