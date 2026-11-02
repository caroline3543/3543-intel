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

/** Review only participants already present on both copies. No roster or squad changes. */
export function proposeSnapshotRestores(local,cloud){
 if(!local||!cloud||local.id!==cloud.id)throw Error('Event identity mismatch');
 const eligible=new Set(local.participantIds||[]);
 const cloudEligible=new Set(cloud.participantIds||[]);
 const localSnaps=new Map();
 for(const s of local.snapshots||[]){if(localSnaps.has(s.playerId))localSnaps.set(s.playerId,null);else localSnaps.set(s.playerId,s)}
 const result=[];
 for(const s of cloud.snapshots||[]){
  if(!eligible.has(s.playerId)||!cloudEligible.has(s.playerId))continue;
  const current=localSnaps.get(s.playerId);
  if(!current||!s.snapshotId||!current.snapshotId)continue;
  if((cloud.snapshots||[]).filter(x=>x.playerId===s.playerId).length!==1)continue;
  if(JSON.stringify(current)===JSON.stringify(s))continue;
  result.push({playerId:s.playerId,localSnapshotId:current.snapshotId,localSnapshot:current,cloudSnapshot:s});
 }
 return result;
}
export function applySnapshotRestore(local,proposal){
 if(!local.participantIds?.includes(proposal.playerId))throw Error('Participant was removed');
 const rows=(local.snapshots||[]).filter(s=>s.playerId===proposal.playerId);
 if(rows.length!==1||rows[0].snapshotId!==proposal.localSnapshotId||JSON.stringify(rows[0])!==JSON.stringify(proposal.localSnapshot))throw Error('Snapshot changed since review');
 return {...local,snapshots:local.snapshots.map(s=>s.playerId===proposal.playerId?{...proposal.cloudSnapshot,snapshotId:s.snapshotId}:s),updatedAt:new Date().toISOString()};
}
