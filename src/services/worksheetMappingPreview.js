/** Read-only, deterministic worksheet mapping checks. Never updates roster records. */
export const IMPORT_FIELDS = [
  {key:'chief_id',label:'Player ID / FID',aliases:['player id','playerid','fid','chief id','chiefid','id'],authority:'identity'},
  {key:'state',label:'State',aliases:['state','state id','stateid'],authority:'identity'},
  {key:'username',label:'Username',aliases:['username','player name','name','chief name'],authority:'api'},
  {key:'alliance',label:'Alliance',aliases:['alliance','alliance tag','tag'],authority:'api'},
  {key:'furnace',label:'Furnace level',aliases:['furnace','furnace level','fc'],authority:'api'},
  {key:'power',label:'Power',aliases:['power','total power'],authority:'api'},
  {key:'infantry_tier',label:'Infantry troop level',aliases:['infantry troop level','infantry level','infantry tier','infantry t'],authority:'manual'},
  {key:'lancer_tier',label:'Lancer troop level',aliases:['lancer troop level','lancers level','lancer level','lancer tier'],authority:'manual'},
  {key:'marksman_tier',label:'Marksman troop level',aliases:['marksman troop level','marksmen level','marksman level','marksman tier'],authority:'manual'},
  {key:'foundry_troop_power',label:'Last known Foundry troop power',aliases:['foundry troop power','foundry power','last foundry troop power'],authority:'manual'},
  {key:'canyon_troop_power',label:'Last known Canyon Clash troop power',aliases:['canyon clash troop power','canyon troop power','canyon power'],authority:'manual'},
  {key:'troop_tier_verified_at',label:'Troop levels last verified',aliases:['troop levels verified','troop tier verified','troop level updated'],authority:'manual'},
  {key:'game_language',label:'In-game language',aliases:['game language','in-game language','in game language'],authority:'manual'},
  {key:'joiner_heroes',label:'Joiner heroes (summary)',aliases:['joiner heroes','joiners','joiner hero'],authority:'manual'},
  {key:'availability',label:'Availability',aliases:['availability','available','participation'],authority:'manual'},
  {key:'notes',label:'Notes',aliases:['notes','comments','comment'],authority:'manual'},
];
export const cleanHeader=v=>String(v??'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
export function detectMapping(headers) {
  const used=new Set();
  return Object.fromEntries(IMPORT_FIELDS.map(field=>{
    const at=headers.findIndex((h,i)=>!used.has(i)&&field.aliases.includes(cleanHeader(h)));
    if(at>=0)used.add(at);
    return [field.key,at>=0?String(at):''];
  }));
}
export function assessMapping(values,mapping) {
  const headers=Array.isArray(values?.[0])?values[0]:[];
  const mapped=Object.entries(mapping).filter(([,v])=>v!=='');
  const selected=mapped.map(([,v])=>Number(v));
  const duplicateColumns=selected.length!==new Set(selected).size;
  const missingId=mapping.chief_id===''||!Number.isInteger(Number(mapping.chief_id));
  const invalidColumns=selected.some(i=>!Number.isInteger(i)||i<0||i>=headers.length);
  const rows=(values||[]).slice(1,101).filter(row=>Array.isArray(row)&&row.some(v=>String(v??'').trim()!==''));
  const idIndex=Number(mapping.chief_id);
  const stateIndex=mapping.state===''?null:Number(mapping.state);
  const seen=new Set();
  const candidates=rows.map((cells,i)=>{
    const id=missingId?'':String(cells[idIndex]??'').trim();
    const state=stateIndex===null?'':String(cells[stateIndex]??'').trim();
    const key=state+':'+id;
    const validId=/^\d{4,15}$/.test(id);
    const duplicate=validId&&seen.has(key);
    if(validId)seen.add(key);
    return {sheetRow:i+2,id,state,validId,duplicate};
  });
  const invalidIds=candidates.filter(r=>!r.validId).length;
  const duplicates=candidates.filter(r=>r.duplicate).length;
  const errors=[
    ...(missingId?['Map the Player ID / FID column.']:[]),
    ...(duplicateColumns?['Each spreadsheet column can map to only one field.']:[]),
    ...(invalidColumns?['A mapped column does not exist.']:[]),
    ...(invalidIds?[invalidIds+' rows have invalid or missing Player IDs.']:[]),
    ...(duplicates?[duplicates+' rows have duplicate Player IDs within the same state.']:[]),
  ];
  return {headers,candidates,totalRows:rows.length,invalidIds,duplicates,errors,validForFutureImport:errors.length===0&&rows.length>0,readOnly:true};
}
