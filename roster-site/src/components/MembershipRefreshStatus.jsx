import {C} from '../../../src/utils/constants.js';

export function MembershipRefreshStatus({refresh, error, revision, stale}) {
  return <div style={{padding:10,borderRadius:10,background:'#1A2C40',fontSize:12,lineHeight:1.6}}>
    {error && <div role="alert" style={{color:C.red}}>{error}</div>}
    <div role="status">
      {refresh ? <>
        <strong>{refresh.completedAt ? 'Move & transfer verification complete' : refresh.waiting ? 'Verifying moves · some checks waiting' : refresh.finished ? 'Verifying moves & transfers' : 'Move & transfer verification queued'}</strong>
        <div>{refresh.finished} of {refresh.queued} players checked</div>
        <div>{refresh.updated} changed · {refresh.unchanged} unchanged</div>
        <div>{refresh.missing} missing membership · {refresh.failed} failed</div>
        {refresh.superseded > 0 && <div>{refresh.superseded} already have newer information</div>}
        {(refresh.invalidFids > 0 || refresh.duplicateProfiles > 0) &&
          <div>{refresh.invalidFids} invalid player IDs · {refresh.duplicateProfiles} profiles with duplicate IDs</div>}
        {refresh.lastCompletedAt && <div>Last completed <time dateTime={refresh.lastCompletedAt}>{new Date(refresh.lastCompletedAt).toLocaleString()}</time></div>}
        {!refresh.completedAt && Date.now()-Date.parse(refresh.lastWorkerAt||refresh.startedAt)>15*60*1000 &&
          <div style={{color:'#F0B25C'}}>The refresh worker has not checked in recently.</div>}
        {refresh.persisted > 0 && revision < refresh.workspaceRevision && <div>Waiting for roster sync…</div>}
      </> : !error && <div>No moves queued for verification</div>}
      <div>{stale} active players without a verified refresh in the past 72 hours</div>
    </div>
    {refresh && <details style={{marginTop:5}}>
      <summary>Refresh details</summary>
      <div>{refresh.requestsAttempted} provider calls · {refresh.httpSucceeded} HTTP successes</div>
      <div>{refresh.playerAttempts} player lookups attempted, including retries</div>
      <div>{refresh.validPlayers} valid player records · {refresh.validMembership} verified memberships</div>
      <div>{refresh.persisted} saved to the shared roster</div>
      {refresh.rateLimited > 0 && <div>{refresh.rateLimited} rate-limited provider calls</div>}
      {refresh.transportFailed > 0 && <div>{refresh.transportFailed} timed-out or disconnected calls</div>}
      {refresh.requestsUnconfirmed > 0 && <div>{refresh.requestsUnconfirmed} calls without a recorded response</div>}
    </details>}
  </div>;
}
