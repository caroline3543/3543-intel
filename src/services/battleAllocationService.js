import {getCurrentTroopPower} from '../data/metrics.js';
import {TYPES,nameOf,waveOf,isReady,isQualifiedLeader,isCommitted,reservedIds,eligibleTypes,assignmentIds,parseRatio} from './battlePoolService.js';
import {heroOptions,ownedSkillFive} from './battleHeroOptions.js';
import {allocateFillers} from './battleTroopAllocation.js';
import {FC_ORDER} from '../components/svs/battle/battleConstants.js';
export function allocateBattle({plan,players,event,events=[],pool={},siblings=[],rebalance=false,mode='balanced'}) {
 const slots=structuredClone(plan.rallySlots||[]),changes=[],warnings=[],reserved=reservedIds(plan,pool),used=new Map();
 const usedFor=wave=>{if(!used.has(wave))used.set(wave,new Set());return used.get(wave);};
 for(const sibling of siblings)for(const id of reservedIds(sibling,pool))reserved.add(id);
 const activeSlots=new Set(Object.values(pool.commitments||{}).filter(c=>c.active).map(c=>c.slotId).filter(Boolean));
 const locked=s=>s.allocationLocked||activeSlots.has(s.id);
 if(rebalance){for(const s of slots){if(locked(s))continue;if(!s.leaderLocked){s.leaderId=null;s.leaderName='';}s.joiners=(s.joiners||[]).map(j=>j.locked?j:{...j,playerId:null,playerName:'',confirmed:true});s.troopFillers=(s.troopFillers||[]).filter(j=>j.locked);}}
 for(const s of [...slots,...siblings.flatMap(p=>p.rallySlots||[])])assignmentIds(s).forEach(id=>usedFor(waveOf(s)).add(id));
 const sorted=[...slots].sort((a,b)=>(b.commandPriority||0)-(a.commandPriority||0)||Number(b.target==='castle')-Number(a.target==='castle'));
 const free=(p,s)=>isReady(p,event,s.planPhase)&&!isCommitted(p,pool)&&!reserved.has(p.id)&&!usedFor(waveOf(s)).has(p.id)&&(!s.allianceTag||p.allianceTag===s.allianceTag);
 const rank=(a,b)=>{
   const ar=a.leadershipRank>0?a.leadershipRank:Infinity,br=b.leadershipRank>0?b.leadershipRank:Infinity;
   return ar-br||((getCurrentTroopPower(b,events)??-1)-(getCurrentTroopPower(a,events)??-1))||nameOf(a).localeCompare(nameOf(b));
 };
 for(const s of sorted){if(s.leaderId||locked(s))continue;
   if(['Garrison Entry','Reinforcement'].includes(s.type)){warnings.push(`${s.type}: choose a designated leader`);continue;}
   const p=players.filter(p=>free(p,s)&&isQualifiedLeader(p)).sort(rank)[0];
   if(p){s.leaderId=p.id;s.leaderName=nameOf(p);s.leaderRanking=p.leadershipRank?'Commander rank':getCurrentTroopPower(p,events)!=null?'Troop-power estimate':'Strength unknown';usedFor(waveOf(s)).add(p.id);changes.push(`${s.target==='castle'?'Castle':'Turret / rally'} leader: ${nameOf(p)} (${s.leaderRanking})`);}else warnings.push(`${s.target||s.type}: no eligible rally leader`);
 }
 const tasks=[];
 for(const s of sorted){if(locked(s))continue;if(!s.joiners?.some(j=>j.heroName)&&!s.leaderRallyHeroes?.length)warnings.push(`${s.leaderName||s.type}: review formation and priority heroes`);const leader=players.find(p=>p.id===s.leaderId);
   s.joiners=(s.joiners||[]).map((j,index)=>{const opts=heroOptions(s,index,leader);if(!j.heroName&&!j.heroLocked&&opts.preferred[0])j.heroName=opts.preferred[0];return j;});
   s.joiners.forEach((j,i)=>{if(!j.playerId&&!j.locked)tasks.push({s,j,i,opts:heroOptions(s,i,leader)});});
 }
 // Allocate scarce skill providers first; castle priority breaks ties.
 const candidates=(task,heroes)=>players.flatMap(p=>free(p,task.s)&&eligibleTypes(p,task.s).length?heroes.filter(h=>ownedSkillFive(p,h) && (task.opts.formation?.joinerLimits?.[h]==null || task.s.joiners.filter(j=>j.playerId&&j.heroName===h).length<task.opts.formation.joinerLimits[h])).map(hero=>({p,hero})):[]);
 tasks.sort((a,b)=>(candidates(a,a.opts.preferred).length||Infinity)-(candidates(b,b.opts.preferred).length||Infinity)||sorted.indexOf(a.s)-sorted.indexOf(b.s));
 for(const task of tasks){const {s,j,opts}=task;let options=candidates(task,opts.preferred),fallback=false;
   if(!options.length&&!j.heroLocked){options=candidates(task,opts.alternatives);fallback=true;}
   options.sort((a,b)=>{
     const score=p=>eligibleTypes(p,s).reduce((n,k)=>n+(FC_ORDER.indexOf(p.troops[k])+1)*(parseRatio(s.ratio)?.[k]||0),0);
     return score(b.p)-score(a.p)||nameOf(a.p).localeCompare(nameOf(b.p));
   });
   const best=options[0];if(best){j.playerId=best.p.id;j.playerName=nameOf(best.p);j.heroName=best.hero;j.confirmed=true;usedFor(waveOf(s)).add(best.p.id);
     if(fallback)changes.push(`${s.leaderName}: ${opts.preferred.join('/')} unavailable → ${best.hero}${opts.formation?.isMeta?' (unverified community formation)':''}`);
   }else if(j.heroName)warnings.push(`${s.leaderName||s.type}: ${j.heroName} unavailable${opts.alternatives.length?' · no available alternative':' · no verified alternative'}`);
 }
 allocateFillers({slots:sorted,players,event,pool,usedFor,reserved,mode,warnings});
 for(const s of slots){const old=plan.rallySlots?.find(x=>x.id===s.id);if(old&&JSON.stringify(s)!==JSON.stringify(old)&&!changes.some(x=>x.includes(s.leaderName)))changes.push(`${s.leaderName||s.type}: assignments updated`);}
 return {slots,changes,warnings};
}
