import { normalizeStateId } from './stateWorkspaceService.js';
import { normalizeChiefId } from './spreadsheetMappingService.js';

/** Pure dry-run plan. Never mutates players, cloud data or Google Sheets. */
export function planStateRosterImport({values,mapping,players,stateId,worksheetAlliance}) {
 const state=normalizeStateId(stateId);
 const idColumn=mapping.chief_id===''?NaN:Number(mapping.chief_id);
 const stateColumn=mapping.state===''?null:Number(mapping.state);
 const allianceColumn=mapping.alliance===''?null:Number(mapping.alliance);
 const usernameColumn=mapping.username===''?null:Number(mapping.username);
 if(!Number.isSafeInteger(idColumn)||idColumn<0)throw new Error('Player ID column must be mapped');
 const ids=new Map(), duplicates=new Set();
 for(const player of players){
  const key=normalizeChiefId(player.fid);
  if(!key)continue;
  if(ids.has(key))duplicates.add(key);
  else ids.set(key,player);
 }
 const seen=new Set();
 const candidates=[],errors=[];
 const headers=values?.[0]||[];
 const safeRows=(values||[]).slice(1,101);
 for(let i=0;i<safeRows.length;i++){
  const cells=safeRows[i];
  if(!Array.isArray(cells)||!cells.some(c=>String(c??'').trim()))continue;
  const fid=normalizeChiefId(cells[idColumn]);
  const rowState=stateColumn===null?state:String(cells[stateColumn]??'').trim();
  const row=i+2;
  if(rowState!==state){errors.push('Row '+row+': wrong state '+rowState);continue;}
  const sheetAlliance=allianceColumn===null?'':String(cells[allianceColumn]??'').trim().toUpperCase();
  if(sheetAlliance&&worksheetAlliance&&sheetAlliance!==worksheetAlliance.toUpperCase()){errors.push('Row '+row+': worksheet alliance does not match row alliance');continue;}
  if(!fid){errors.push('Row '+row+': invalid Player ID');continue;}
  if(seen.has(fid)||duplicates.has(fid)){errors.push('Row '+row+': duplicate Player ID');continue;}
  seen.add(fid);
  const match=ids.get(fid);
  if(match&&match.providerStats?.stateId&&String(match.providerStats.stateId)!==state){errors.push('Row '+row+': player profile belongs to another state');continue;}
  if(match&&worksheetAlliance&&match.allianceTag&&String(match.allianceTag).toUpperCase()!==worksheetAlliance.toUpperCase()){
   errors.push('Row '+row+': alliance mismatch for '+fid);continue;
  }
  const manualFields={};
  for(const [field,property] of [['infantry_tier','infantry'],['lancer_tier','lancer'],['marksman_tier','marksman']]){
   const col=mapping[field]===''?NaN:Number(mapping[field]);
   if(Number.isInteger(col)&&col>=0&&String(cells[col]??'').trim()) manualFields[property]=String(cells[col]).trim();
  }
  const username=usernameColumn===null?'':String(cells[usernameColumn]??'').trim();
  const changed=!!match&&Object.entries(manualFields).some(([k,v])=>String(match.troops?.[k]??'')!==v);
  candidates.push({row,fid,kind:match?'existing':'new',manualFields,username,playerId:match?.id??null,changed});
 }
 return {stateId:state,worksheetAlliance,candidates,matched:candidates.filter(x=>x.kind==='existing').length,newPlayers:candidates.filter(x=>x.kind==='new').length,proposedChanges:candidates.filter(x=>x.changed).length,errors,readOnly:true,canApply:false,headers};
}
