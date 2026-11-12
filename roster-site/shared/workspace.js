export const WORKSPACE_ID='3573-leaders';
export const SHARED_KEYS=['players','events','customRoles','settings','talPlan','talTeamPreferences'];
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function sharedData(data){const out={};for(const key of SHARED_KEYS)if(data[key]!==undefined)out[key]=structuredClone(data[key]);return {...out,players:out.players||[],events:out.events||[],customRoles:out.customRoles||[],settings:{...out.settings,stateId:'3573'}};}
export function validateWorkspace(data){
 if(!plain(data)||Object.keys(data).some(k=>!SHARED_KEYS.includes(k)))throw Error('Unrecognised workspace fields.');
 if(!Array.isArray(data.players)||data.players.length>5000||!Array.isArray(data.events)||!Array.isArray(data.customRoles)||!plain(data.settings)||data.settings.stateId!=='3573')throw Error('Invalid State 3573 workspace.');
 const ids=new Set(),fids=new Set();
 for(const p of data.players){
  if(!plain(p)||typeof p.id!=='string'||!p.id||ids.has(p.id))throw Error('Player IDs must be unique.');ids.add(p.id);
  if(p.fid){const fid=String(p.fid).trim();if(!/^[1-9]\d{3,14}$/.test(fid)||fids.has(fid))throw Error('Game IDs must be valid and unique.');fids.add(fid);}
  for(const source of [p.providerStats,p.providerDetails,...Object.values(p.providerRankings||{})])if(source?.stateId&&String(source.stateId)!=='3573')throw Error('A profile belongs to another state.');
 }
 if(data.talTeamPreferences!=null){
  const prefs=data.talTeamPreferences;
  if(!plain(prefs)||!plain(prefs.players||{})||!Array.isArray(prefs.pairs||[]))throw Error('Invalid TAL teamwork preferences.');
  for(const [id,fields] of Object.entries(prefs.players||{})){
   if(!id||!plain(fields)||Object.entries(fields).some(([key,value])=>!['priority','reliable','strategy','voice','punctual'].includes(key)||typeof value!=='boolean'))throw Error('Invalid TAL teamwork player preference.');
  }
  if((prefs.pairs||[]).some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(id=>typeof id!=='string'||!id)||pair[0]===pair[1]))throw Error('Invalid TAL teamwork pairing.');
 }
 if(data.talPlan!=null){
  if(!plain(data.talPlan)||!Array.isArray(data.talPlan.teams||[])||!plain(data.talPlan.records||{}))throw Error('Invalid TAL plan.');
  const assigned=new Set(),teams=new Set();
  for(const t of data.talPlan.teams||[]){
   if(!plain(t)||typeof t.id!=='string'||teams.has(t.id)||!Array.isArray(t.members)||!Array.isArray(t.slots))throw Error('Invalid legion.');teams.add(t.id);
   for(const m of t.members){if(!plain(m)||typeof m.id!=='string'||assigned.has(m.id)||!['combatant','substitute','pending'].includes(m.role))throw Error('A player cannot be assigned to two legions.');if(m.role==='pending'&&m.registered)throw Error('Confirm the player role before registration.');assigned.add(m.id);}
   const proposed=new Set();for(const c of t.candidates||[]){if(!plain(c)||typeof c.id!=='string'||proposed.has(c.id))throw Error('Invalid proposed player.');proposed.add(c.id);}
   if(t.members.length>50)throw Error('A legion has more than 50 selected players.');
   // HOT Legion 1 has a legacy over-capacity roster (24 substitutes). Allow corrective saves
   // without allowing an increase above its recorded legacy ceiling; the UI remains capped at 20.
   const substituteCeiling=t.id==='HOT:1'?24:20;
   if(t.members.filter(m=>m.role==='combatant').length>30||t.members.filter(m=>m.role==='substitute').length>substituteCeiling)throw Error('A legion has too many players.');
  }
 }
 function scan(value,depth=0){if(depth>40)throw Error('Workspace is too deeply nested.');if(value&&typeof value==='object')for(const [key,v] of Object.entries(value)){if(['__proto__','prototype','constructor','ACCESS_PASSWORD_HASH','SESSION_SECRET','GAME_SITE_TOKEN'].includes(key))throw Error('Protected workspace field.');scan(v,depth+1);}}
 scan(data);return data;
}
export function sameWorkspaceValue(a,b){
 if(a===b)return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameWorkspaceValue(v,b[i]));
 if(plain(a)&&plain(b)){const ak=Object.keys(a).filter(k=>a[k]!==undefined).sort(),bk=Object.keys(b).filter(k=>b[k]!==undefined).sort();return ak.length===bk.length&&ak.every((k,i)=>k===bk[i]&&sameWorkspaceValue(a[k],b[k]));}return false;
}
const eq=sameWorkspaceValue;
const keyed=a=>Array.isArray(a)&&a.length>0&&a.every(v=>plain(v)&&typeof v.id==='string')&&new Set(a.map(v=>v.id)).size===a.length;
export function mergeWorkspace(base,mine,shared){
 const conflicts=[];
 function merge(b,m,s,path){
  if(eq(m,b))return structuredClone(s);if(eq(s,b)||eq(m,s))return structuredClone(m);
  if(plain(m)&&plain(s)&&(plain(b)||b===undefined)){
   const out={};for(const key of new Set([...Object.keys(b||{}),...Object.keys(m),...Object.keys(s)])){const v=merge(b?.[key],m[key],s[key],[...path,key]);if(v!==undefined)out[key]=v;}return out;
  }
  if(Array.isArray(m)&&Array.isArray(s)&&(keyed(m)||keyed(s))&&(Array.isArray(b)||b===undefined)&&[b||[],m,s].every(a=>a.length===0||keyed(a))){
   const bm=new Map((b||[]).map(v=>[v.id,v])),mm=new Map(m.map(v=>[v.id,v])),sm=new Map(s.map(v=>[v.id,v])),out=[];
   for(const id of new Set([...m.map(v=>v.id),...s.map(v=>v.id),...(b||[]).map(v=>v.id)])){const v=merge(bm.get(id),mm.get(id),sm.get(id),[...path,{id}]);if(v!==undefined)out.push(v);}return out;
  }
  conflicts.push({path,base:b,mine:m,shared:s});return structuredClone(m);
 }
 let data=merge(base||{},mine||{},shared||{},[]);
 try{validateWorkspace(data);}catch(error){
  // Concurrent cross-legion moves must be resolved as one assignment set.
  if(error.message==='A player cannot be assigned to two legions.'){
   conflicts.push({path:['talPlan','teams'],base:base?.talPlan?.teams,mine:mine?.talPlan?.teams,shared:shared?.talPlan?.teams});
   data={...data,talPlan:{...data.talPlan,teams:structuredClone(mine?.talPlan?.teams||[])}};
  }else{conflicts.push({path:[],base,mine,shared});data=structuredClone(mine);}
 }
 return {data,conflicts};
}
export function resolveConflicts(data,conflicts,side){
 const out=structuredClone(data);
 if(side==='mine')return validateWorkspace(out);
 for(const c of conflicts){if(!c.path.length)return validateWorkspace(structuredClone(c[side]));let obj=out;for(const part of c.path.slice(0,-1)){if(typeof part==='object')obj=obj.find(v=>v.id===part.id);else obj=obj[part];if(obj==null)break;}if(obj==null)continue;
  const key=c.path.at(-1),value=c[side];
  if(typeof key==='object'){const i=obj.findIndex(v=>v.id===key.id);if(value===undefined){if(i>=0)obj.splice(i,1);}else if(i>=0)obj[i]=structuredClone(value);else obj.push(structuredClone(value));}
  else if(value===undefined)delete obj[key];else obj[key]=structuredClone(value);
 }
 return validateWorkspace(out);
}
export function conflictLabel(conflict,data){
 if(!conflict.path.length)return 'Workspace structure';
 const labels={players:'Members',talPlan:'TAL plan',talTeamPreferences:'TAL teamwork defaults',pairs:'Working pairs',priority:'Priority joiner',reliable:'Reliable',strategy:'Strategy',voice:'Voice chat',punctual:'On time',records:'Player details',teams:'Legion assignments',members:'Legion players',username:'Username',alias:'Nickname',notes:'Notes',note:'Availability note',troopPower:'TAL troop power',times:'Availability',status:'Participation',homeAlliance:'Home alliance',allianceTag:'Alliance',allianceRank:'Alliance rank',troops:'Troop levels',infantry:'Infantry',lancer:'Lancers',marksman:'Marksmen',registered:'Registered in game',providerStats:'Game data',providerDetails:'Game profile',providerRankings:'Rankings',settings:'Settings',customRoles:'Custom roles'};
 return conflict.path.map((part,index)=>{const id=typeof part==='object'?part.id:conflict.path[index-1]==='records'?part:null;if(id)return data.players?.find(p=>p.id===id)?.username||id;return labels[part]||String(part);}).join(' › ');
}
