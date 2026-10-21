// Official Holger skill tables: 2% per level, levels 1–10. Level 0 means not unlocked.
// Arena Elite affects escorts; Legacy affects heroes. Do not add the two pools together.
export function holgerSkill(level){
 const valid=['number','string'].includes(typeof level) && String(level).trim()!=='' && Number.isInteger(Number(level)) && Number(level)>=0 && Number(level)<=10;
 return valid?{known:true,level:Number(level),attackPercent:Number(level)*2,healthPercent:Number(level)*2}:{known:false,level:null,attackPercent:null,healthPercent:null};
}
export function compareHolger(yours,theirs){
 const a={arenaElite:holgerSkill(yours?.arenaElite),legacy:holgerSkill(yours?.legacy)},b={arenaElite:holgerSkill(theirs?.arenaElite),legacy:holgerSkill(theirs?.legacy)};
 return {yours:a,theirs:b,escortDifference:a.arenaElite.known && b.arenaElite.known?a.arenaElite.attackPercent-b.arenaElite.attackPercent:null,heroDifference:a.legacy.known && b.legacy.known?a.legacy.attackPercent-b.legacy.attackPercent:null,complete:[a.arenaElite,a.legacy,b.arenaElite,b.legacy].every(s=>s.known)};
}
