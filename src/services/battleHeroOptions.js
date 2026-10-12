import { JOINER_META } from '../data/joinerMeta.js';
import { resolveHero } from '../components/svs/battle/battleConstants.js';
const canonical = h => ({Seeyoon:'Seo-Yoon'}[h]||h);
export function expandHero(raw) {return String(raw||'').split('/').flatMap(h=>{const r=resolveHero(h.trim());return r?[r.display,...r.alternatives].map(canonical):[];}).filter(h=>/^[A-Za-z][A-Za-z -]*$/.test(h)&&!h.toLowerCase().startsWith('or ')&&!h.includes('ones'));}
export function ownedSkillFive(p,hero) {return (p.joinerHeroes||[]).find(h=>canonical(h.hero).toLowerCase()===hero.toLowerCase()&&h.skillLevel>=5);}
export function formationFor(slot,leader) {
  if(slot.selectedFormation){const selected=slot.selectedFormation;const gen=JOINER_META.find(g=>g.gen===selected.gen);return gen?.formations.find(f=>f.leaders.join()===selected.leaders?.join()&&f.type===selected.type&&(!selected.ratio||selected.ratio===f.ratio));}
  if(slot.formationMode==='custom')return null;
  const defense=slot.purpose?slot.purpose==='hold':['Counter Rally','Garrison Entry','Reinforcement'].includes(slot.type);
  const team=(leader?.leaderProfile?.teams||[]).find(t=>t.type===(defense?'defense':'offense'));
  const heroes=slot.leaderRallyHeroes?.length?slot.leaderRallyHeroes:team?.leadHeroes?.filter(Boolean)||[];
  if(heroes.length<2)return null;
  const candidates=JOINER_META.flatMap(g=>g.formations.map(f=>({...f,gen:g.gen}))).filter(f=>f.type.toLowerCase().includes(defense?'defense':'offense')&&(!slot.ratio||f.ratio.split(/\s+or\s+/).includes(slot.ratio)));
  let best=null,bestScore=1;
  for(const f of candidates){const allowed=f.leaders.flatMap(x=>x.split(/\s*&\s*|\//)).map(x=>x.trim().toLowerCase());const score=heroes.filter(h=>allowed.includes(h.toLowerCase())).length;if(score>bestScore){best=f;bestScore=score;}}
  return best;
}
export function heroOptions(slot,index,leader) {
  const f=formationFor(slot,leader),requested=slot.joiners?.[index]?.heroName||slot.requestedHeroes?.[index]||f?.[`j${index+1}`]||'';
  const alternatives=f?[f.fallbackJoiners?.[index],f.alt1,f.alt2,f.alt3].flatMap(expandHero):[];
  return {preferred:expandHero(requested),alternatives:[...new Set(alternatives)],formation:f};
}
