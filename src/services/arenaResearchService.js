import {arenaResearch} from '../data/arenaResearch.js';
export function skillScaling(heroId,skillIndex,level,attack){
 const reference=arenaResearch[String(heroId)],skill=reference?.skills?.[skillIndex];
 const valid=['number','string'].includes(typeof level) && String(level).trim()!=='' && Number.isInteger(Number(level)) && Number(level)>=1 && Number(level)<=5;
 if(!skill || !valid)return null;
 const percent=skill.percent[Number(level)-1],scales=['damage','healing','damagePerSecond'].includes(skill.kind);
 const atkValid=['number','string'].includes(typeof attack)&&String(attack).trim()!==''&&Number.isFinite(Number(attack))&&Number(attack)>0;
 const base=scales&&atkValid?Number(attack)*percent/100:null;
 return {name:skill.name,kind:skill.kind,percent,note:skill.note,base,min:base!=null && skill.random?base*skill.random[0]:null,max:base!=null && skill.random?base*skill.random[1]:null};
}
export function explorationResearchAdvice(yours,theirs){
 const a=yours.filter(Boolean),b=theirs.filter(Boolean),has=(heroes,name)=>heroes.some(h=>h.name===name),notes=[];
 if(has(a,'Lynn') && has(b,'Mia'))notes.push({kind:'Healing matchup',text:'Check Lynn’s Discordant Tune level: its Exploration effect reduces enemy healing by 40–60%. That is relevant to the opponent’s Mia. Actual healing reduction still depends on unlocked skills and other effects.',source:arenaResearch['50022'].source});
 if(has(b,'Lynn') && has(a,'Mia'))notes.push({kind:'Healing threat',text:'The opponent’s Lynn can reduce healing through Discordant Tune. Check the skill level before relying on Mia to sustain your team.',source:arenaResearch['50022'].source});
 if(has(b,'Gwen'))notes.push({kind:'Backline threat',text:'Gwen’s Salvo explicitly attacks rear enemies, heroes first. Watch which backline hero falls first and test a back-row swap; there is no verified universal safe slot.',source:arenaResearch['50026'].source});
 if(has(b,'Hector') && (has(a,'Alonso') || has(a,'Reina') || has(a,'Mia')))notes.push({kind:'Control timing',text:'Hector’s Sword Whirlwind gives control immunity while active. Do not assume a stun or immobilisation will interrupt him during that window. Record skill timing when testing this matchup.',source:arenaResearch['50024'].source});
 return notes;
}
