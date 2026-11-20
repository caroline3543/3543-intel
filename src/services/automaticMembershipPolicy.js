/**
 * State 3573 automatic-membership policy. Pure functions: no API calls or writes.
 * The durable worker must enforce account-wide usage and atomic job leases.
 */
export const PRIMARY_ALLIANCES = Object.freeze(['ARC','RKG','HOT','LUN']);
export const REFRESH_MS = Object.freeze({
  primary: 12*60*60*1000,
  noAlliance: 24*60*60*1000,
  secondary: 7*24*60*60*1000,
  recentDeparture: 12*60*60*1000,
  recentDepartureWindow: 72*60*60*1000,
});
export const DAILY_LIMIT = 5000;
export const MINUTE_LIMIT = 60;
export const TRANSFER_PROMOTION_MS = 72*60*60*1000;
const validState = v => /^\d+$/.test(String(v ?? '')) && Number(v)>0;
const validFid = v => /^[1-9]\d{3,14}$/.test(String(v ?? ''));
const timestamp = v => {const t=Date.parse(v ?? '');return Number.isFinite(t)?t:null;};
export function refreshClass(player, now=Date.now(), secondaryTags=[]) {
  if (player?.membershipStatus==='transferred_out') return null;
  const tag=String(player?.allianceTag ?? '');
  const left=timestamp(player?.leftPrimaryAt);
  if(left!==null && now>=left && now-left<REFRESH_MS.recentDepartureWindow) return 'recentDeparture';
  if(PRIMARY_ALLIANCES.includes(tag))return 'primary';
  if(!tag)return 'noAlliance';
  return secondaryTags.includes(tag)?'secondary':null;
}
export function nextRefreshAt(player, now=Date.now(), secondaryTags=[]) {
  const cls=refreshClass(player,now,secondaryTags);
  if(!cls)return null;
  const last=timestamp(player?.membershipLastSuccessfulAt);
  return last===null?now:Math.max(now,last+REFRESH_MS[cls]);
}
/** Credit estimates must be conservative, never count a batch as one credit. */
export function estimatedCredits({kind,memberCount=0,ids=[]}) {
  if(kind==='alliance_members_base'||kind==='alliance_members_full')return Math.max(1,Math.ceil(memberCount));
  if(kind==='players_batch')return Math.max(1,ids.length);
  return 1;
}
export function availableBudget({used=0,reserved=1000,limit=DAILY_LIMIT}) {
  return Math.max(0,Math.floor(limit)-Math.max(0,Math.ceil(used))-Math.max(0,Math.ceil(reserved)));
}
export function canSchedule({used=0,reserved=1000,credits=1,minuteUsed=0,minuteLimit=MINUTE_LIMIT}) {
  return credits>0 && credits<=availableBudget({used,reserved}) && minuteUsed+credits<=minuteLimit;
}
/** Only an explicit fresh player-location observation may change state. */
export function classifyLocation(previous, observation, detectedAt) {
  if(!validFid(previous?.fid)||!observation||observation.status!=='verified'||!validState(observation.state)||!timestamp(observation.at)||!timestamp(detectedAt))return {kind:'unchanged',reason:'unverified'};
  const at=timestamp(observation.at), prior=timestamp(previous.membershipObservedAt);
  if(prior!==null && at<prior)return {kind:'unchanged',reason:'older_observation'};
  const toState=String(observation.state), fromState=String(previous.confirmedState ?? previous.stateId ?? '3573');
  const fromAlliance=String(previous.allianceTag??'');
  const toAlliance=String(observation.tag??'');
  if(fromState!==toState){
    return {kind:toState==='3573'?'transfer_in':'transfer_out',event:{
      id:`state:${previous.fid}:${fromState}:${toState}:${at}`,
      fid:String(previous.fid),username:previous.username||'',fromState,toState,
      fromAlliance,toAlliance,firstDetectedAt:detectedAt,verifiedAt:detectedAt,
      observedAt:observation.at,source:observation.source||'whiteoutstats-player',
      confidence:'confirmed',actualTransferAt:null
    }};
  }
  if(fromAlliance!==toAlliance)return {kind:'alliance_change',fromAlliance,toAlliance,observedAt:observation.at};
  return {kind:'unchanged',reason:'same_location'};
}
/** Unknown origin is discovery, never a confirmed transfer. */
export function classifyRosterDiscovery(existingPlayer, rosterMember, detectedAt) {
  if(!validFid(rosterMember?.fid)||!timestamp(detectedAt))return null;
  if(existingPlayer)return {kind:'existing_player',fid:String(rosterMember.fid)};
  return {kind:'new_discovery',fid:String(rosterMember.fid),username:rosterMember.username||'',previousState:null,destinationState:'3573',destinationAlliance:rosterMember.allianceTag||'',firstDetectedAt:detectedAt,confidence:'previous_state_unknown'};
}
export function upsertTransferEvent(events, incoming) {
  if(!incoming?.id||!timestamp(incoming.firstDetectedAt))throw Error('Invalid transfer event');
  const index=events.findIndex(e=>e.id===incoming.id);
  if(index<0)return [...events,incoming];
  const next=[...events];
  next[index]={...next[index],verifiedAt:incoming.verifiedAt||next[index].verifiedAt};
  return next;
}
export function transferFilterState(events,now=Date.now()) {
  const recent=events.filter(e=>e.confidence==='confirmed'&&timestamp(e.firstDetectedAt)!==null&&now>=timestamp(e.firstDetectedAt)&&now-timestamp(e.firstDetectedAt)<TRANSFER_PROMOTION_MS);
  return {in:recent.filter(e=>e.fromState!=='3573'&&e.toState==='3573').length,out:recent.filter(e=>e.fromState==='3573'&&e.toState!=='3573').length};
}
export function monthlyTransferHistory(events) {
  const groups=new Map();
  for(const event of events){
    if(event.confidence!=='confirmed'||!timestamp(event.firstDetectedAt))continue;
    const month=event.firstDetectedAt.slice(0,7);
    const group=groups.get(month)||{month,in:0,out:0,net:0,events:[]};
    if(event.toState==='3573'&&event.fromState!=='3573')group.in++;
    if(event.fromState==='3573'&&event.toState!=='3573')group.out++;
    group.net=group.in-group.out;group.events.push(event);groups.set(month,group);
  }
  return [...groups.values()].sort((a,b)=>b.month.localeCompare(a.month));
}
