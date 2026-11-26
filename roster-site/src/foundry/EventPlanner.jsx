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
  return <FoundryTab key={plannerKey(kind,alliance,legion)} {...props} kind={kind} chosen={alliance} legion={legion} players={players}
    changeSelection={(tag,number)=>{setAlliance(tag);setLegion(number);localStorage.setItem(storageKey,tag);}}
    otherLegion={otherLegion} otherPlan={otherPlan}
    screenshotStorage={storage}
    onSaveScreenshotPowers={onScreenshotUpdate || (action => {
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
    onNewEvent={()=>update({plan:{occurrenceId:plannerKey(kind,alliance,legion)+':'+crypto.randomUUID(),
      teamCount:plan.teamCount,teamNames:plan.teamNames,shareInstructions:plan.shareInstructions,
      registrations:{},registeredUnder:{},teams:{},assignments:{}}})}/>;
}
