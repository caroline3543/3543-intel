import {interpretHero,interpretedStars} from './equipmentCatalogService.js';
export const ARENA_SLOTS=['Front left','Front right','Back left','Back centre','Back right'];
export const arenaNumber=v=>['string','number'].includes(typeof v)&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
export function arenaTeam(player,stateId){
 const details=player?.providerDetails,valid=details && String(details.stateId)===String(stateId) && String(details.fid)===String(player?.fid).trim();
 const items=valid && Array.isArray(details.heroes?.items)?details.heroes.items:[];
 const seen=new Set(),heroes=[];
 for(const raw of items.slice(0,50)){
  if(!raw || typeof raw!=='object')continue;
  const identity=String(raw.id ?? raw.hero_id ?? '');if(!identity || seen.has(identity))continue;seen.add(identity);
  heroes.push({key:`saved-${identity}`,raw:structuredClone(raw),origin:'Saved defence'});
 }
 // Source position codes remain visible. Their front/back mapping is not assumed verified.
 heroes.sort((a,b)=>(arenaNumber(interpretHero(a.raw).position)??999)-(arenaNumber(interpretHero(b.raw).position)??999));
 return {playerId:player?.id || '',playerName:player?.username || player?.alias || '',fid:String(player?.fid || ''),stateId:String(stateId),sourceAt:valid?details.heroes?.retrievedAt || null:null,heroes,slots:Array.from({length:5},(_,i)=>heroes[i]?.key || ''),confirmed:false};
}
export function placeArenaHero(team,index,key){
 if(!Number.isInteger(index)||index<0||index>4 || (key && !team.heroes.some(h=>h.key===key)))throw Error('Choose a valid hero and position.');
 const slots=[...team.slots],old=slots.indexOf(key),previous=slots[index];
 if(key && old>=0 && old!==index)slots[old]=previous;
 slots[index]=key;return {...team,slots,confirmed:false};
}
export function activeArenaHeroes(team){
 return team?.slots.map(key=>{const record=team.heroes.find(h=>h.key===key);return record?{...interpretHero(record.raw),key,origin:record.origin}:null}) || Array(5).fill(null);
}
export function arenaCoverage(team){
 const heroes=activeArenaHeroes(team),filled=heroes.filter(Boolean);
 return {filled:filled.length,power:filled.filter(h=>arenaNumber(h.power)!=null).length,levels:filled.filter(h=>arenaNumber(h.level)!=null).length,stars:filled.filter(h=>interpretedStars(h)!=null).length,gear:filled.reduce((sum,h)=>sum+new Set(h.gear.map(g=>g.name).filter(n=>['Goggles','Gloves','Belt','Boots'].includes(n))).size,0),skills:filled.filter(h=>Array.isArray(h.skill_levels)&&h.skill_levels.length>0).length,unknown:filled.filter(h=>!h.catalogued).length};
}
export function compareArenaTeams(yours,theirs){
 if(!yours || !theirs || yours.stateId!==theirs.stateId || !yours.fid || yours.fid===theirs.fid)return {available:false,reason:'Choose two different players in the same state.'};
 const a=activeArenaHeroes(yours),b=activeArenaHeroes(theirs),ac=arenaCoverage(yours),bc=arenaCoverage(theirs);
 const complete=ac.filled===5 && bc.filled===5;
 const total=hs=>hs.every(h=>h && arenaNumber(h.power)>0)?hs.reduce((s,h)=>s+Number(h.power),0):null;
 const yourPower=total(a),opponentPower=total(b),recommendations=[],gaps=[];
 if(!complete)gaps.push('Fill all five positions on both teams.');
 if(!yours.confirmed || !theirs.confirmed)gaps.push('Check both formations against the game and confirm positions.');
 for(const [label,c] of [['Your team',ac],['Opponent',bc]]){
  if(c.power<5)gaps.push(`${label}: ${5-c.power} hero power values missing.`);
  if(c.levels<5)gaps.push(`${label}: levels incomplete.`);
  if(c.stars<5)gaps.push(`${label}: stars incomplete.`);
  if(c.gear<20)gaps.push(`${label}: ${20-c.gear} equipment slots unreported.`);
  if(c.skills<5)gaps.push(`${label}: reported skills incomplete; skill IDs may still need interpretation.`);
  if(c.unknown)gaps.push(`${label}: ${c.unknown} heroes are not identified in the catalogue.`);
 }
 if(complete && yours.confirmed && theirs.confirmed){
  const exposed=a.findIndex((h,i)=>i<2 && h.troop!=='Infantry'),tank=a.findIndex((h,i)=>i>=2 && h.troop==='Infantry');
  if(exposed>=0 && tank>=0)recommendations.push({kind:'Free formation trial',text:`Try ${a[tank].name} in ${ARENA_SLOTS[exposed].toLowerCase()} and ${a[exposed].name} in ${ARENA_SLOTS[tank].toLowerCase()}. Infantry is the usual frontline starting point; test the swap because individual skills can change the best choice.`,swap:[exposed,tank]});
  const counters={Infantry:'Marksman',Lancer:'Infantry',Marksman:'Lancer'};
  const fronts=[...new Set(b.slice(0,2).map(h=>h.troop).filter(Boolean))];
  for(const type of fronts){const counter=counters[type];if(!counter || a.some(h=>h.troop===counter))continue;
   const alternatives=yours.heroes.filter(h=>!yours.slots.includes(h.key)).map(h=>interpretHero(h.raw)).filter(h=>h.troop===counter);
   recommendations.push({kind:'Class matchup to test',text:`The opponent has ${type} in front. ${counter} deals 10% extra class damage to ${type}. ${alternatives.length?`Review ${alternatives.map(h=>h.name).join(', ')} as an alternative.`:`Add an owned ${counter} alternative if available.`} Development and skill effects still matter; this does not establish who will target whom.`});
  }
 }
 // Objective gaps between matching heroes; never turn gear levels into invented damage.
 for(const h of a.filter(Boolean)){
  const other=b.find(o=>o && String(o.id ?? o.hero_id)===String(h.id ?? h.hero_id));if(!other)continue;
  const lv=arenaNumber(h.level),ol=arenaNumber(other.level);
  if(lv!=null && ol!=null && ol>lv)recommendations.push({kind:'Development gap',text:`${h.name}: level ${lv} versus ${ol}. Review this gap if this hero stays in your team; the benefit is not yet calculated.`});
  const widget=arenaNumber(h.widgetLevel),ow=arenaNumber(other.widgetLevel);
  if(widget!=null && ow!=null && ow>widget)recommendations.push({kind:'Widget review',text:`${h.name}: widget level ${widget} versus ${ow}. Check its Exploration effect before investing.`});
  for(const g of h.gear){const og=other.gear.find(x=>x.name===g.name && x.troop===g.troop && x.quality===g.quality && x.red===g.red);if(!og || !g.quality)continue;
   const e=arenaNumber(g.enhancement),oe=arenaNumber(og.enhancement),m=arenaNumber(g.mastery),om=arenaNumber(og.mastery);
   if((e!=null&&oe!=null&&oe>e)||(m!=null&&om!=null&&om>m))recommendations.push({kind:'Gear review',text:`${h.name} ${g.name} (${g.quality}): enhancement ${e??'?'} vs ${oe??'?'}, mastery ${m??'?'} vs ${om??'?'}. Review same-class gear allocation before upgrading. No damage gain is assumed.`});
  }
 }
 if(!recommendations.length)recommendations.push({kind:'Next test',text:'No supported counter identified from this snapshot. Check Exploration skill effects and record an actual battle before choosing upgrades.'});
 return {available:true,yours:ac,theirs:bc,yourPower,opponentPower,powerDifference:yourPower!=null && opponentPower!=null?yourPower-opponentPower:null,gaps,recommendations,complete,positionsConfirmed:yours.confirmed&&theirs.confirmed};
}
