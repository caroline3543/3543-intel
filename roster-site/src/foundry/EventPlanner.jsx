import {useState} from 'react';
import {FoundryTab} from './FoundryTab.jsx';
import {plannerKey,plannerSlot} from '../../../src/services/eventPlanner.js';

export function EventPlanner({kind,players,storage,onUpdate,...props}) {
  const storageKey='caroline3573_'+kind+'_alliance';
  const [alliance,setAlliance]=useState(()=>localStorage.getItem(storageKey)||'ARC');
  const [legion,setLegion]=useState(1);
  const plan=plannerSlot(storage,kind,alliance,legion);
  const update=fields=>onUpdate({kind,alliance,legion,expectedOccurrenceId:plan.occurrenceId,...fields});
  return <FoundryTab key={plannerKey(kind,alliance,legion)} {...props} kind={kind} chosen={alliance} legion={legion} players={players}
    changeSelection={(tag,number)=>{setAlliance(tag);setLegion(tag===alliance?number:1);localStorage.setItem(storageKey,tag);}}
    sharedFoundry={plan} onSaveFoundry={(next,powers)=>update({plan:next,powers})}
    onSaveTroopPower={(id,value)=>update({powers:[{id,value}]})}
    onAttendance={attendance=>update({attendance})}
    onNewEvent={()=>update({plan:{occurrenceId:plannerKey(kind,alliance,legion)+':'+crypto.randomUUID(),
      teamCount:plan.teamCount,teamNames:plan.teamNames,shareInstructions:plan.shareInstructions,
      registrations:{},registeredUnder:{},teams:{},assignments:{}}})}/>;
}
