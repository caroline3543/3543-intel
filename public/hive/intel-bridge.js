(function(){
 'use strict';const scope=window.HiveEmbed;if(!scope || parent===window)return;
 // Keep workspace identity fixed, including after restoring a standalone backup.
 function send(message){parent.postMessage({...message,stateId:scope.stateId,alliance:scope.alliance},location.origin)}
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin || event.source!==parent || event.data?.type!=='intel:hive-roster')return;
  const payload=event.data.payload;
  try{
   if(readonly)throw Error('Open the editable planner to update its roster.');
   const result=HiveIntel.mergeRoster(state,payload,scope);
   if(JSON.stringify(result.plan)!==JSON.stringify(state))commit(()=>{state=result.plan;Hive.migrate(state)});
   send({type:'hive:sync-result',added:result.added,updated:result.updated});
  }catch(error){send({type:'hive:error',message:error.message})}
 });
 state.settings.state=state.members.length?state.settings.state:scope.stateId;
 state.settings.alliance=state.members.length?state.settings.alliance:scope.alliance;
 const stateInput=document.querySelector('[name="state"]'),tagInput=document.querySelector('[name="alliance"]');
 if(stateInput)stateInput.readOnly=true;if(tagInput)tagInput.readOnly=true;
 render();send({type:'hive:ready'});
})();
