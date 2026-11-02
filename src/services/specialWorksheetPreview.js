import {normalizeStateId} from './stateWorkspaceService.js';
import {normalizeChiefId} from './spreadsheetMappingService.js';

const RULES={
 Combat:{required:['Player ID','State','Alliance','Troop Type'],types:['Infantry','Lancer','Marksman'],numeric:['Attack %','Defence %','Health %','Lethality %','Rally Capacity','March Capacity']},
 Events:{required:['Player ID','State','Alliance'],numeric:['Event Troop Power','Contribution']},
};
export function previewSpecialWorksheet({type,values,players,stateId}){
 const rules=RULES[type];if(!rules)throw Error('Unknown worksheet');
 const state=normalizeStateId(stateId);
 const headers=(values?.[0]||[]).map(x=>String(x??'').trim());
 const missing=rules.required.filter(h=>!headers.includes(h));
 if(missing.length)throw Error('Missing columns: '+missing.join(', '));
 if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw Error('Duplicate column headings');
 const col=h=>headers.indexOf(h), indexed=new Map();
 for(const p of players){const id=normalizeChiefId(p.fid);if(id){if(indexed.has(id))indexed.set(id,null);else indexed.set(id,p)}}
 const errors=[],matches=[],seen=new Set();
 for(let i=1;i<Math.min(values.length,102);i++){
  const cells=values[i]||[];if(!cells.some(v=>String(v??'').trim()))continue;
  const row=i+1,id=normalizeChiefId(cells[col('Player ID')]),rowState=String(cells[col('State')]??'').trim();
  const alliance=String(cells[col('Alliance')]??'').trim().toUpperCase();
  if(!id||!indexed.has(id)||indexed.get(id)===null){errors.push('Row '+row+': unknown or ambiguous Player ID');continue}
  const player=indexed.get(id);
  if(rowState!==state||String(player.allianceTag??'').toUpperCase()!==alliance){errors.push('Row '+row+': state or alliance mismatch');continue}
  const troop=type==='Combat'?String(cells[col('Troop Type')]??'').trim():'';
  if(type==='Combat'&&!rules.types.includes(troop)){errors.push('Row '+row+': invalid troop type');continue}
  const eventId=type==='Events'?String(cells[col('Event ID')]??'').trim():'';
  const date=type==='Events'?String(cells[col('Event Date UTC')]??'').trim():'';
  const key=type==='Combat'?[id,troop].join(':'):[id,eventId,date].join(':');
  if(seen.has(key)){errors.push('Row '+row+': duplicate player/event or troop');continue}seen.add(key);
  const updates={};let invalid=false;
  for(const name of rules.numeric){const c=col(name);if(c<0)continue;const raw=String(cells[c]??'').trim();if(!raw)continue;
   const n=Number(raw.replace(/,/g,''));if(!Number.isFinite(n)||n<0||n>1e12||(name.endsWith('%')&&n>100000)){errors.push('Row '+row+': invalid '+name);invalid=true;break}updates[name]=n;
  }
  if(invalid)continue;
  for(const name of (type==='Combat'?['Battle Role','Battle Type','Battle Report Date','Evidence URL']:['Event Type','Event Date UTC','Registered','Attendance Status','Assigned Team','Assigned Role','Assigned Building','Assignment Confirmed'])){const c=col(name);if(c>=0&&String(cells[c]??'').trim())updates[name]=String(cells[c]).trim().slice(0,200)}
  matches.push({row,playerId:player.id,fid:id,username:player.username,troopType:troop,eventId,updates});
 }
 return {type,stateId:state,matched:matches.length,errors,matches,canApply:false};
}
