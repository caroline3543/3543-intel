import {compareCell,normalizeChiefId,normalizeStateId,sheetCellRange} from './spreadsheetMappingService.js';

// Only user-maintained values may be proposed for export. API-owned identity,
// power, kills and furnace fields are deliberately excluded from this planner.
export const WRITABLE_COLUMNS=Object.freeze({
 'Availability':'sheetFields.availability',
 'Joiner Heroes':'sheetFields.joinerHeroes',
 'Infantry Troop Level':'troops.infantry',
 'Lancer Troop Level':'troops.lancer',
 'Marksman Troop Level':'troops.marksman',
});
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
const field=(obj,path)=>path.split('.').reduce((a,k)=>a?.[k],obj);
const equals=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
/**
 * Constructs proposals only. This never fetches or writes anything.
 * Baseline must come from a completed prior read/sync for the exact workbook.
 * Each proposed write carries the observed sheet value for a server-side recheck.
 */
export function planSheetWrites({stateId,spreadsheetId,worksheetTitle,players,rows,baseline}){
 const state=normalizeStateId(stateId);
 if(!state||!/^[A-Za-z0-9_-]{15,200}$/.test(String(spreadsheetId||'')))throw Error('Invalid state or workbook');
 if(!Array.isArray(rows)||!rows.length||!Array.isArray(players))throw Error('Missing worksheet or roster');
 if(!baseline||baseline.spreadsheetId!==spreadsheetId||baseline.stateId!==state||baseline.worksheetTitle!==worksheetTitle)throw Error('No matching trusted sync baseline. Refresh and establish a baseline before exporting.');
 const headers=rows[0].map(x=>String(x??'').trim());
 if(new Set(headers).size!==headers.length||!headers.includes('Player ID')||!headers.includes('State')||!headers.includes('Alliance'))throw Error('Worksheet identity columns missing or ambiguous');
 const col=name=>headers.indexOf(name),byId=new Map();
 for(const player of players){const fid=normalizeChiefId(player.fid);if(!fid)continue;if(byId.has(fid))byId.set(fid,null);else byId.set(fid,player)}
 const proposals=[],conflicts=[],seen=new Set();
 // Reject all occurrences of a duplicate ID before proposing any write.
 const counts=new Map();
 for(const values of rows.slice(1)){const id=normalizeChiefId(values?.[col('Player ID')]);if(id)counts.set(id,(counts.get(id)||0)+1)}
 for(let rowIndex=1;rowIndex<rows.length;rowIndex++){
  const values=rows[rowIndex]||[],fid=normalizeChiefId(values[col('Player ID')]);if(!fid)continue;
  if((counts.get(fid)||0)>1){conflicts.push({row:rowIndex+1,fid,reason:'Duplicate player ID'});continue}seen.add(fid);
  const player=byId.get(fid);
  if(!player||String(values[col('State')]??'').trim()!==state||String(values[col('Alliance')]??'').trim().toUpperCase()!==String(player.allianceTag||'').trim().toUpperCase()){conflicts.push({row:rowIndex+1,fid,reason:'Player identity, state or alliance mismatch'});continue}
  const prior=baseline.rows?.[fid];
  if(!prior){conflicts.push({row:rowIndex+1,fid,reason:'No trusted baseline for player'});continue}
  for(const [name,path] of Object.entries(WRITABLE_COLUMNS)){
   const index=col(name);if(index<0||!own(prior,name))continue;
   const current=String(values[index]??'').trim(),previous=String(prior[name]??'').trim(),local=String(field(player,path)??'').trim();
   const outcome=compareCell({baseline:previous,database:local,sheet:current});
   if(outcome.action==='conflict')conflicts.push({row:rowIndex+1,fid,column:name,reason:'Both app and Google changed this cell',baseline:previous,app:local,google:current});
   if(outcome.action==='write_sheet'&&!equals(local,current))proposals.push({fid,row:rowIndex+1,column:name,range:sheetCellRange(worksheetTitle,rowIndex+1,index),expected:current,value:local,baseline:previous});
  }
 }
 return {stateId:state,spreadsheetId,worksheetTitle,proposals,conflicts,canWrite:false};
}
