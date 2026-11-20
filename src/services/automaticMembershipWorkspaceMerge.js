import {applyVerifiedMembership,archiveStateTransfer} from './rosterViewService.js';
import {classifyLocation,upsertTransferEvent} from './automaticMembershipPolicy.js';

/**
 * Pure, optimistic workspace membership patch.
 * Caller MUST load the current workspace under a row lock and persist the
 * returned data + event ledger in ONE transaction with revision CAS.
 * No changes to manually maintained profile fields.
 */
export function planVerifiedMembershipUpdate({workspace,events=[],fid,observation,detectedAt}) {
  if(!workspace||!Array.isArray(workspace.players))throw Error('Invalid workspace');
  if(!observation||observation.status!=='verified'||!Number.isFinite(Date.parse(observation.at||'')))throw Error('Verified fresh membership observation required');
  const index=workspace.players.findIndex(p=>String(p.fid||'')===String(fid));
  if(index<0)throw Error('Player not found by stable FID');
  const previous=workspace.players[index];
  if(String(previous.fid)!==String(fid))throw Error('FID mismatch');
  const last=Date.parse(previous.membershipLastSuccessfulAt||previous.membershipObservedAt||'');
  if(Number.isFinite(last)&&Date.parse(observation.at)<last)return {workspace,events,changed:false,reason:'older_observation'};
  const decision=classifyLocation(previous,observation,detectedAt);
  if(decision.reason==='unverified')throw Error('Invalid state evidence');
  const updated=String(observation.state)==='3573'    ?applyVerifiedMembership(previous,observation)\n    :archiveStateTransfer(previous,observation,detectedAt);
  // Retain every original profile field not explicitly managed by the
  // membership service. Never replace a full player object with API payload.
  const players=workspace.players.slice();
  players[index]={...previous,...updated,membershipLastSuccessfulAt:observation.at};
  const nextEvents=decision.event?upsertTransferEvent(events,decision.event):events;
  return {workspace:{...workspace,players},events:nextEvents,changed:true,decision};
}

export async function commitVerifiedMembershipWithCas({
  loadLocked,saveTransaction,fid,observation,detectedAt,maxRetries=3
}) {
  if(typeof loadLocked!=='function'||typeof saveTransaction!=='function')throw Error('Atomic storage adapters required');
  for(let attempt=0;attempt<maxRetries;attempt++){
    // loadLocked and saveTransaction must share a transaction or use revision
    // compare-and-swap. The caller must reject stale revisions.
    const snapshot=await loadLocked();
    const plan=planVerifiedMembershipUpdate({...snapshot,fid,observation,detectedAt});
    if(!plan.changed)return plan;
    const applied=await saveTransaction({expectedRevision:snapshot.revision,workspace:plan.workspace,events:plan.events});
    if(applied===true)return plan;
  }
  throw Error('Concurrent workspace edits; retry on a later job');
}
