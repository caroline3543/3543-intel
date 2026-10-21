(function(root){
 'use strict';
 function mergeRoster(plan,payload,scope){
  if(payload?.version!==1 || String(payload.stateId)!==scope.stateId || payload.alliance!==scope.alliance || !Array.isArray(payload.players) || payload.players.length>500)throw Error('This roster belongs to a different workspace or is invalid.');
  if(plan.members.length && (String(plan.settings.state)!==scope.stateId || plan.settings.alliance!==scope.alliance))throw Error('The saved plan belongs to a different state or alliance. Restore a matching backup.');
  const next=JSON.parse(JSON.stringify(plan)),seen=new Set();let added=0,updated=0;
  for(const p of payload.players){
   if(!p || !/^\d+$/.test(p.fid) || seen.has(p.fid) || typeof p.name!=='string' || p.name.length>200)throw Error('Invalid or duplicate player ID in the roster.');
   seen.add(p.fid);
   const matches=next.members.filter(m=>m.playerId===p.fid);if(matches.length>1)throw Error('Resolve duplicate player IDs in the planner before syncing.');
   let member=matches[0];
   if(!member){member={id:`intel-${p.fid}`,name:p.name,playerId:p.fid,trap:0,role:'both',alliance:scope.alliance,priority:0,attendance:{1:{kind:'unknown',attended:null,total:null},2:{kind:'unknown',attended:null,total:null}},slot:null,current:null,locked:false,confirmed:false,verified:false,notes:''};if(next.members.some(m=>m.id===member.id))throw Error('Planner player ID conflict.');next.members.push(member);added++}else updated++;
   member.name=p.name;member.alliance=scope.alliance;
   const loc=p.location,valid=v=>Number.isInteger(v)&&v>=0&&v<=1199;
   if(loc && valid(loc.x)&&valid(loc.y) && (!member.currentObservedAt || Date.parse(loc.retrievedAt)>=Date.parse(member.currentObservedAt))){member.current={x:loc.x,y:loc.y};member.currentObservedAt=loc.retrievedAt || null}
  }
  if(next.members.length>500)throw Error('This plan exceeds the 500-player limit.');
  next.settings.state=scope.stateId;next.settings.alliance=scope.alliance;
  return{plan:next,added,updated};
 }
 const api={mergeRoster};if(typeof module!=='undefined')module.exports=api;else root.HiveIntel=api;
})(typeof window!=='undefined'?window:globalThis);
