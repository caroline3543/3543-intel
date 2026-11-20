/**
 * Transfer navigation is driven only by confirmed, durable ledger events.
 * A new roster discovery with unknown origin must not appear as a transfer.
 */
const HOUR=60*60*1000;
const STATE='3573';
const validTime=value=>{const t=Date.parse(value||'');return Number.isFinite(t)?t:null;};
export function transferNavigation(events=[],now=Date.now()){
 const confirmed=events.filter(e=>e?.confidence==='confirmed'&&e.fromState&&e.toState&&e.fromState!==e.toState);
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
 const key=direction==='in'?'toState':'fromState';
 const other=direction==='in'?'fromState':'toState';
 const fids=new Set(events.filter(e=>e?.confidence==='confirmed'&&String(e[key])===STATE&&String(e[other])!==STATE).map(e=>String(e.fid)));
 return players.filter(p=>fids.has(String(p.fid)));
}
