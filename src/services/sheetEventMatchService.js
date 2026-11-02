/** Exact event ID + date matching. No fuzzy name or type-based assignments. */
export function proposeSheetEventPower({events=[],players=[]}){
 const proposals=[],conflicts=[];
 const byId=new Map(events.map(e=>[String(e.id),e]));
 for(const p of players)for(const [key,fields] of Object.entries(p.sheetEvents||{})){
  const separator=key.lastIndexOf('|');
  if(separator<1){conflicts.push({playerId:p.id,key,reason:'Missing event ID or date'});continue;}
  const eventId=key.slice(0,separator),date=key.slice(separator+1),event=byId.get(eventId);
  if(!event||String(event.date).slice(0,10)!==date){conflicts.push({playerId:p.id,key,reason:'Event ID/date not found'});continue;}
  if(!['Foundry','Canyon Clash'].includes(String(event.type))){conflicts.push({playerId:p.id,key,reason:'Event type does not use troop power'});continue;}
  if(!event.participantIds?.includes(p.id)){conflicts.push({playerId:p.id,key,reason:'Player is not an existing event participant'});continue;}
  const power=fields['Event Troop Power'];
  if(typeof power!=='number'||!Number.isFinite(power)||power<0||power>1e12)continue;
  const snapshot=(event.snapshots||[]).find(s=>s.playerId===p.id);
  if(!snapshot){conflicts.push({playerId:p.id,key,reason:'Participant snapshot missing'});continue;}
  if(snapshot.troopPower!==null&&snapshot.troopPower!==undefined&&Number(snapshot.troopPower)!==power){conflicts.push({playerId:p.id,key,reason:'Existing event troop power differs'});continue;}
  if(snapshot.troopPower!==null&&snapshot.troopPower!==undefined&&Number(snapshot.troopPower)===power)continue;
  proposals.push({eventId,playerId:p.id,playerName:p.username||p.fid,power,snapshotId:snapshot.snapshotId,key});
 }
 return {proposals,conflicts};
}
export function applySheetEventPowerProposal(event,proposal){
 if(event.id!==proposal.eventId||String(event.date).slice(0,10)!==proposal.key.slice(proposal.key.lastIndexOf('|')+1)||!event.participantIds?.includes(proposal.playerId))throw Error('Event participation changed');
 const snapshots=event.snapshots.map(s=>{
  if(s.playerId!==proposal.playerId)return s;
  if(s.snapshotId!==proposal.snapshotId||s.troopPower!=null)throw Error('Event snapshot changed');
  return {...s,troopPower:proposal.power};
 });
 if(!snapshots.some(s=>s.playerId===proposal.playerId))throw Error('Snapshot missing');
 return {...event,snapshots,updatedAt:new Date().toISOString()};
}
