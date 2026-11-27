import {useMemo,useState} from 'react';
import {FoundryTab} from './FoundryTab.jsx';
import {eventAssignments,plannerKey,plannerSlot,prepareEventRoles} from '../../../src/services/eventPlanner.js';

export function EventPlanner({kind,players,storage,onUpdate,onScreenshotUpdate,...props}) {
  const storageKey='caroline3573_'+kind+'_alliance';
  const [alliance,setAlliance]=useState(()=>localStorage.getItem(storageKey)||'ARC');
  const [legion,setLegion]=useState(1);
  const plan=plannerSlot(storage,kind,alliance,legion);
  const otherLegion=legion===1?2:1;
  const otherPlan=plannerSlot(storage,kind,alliance,otherLegion);
  const assignments=useMemo(()=>eventAssignments(storage,kind),[storage,kind]);
  const context={kind,alliance,legion,expectedOccurrenceId:plan.occurrenceId};
  const update=fields=>onUpdate({kind,alliance,legion,expectedOccurrenceId:plan.occurrenceId,...fields});
  return <FoundryTab key={plan.occurrenceId} {...props} kind={kind} chosen={alliance} legion={legion} players={players}
    changeSelection={(tag,number)=>{setAlliance(tag);setLegion(number);localStorage.setItem(storageKey,tag);}}
    otherLegion={otherLegion} otherPlan={otherPlan}
    screenshotStorage={storage}
    onSaveScreenshotPowers={onScreenshotUpdate || ((action, {verifyOnly=false}={}) => {
      if(verifyOnly){
        const slot=plannerSlot(storage,action.kind,action.alliance,action.legion);
        const matches=slot.occurrenceId===action.expectedOccurrenceId&&(action.powers??[]).every(row=>slot.powerByPlayer?.[row.id]===row.value)&&(action.roleChanges??[]).every(row=>(slot.registrations[row.id]||'')===row.role&&(!row.moveFrom||!plannerSlot(storage,action.kind,row.moveFrom.alliance,row.moveFrom.legion).registrations[row.id]));
        return matches?{message:'Preview save verified.'}:{error:'Preview save not confirmed.',pending:true};
      }
      onUpdate(action);
      return { message: 'Changes applied to this preview session.' };
    })}
    eventRegistrations={assignments}
    onChangeRoles={roleChanges=>{
      const {error}=prepareEventRoles(storage,context,roleChanges);
      if(error)return {error};
      update({roleChanges});
      return {};
    }}
    sharedFoundry={plan} onSaveFoundry={(next,powers)=>update({plan:next,powers})}
    onSaveTroopPower={(id,value)=>update({powers:[{id,value}]})}
    onAttendance={attendance=>update({attendance})}
    onResetPlanner={scope=>update({resetPlanner:{slots:(scope==='both'?[1,2]:[Number(scope)]).map(number=>({legion:number,expectedOccurrenceId:plannerSlot(storage,kind,alliance,number).occurrenceId,occurrenceId:plannerKey(kind,alliance,number)+':'+crypto.randomUUID()}))}})}
    onNewEvent={()=>update({plan:{occurrenceId:plannerKey(kind,alliance,legion)+':'+crypto.randomUUID(),
      teamCount:plan.teamCount,teamNames:plan.teamNames,shareInstructions:plan.shareInstructions,
      registrations:{},registeredUnder:{},teams:{},assignments:{}}})}/>;
}
