/** Pure workbook builder: one state per workbook, one worksheet per alliance. */
export const ROSTER_HEADERS=[
'Player ID','Username','State','Alliance','Furnace Level','Total Power','Kills','Game Language',
'Infantry Troop Level','Lancer Troop Level','Marksman Troop Level',
'Foundry Troop Power','Canyon Clash Troop Power','Joiner Heroes','Availability','Last Verified'
];
export function normalizeWorkbookState(value){
 const raw=String(value??'').trim();
 if(!/^\d{1,5}$/.test(raw)||Number(raw)===0)throw Error('Invalid state ID');
 return String(Number(raw));
}
export function safeAllianceTag(value){
 const tag=String(value??'').trim().toUpperCase();
 return /^[A-Z0-9_-]{2,10}$/.test(tag)?tag:'UNALLIED';
}
export function makeStateWorkbook(stateId,players){
 const state=normalizeWorkbookState(stateId),groups=new Map();
 for(const p of players){
  if(normalizeWorkbookState(p.state_id)!==state)continue;
  const tag=safeAllianceTag(p.alliance_tag);
  if(!groups.has(tag))groups.set(tag,[]);
  const d=p.data||{};
  groups.get(tag).push([
   String(d.fid??p.id??''),String(d.username??''),state,tag,
   d.furnaceLevel??'',d.power??'',d.kills??'',d.gameLanguage??'',
   '', '', '',
   '', '', '', '',p.updated_at??''
  ]);
 }
 const alliances=[...groups.keys()].sort();
 if(alliances.length>90)throw Error('Too many alliances for one workbook');
 return {state,title:'3543 Intel - State '+state,worksheets:alliances.map(tag=>({
  title:tag,values:[ROSTER_HEADERS,...groups.get(tag).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]
 }))};
}
