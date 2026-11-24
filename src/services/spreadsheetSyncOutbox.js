/**
 * Pure sync-outbox utilities. These prepare jobs; they do not perform writes.
 * Database worker must claim jobs atomically before executing.
 */
const DIRECTIONS = new Set(['db_to_sheet', 'sheet_to_db']);
export function canonicalJobKey({ connectionId, mappingId, recordId, fieldKey, direction, revision }) {
  const segments = [connectionId, mappingId, recordId, fieldKey, direction, revision];
  if (segments.some(v => v === null || v === undefined || String(v).length === 0)) throw new Error('Missing job identity');
  if (!DIRECTIONS.has(direction)) throw new Error('Invalid direction');
  // JSON tuple encoding avoids accidental key collisions with delimiters.
  return JSON.stringify(segments.map(String));
}
export function makeSyncJobs({connectionId,mappingId,operations,revision}) {
  if (!Array.isArray(operations)) throw new Error('Invalid operations');
  return operations.map(op=>{
    if (!DIRECTIONS.has(op.action==='write_sheet'?'db_to_sheet':op.action==='write_database'?'sheet_to_db':'invalid'))
      throw new Error('Cannot enqueue a conflict as a write');
    const direction = op.action === 'write_sheet' ? 'db_to_sheet' : 'sheet_to_db';
    return {
      connection_id:connectionId,
      mapping_id:mappingId,
      idempotency_key:canonicalJobKey({connectionId,mappingId,recordId:op.recordId,fieldKey:op.fieldKey,direction,revision}),
      direction,status:'pending',attempts:0,
      payload:{record_id:op.recordId,field_key:op.fieldKey,sheet_range:op.sheetRange,
        value:op.value,expected_database:op.expectedDatabase,expected_sheet:op.expectedSheet,
        expected_revision:revision},
    };
  });
}
export function retryDelayMs(attempt,random=0.5) {
  if (!Number.isSafeInteger(attempt)||attempt<1) throw new Error('Invalid attempt');
  if (!Number.isFinite(random)||random<0||random>1) throw new Error('Invalid jitter');
  const cap=Math.min(300000,1000*2**Math.min(attempt,9));
  return Math.round(cap*(0.5+random/2));
}
export function shouldRetry(status,attempt,maxAttempts=6) {
  return attempt<maxAttempts && (status===429 || status===408 || status>=500 && status<=599);
}
