import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {addRecordedLanguage} from '../../src/services/gameLanguageService.js';
import {NameChanges} from './components/NameChanges.jsx';
import {readPreferences,tapFeedback} from './preferences.js';
import {EventPlanner} from './foundry/EventPlanner.jsx';
import {SoftDarkProfile} from '../../src/components/players/SoftDarkProfile.jsx';
import {plannerKey,plannerSlot,updateEventPlanner} from '../../src/services/eventPlanner.js';

const players=['Northvale','Juniper','Solace','Ember','Tides','Kite','Lumen','Cypress','Aster','Wren'].map((username,index)=>({
  id:'sample-'+index,username,fid:String(357301200+index),allianceTag:'ARC',allianceRank:['R3','R2','R4','R3','R1','R3','R5'][index%7],furnaceLevel:'FC6',
  lastFoundryTroopPower:index===9?null:96000000-index*3500000,lastCanyonClashTroopPower:1520000000-index*135000000,
  ...(index===0?{allianceName:'Aurora',observationHistory:[
    {stream:'profile',observedAt:'2026-11-24T00:00:00Z',changes:[
      {field:'allianceTag',before:'LUN',after:'ARC'},{field:'username',before:'North Vale',after:'Northvale'},
    ]},
  ]}:{}),
  ...(index===7?{gameLanguage:'ko',languages:['Korean','Japanese']}:{}),
  lastTalTroopPower:98256120-index*3400000,troops:{infantry:'FC6',lancer:'FC6',marksman:'FC5'},
}));
const foundry={
  registrations:Object.fromEntries(players.slice(0,8).map((p,i)=>[p.id,i===6?'sub':i===7?'out':'join'])),
  registeredUnder:Object.fromEntries(players.slice(0,8).map(p=>[p.id,'ARC'])),teams:{},assignments:{},
  eventPlans:{[plannerKey('foundry','ARC',2)]:{...plannerSlot(null,'foundry','ARC',2),
    registrations:{'sample-8':'sub'},registeredUnder:{'sample-8':'ARC'}},
    [plannerKey('canyon','WAR',2)]:{...plannerSlot(null,'canyon','WAR',2),
      registrations:{'sample-9':'sub'},registeredUnder:{'sample-9':'WAR'}}},
};
const previewStorageKey = '3573-event-preview-fixture-v1';
function previewWorkspace() {
  try { return JSON.parse(sessionStorage.getItem(previewStorageKey)) || { players, foundry }; }
  catch { return { players, foundry }; }
}

function Preview(){
  const [kind,setKind]=useState('foundry');
  const [opened,open]=useState(null);
  const [teamwork,setTeamwork]=useState({pairs:[['sample-7','sample-9']]});
  const [workspace,save]=useState(previewWorkspace);
  const saveScreenshot = action => {
    const next = updateEventPlanner(workspace, action);
    if (next === workspace) return { error: 'The sample roster or event changed. Review the import again.' };
    try {
      sessionStorage.setItem(previewStorageKey, JSON.stringify(next));
    } catch {
      return { error: 'The sample roster could not be saved in this tab.' };
    }
    save(next);
    return { message: 'Saved to the sample roster in this tab.' };
  };
  const profile=workspace.players.find(p=>p.id===opened);
  return <main>
    <p style={{padding:'4px 16px',color:'#afc1d3'}}>Sample roster · Screenshot imports are saved in this tab</p>
    <nav aria-label="Choose event planner">
      <button aria-pressed={kind==='foundry'} onClick={()=>setKind('foundry')}>Foundry</button>
      <button aria-pressed={kind==='canyon'} onClick={()=>setKind('canyon')}>Canyon Clash</button>
      <button aria-pressed={kind==='changes'} onClick={()=>setKind('changes')}>Changes</button>
    </nav>
    {kind==='changes'?<NameChanges players={workspace.players} plan={{}} onOpen={open}/>:<EventPlanner key={kind} kind={kind} players={workspace.players} storage={workspace.foundry}
      onRoleFeedback={()=>tapFeedback(readPreferences().haptics,navigator,14)}
      onUpdate={action=>save(prev=>updateEventPlanner(prev,action))} onScreenshotUpdate={saveScreenshot} onOpenPlayerProfile={open}
      teamworkPreferences={teamwork} onSaveTeamworkPreferences={setTeamwork}
      onUpdatePlayerLanguage={(ids,language)=>save(prev=>({...prev,players:prev.players.map(player=>
        ids.includes(player.id)?addRecordedLanguage(player,language):player)}))}/>}
    {profile&&<SoftDarkProfile player={profile} players={workspace.players} onClose={()=>open(null)} canFetchEquipment={false}/>}
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
