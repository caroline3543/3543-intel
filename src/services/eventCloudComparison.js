/** Compare event backups without modifying RSVP, snapshots or squads. */
export function compareEventCopies(local,cloud){
 if(!local||!cloud||local.id!==cloud.id)throw Error('Event identity mismatch');
 const localIds=new Set(local.participantIds||[]),cloudIds=new Set(cloud.participantIds||[]);
 const added=[...cloudIds].filter(id=>!localIds.has(id)).length;
 const removed=[...localIds].filter(id=>!cloudIds.has(id)).length;
 const localSnaps=new Map((local.snapshots||[]).map(s=>[s.playerId,s]));
 const changedSnapshots=(cloud.snapshots||[]).filter(s=>JSON.stringify(s)!==JSON.stringify(localSnaps.get(s.playerId))).length;
 const changedSquads=JSON.stringify(local.squads||[])!==JSON.stringify(cloud.squads||[]);
 const changedDetails=['name','date','time','status','type','notes'].filter(k=>String(local[k]??'')!==String(cloud[k]??''));
 return {added,removed,changedSnapshots,changedSquads,changedDetails,unchanged:JSON.stringify(local)===JSON.stringify(cloud)};
}
