import { playerSearchFields } from './playerNames.js';
import { gameLanguageName } from './gameLanguageService.js';
export const EMPTY_FILTERS = { alliance:'', role:'', tier:'', infantry:'', lancer:'', marksman:'', hero:'', verified:false, language:'', review:false };
export const TIER_FILTERS = [
  ['helios-infantry','Helios infantry'], ['helios-lancer','Helios lancer'], ['helios-marksman','Helios marksman'],
  ['full-fc5','Full FC5'], ['full-fc6','Full FC6'], ['full-fc7','Full FC7'], ['full-fc8','Full FC8'],
];
export const TROOP_TYPE_FILTERS = [['T9','T9 or higher'],['T10','T10 or higher'],['T11','T11 or higher'],['FC5','FC5 or higher'],['FC6','FC6 or higher'],['FC7','FC7 or higher'],['FC8','FC8 or higher'],['Helios','Helios only']];
function troopRank(value){
 const v=String(value||'').toUpperCase();
 if(!v)return -1;
 const fc=v.match(/FC\\s*([0-9]+)/);if(fc)return 20+Number(fc[1]);
 const t=v.match(/T\\s*([0-9]+)/);if(t)return Number(t[1]);
 if(v.includes('HELIOS'))return 25;
 return -1;
}
function matchesTroopThreshold(value,required){
 if(!required)return true;
 if(required==='Helios')return String(value||'').toLowerCase().includes('helios');
 return troopRank(value)>=troopRank(required);
}
export function troopGaps(player) {
  return ['infantry','lancer','marksman'].filter(key => !player.troops?.[key]);
}
export function matchesRosterFilters(player, search, filters) {
  const query=search.trim().toLocaleLowerCase();
  if (query && !playerSearchFields(player).some(value => String(value??'').toLocaleLowerCase().includes(query))) return false;
  if (filters.alliance && player.allianceTag!==filters.alliance) return false;
  const leader=player.roles?.includes('Rally Lead');
  if (filters.role==='joiner' ? leader || player.blacklisted : filters.role && !player.roles?.includes(filters.role)) return false;
  if (filters.language && gameLanguageName(player.gameLanguage)!==filters.language) return false;
  if (filters.hero && !(player.joinerHeroes||[]).some(hero=>hero.hero===filters.hero && hero.skillLevel>=5 && (!filters.verified || hero.verified === true))) return false;
  if (['infantry','lancer','marksman'].some(type=>!matchesTroopThreshold(player.troops?.[type],filters[type]))) return false;
  if (filters.review && !troopGaps(player).length && player.allianceTag && player.fid) return false;
  if (filters.tier?.startsWith('helios-') && !player.troops?.[filters.tier.slice(7)]?.startsWith('Helios')) return false;
  if (filters.tier==='full-fc5' && !['infantry','lancer','marksman'].every(key=>player.troops?.[key]==='FC5')) return false;
  const fullTier=filters.tier?.match(/^full-fc([678])$/)?.[1];
  if(fullTier && !['infantry','lancer','marksman'].every(key=>[`FC${fullTier}`,`Helios FC${fullTier}`].includes(player.troops?.[key])))return false;
  return true;
}
export function rosterFilterCount(filters) {
  return Object.entries(filters).filter(([key,value])=>Boolean(value) && (key!=='verified' || Boolean(filters.hero))).length;
}
export function latestRosterFetch(players) {
  const dates=players.map(p=>p.providerStats?.retrievedAt).filter(value=>Number.isFinite(Date.parse(value)));
  return dates.sort((a,b)=>Date.parse(b)-Date.parse(a))[0] || null;
}
