/**
 * Transfer navigation is driven only by confirmed, durable ledger events.
 * A new roster discovery with unknown origin must not appear as a transfer.
 */
const HOUR=60*60*1000;
const STATE='3573';
const validTime=value=>{const t=Date.parse(value||'');return Number.isFinite(t)?t:null;};
export function normalizeTransferEvents(events=[]){
 return (Array.isArray(events)?events:[]).map(e=>({
  ...e, fid:String(e?.fid??''),
  fromState:e?.fromState??e?.from_state??null,
  toState:e?.toState??e?.to_state??null,
  firstDetectedAt:e?.firstDetectedAt??e?.first_detected_at??null,
  lastVerifiedAt:e?.lastVerifiedAt??e?.last_verified_at??null,
  fromAlliance:e?.fromAlliance??e?.from_alliance??null,
  toAlliance:e?.toAlliance??e?.to_alliance??null
 }));
}
export function transferNavigation(events=[],now=Date.now()){
 events=normalizeTransferEvents(events);
 const confirmed=events.filter(e=>e?.confidence==='confirmed'&&e.fromState&&e.toState&&String(e.fromState)!==String(e.toState));
 const inbound=confirmed.filter(e=>String(e.toState)===STATE);
 const outbound=confirmed.filter(e=>String(e.fromState)===STATE);
 const recent=list=>list.some(e=>{
   const at=validTime(e.firstDetectedAt);
   return at!==null&&at<=now&&now-at<72*HOUR;
 });
 return {
  promoted:recent(inbound)||recent(outbound),
  filters:[
   {key:'transferred_in',label:'Transferred In',count:inbound.length,promoted:recent(inbound)},
   {key:'transferred_out',label:'Transferred Out',count:outbound.length,promoted:recent(outbound)}
  ],
  transferredIn:inbound,
  transferredOut:outbound
 };
}
export function filterTransferPlayers(players=[],events=[],direction='out'){
 events=normalizeTransferEvents(events);
 const key=direction==='in'?'toState':'fromState';
 const other=direction==='in'?'fromState':'toState';
 const fids=new Set(events.filter(e=>e?.confidence==='confirmed'&&String(e[key])===STATE&&e[other]!=null&&String(e[other])!==STATE).map(e=>String(e.fid)));
 return players.filter(p=>fids.has(String(p.fid)));
}
