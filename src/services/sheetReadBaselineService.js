import {normalizeChiefId,normalizeStateId} from './spreadsheetMappingService.js';
import {WRITABLE_COLUMNS} from './sheetWritePlanService.js';

// A read-only snapshot of the exact Google values observed during review.
// This is NOT proof of freshness or approval to write: server must re-read
// every proposed cell immediately before performing any eventual write.
export function makeSheetReadBaseline({stateId,spreadsheetId,worksheetTitle,rows}){
 const state=normalizeStateId(stateId);
 if(!state||!/^[A-Za-z0-9_-]{15,200}$/.test(String(spreadsheetId||'')))throw Error('Invalid state or spreadsheet ID');
 if(typeof worksheetTitle!=='string'||!worksheetTitle.trim()||!Array.isArray(rows)||rows.length<1||rows.length>101)throw Error('Invalid or truncated worksheet');
 const headers=rows[0].map(v=>String(v??'').trim());
 if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw Error('Duplicate worksheet headings');
 for(const required of ['Player ID','State','Alliance'])if(!headers.includes(required))throw Error('Missing identity column: '+required);
 const index=Object.fromEntries(headers.map((h,i)=>[h,i])),saved={},seen=new Set();
 for(const row of rows.slice(1)){
  if(!(row||[]).some(v=>String(v??'').trim()))continue;
  const id=normalizeChiefId(row[index['Player ID']]);
  if(!id)throw Error('Missing or invalid player ID in baseline');
  if(seen.has(id))throw Error('Duplicate player ID in baseline');
  seen.add(id);
  if(String(row[index.State]??'').trim()!==state)throw Error('Cross-state worksheet row in baseline');
  const alliance=String(row[index.Alliance]??'').trim();
  if(!alliance)throw Error('Missing alliance in baseline');
  const cells={};
  for(const name of Object.keys(WRITABLE_COLUMNS))if(Object.hasOwn(index,name))cells[name]=String(row[index[name]]??'').trim();
  saved[id]=cells;
 }
 return {stateId:state,spreadsheetId,worksheetTitle,rows:saved,observedAt:new Date().toISOString(),readOnly:true};
}
