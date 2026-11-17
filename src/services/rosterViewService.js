import { playerSearchFields } from './playerNames.js';
import { normalizeName } from '../utils/normalize.js';
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
  const query=normalizeName(search);
  if (query && !playerSearchFields(player).some(value => normalizeName(String(value??'')).includes(query))) return false;
  if (filters.alliance==='__no_alliance' ? Boolean(String(player.allianceTag||'').trim()) : filters.alliance && player.allianceTag!==filters.alliance) return false;
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

/** Stale player API data is a review signal, never proof of transfer. */
export function suspectedTransferOut(player, now=Date.now()) {
  if(!['RKG','LUN','ARC','HOT'].includes(String(player?.allianceTag||'').toUpperCase()))return false;
  if(['transferred_out','transfer_review','unverified'].includes(player?.membershipStatus))return false;
  const refreshed=Date.parse(player?.providerStats?.retrievedAt||'');
  if(!Number.isFinite(refreshed))return false; // No successful fetch timestamp: unknown, not stale.
  const reviewed=Date.parse(player?.membershipReviewedAt||'');
  if(Number.isFinite(reviewed)&&reviewed>=refreshed)return false; // A human already dismissed this signal.
  return now-refreshed>=3*24*60*60*1000;
}

/** Validate the immutable Whiteout player FID before an individual location lookup. */
export function validPlayerFid(value){return /^[1-9]\d{3,14}$/.test(String(value??'').trim());}

/** Archived players stay in the workspace but never enter current-state allocations. */
export function eligibleFor3573Allocation(player){return player?.membershipStatus!=='transferred_out';}

/** Archive an externally confirmed state transfer without erasing profile data. */
export function archiveStateTransfer(player,location,confirmedAt=new Date().toISOString()){
  if(!player||location?.status!=='verified'||!/^\d+$/.test(String(location.state))||String(location.state)==='3573')throw Error('A verified external state is required.');
  return {...player,membershipStatus:'transferred_out',lastKnownAlliance:player.allianceTag||player.lastKnownAlliance||'',transferDestinationState:String(location.state),transferDestinationAlliance:location.tag||'',membershipCheckedAt:location.at,transferredOutAt:confirmedAt,membershipReviewedAt:confirmedAt};
}

/** Reactivate an existing profile by immutable ID, retaining history and event records. */
export function restoreStateTransfer(player,location,confirmedAt=new Date().toISOString()){
  if(!player||location?.status!=='verified'||String(location.state)!=='3573')throw Error('A verified return to state 3573 is required.');
  const tag=String(location.tag||'').trim();
  const old=String(player.allianceTag||'').trim();
  const movement=old!==tag?{from:old,to:tag,at:location.at}:null;
  return {...player,membershipStatus:'active',allianceTag:tag,lastKnownAlliance:old||player.lastKnownAlliance||'',membershipCheckedAt:location.at,membershipReviewedAt:confirmedAt,transferDestinationState:null,transferDestinationAlliance:null,allianceHistory:movement?[...(player.allianceHistory||[]),movement].slice(-4):player.allianceHistory};
}
