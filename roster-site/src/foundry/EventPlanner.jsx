import {useState} from 'react';
import {FoundryTab} from './FoundryTab.jsx';
import {plannerKey,plannerSlot} from '../../../src/services/eventPlanner.js';

export function EventPlanner({kind,players,storage,onUpdate,...props}) {
  const storageKey='caroline3573_'+kind+'_alliance';
  const [alliance,setAlliance]=useState(()=>localStorage.getItem(storageKey)||'ARC');
  const [legion,setLegion]=useState(1);
  const plan=plannerSlot(storage,kind,alliance,legion);
  const otherLegion=legion===1?2:1;
  const otherPlan=plannerSlot(storage,kind,alliance,otherLegion);
  const update=fields=>onUpdate({kind,alliance,legion,expectedOccurrenceId:plan.occurrenceId,...fields});
  return <FoundryTab key={plan.occurrenceId} {...props} kind={kind} chosen={alliance} legion={legion} players={players}
    changeSelection={(tag,number)=>{setAlliance(tag);setLegion(tag===alliance?number:1);localStorage.setItem(storageKey,tag);}}
    otherLegion={otherLegion} otherPlan={otherPlan}
    onMoveLegion={(id,role)=>update({move:{id,role,sourceOccurrenceId:otherPlan.occurrenceId}})}
    sharedFoundry={plan} onSaveFoundry={(next,powers,expectedRegistrations)=>update({plan:next,powers,expectedRegistrations})}
    onSaveTroopPower={(id,value)=>update({powers:[{id,value}]})}
    onAttendance={attendance=>update({attendance})}
    onNewEvent={()=>update({plan:{occurrenceId:plannerKey(kind,alliance,legion)+':'+crypto.randomUUID(),
      teamCount:plan.teamCount,teamNames:plan.teamNames,shareInstructions:plan.shareInstructions,
      registrations:{},registeredUnder:{},teams:{},assignments:{}}})}/>;
}
