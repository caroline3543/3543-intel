import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EventPlanner} from './foundry/EventPlanner.jsx';
import {SoftDarkProfile} from '../../src/components/players/SoftDarkProfile.jsx';
import {plannerKey,plannerSlot,updateEventPlanner} from '../../src/services/eventPlanner.js';

const players=['Northvale','Juniper','Solace','Ember','Tides','Kite','Lumen','Cypress','Aster','Wren','Harbour'].map((username,index)=>({
  id:'sample-'+index,username,fid:String(357301200+index),allianceTag:username==='Harbour'?'HOT':'ARC',allianceRank:['R3','R2','R4','R3','R1','R3','R5'][index%7],furnaceLevel:'FC6',
  lastFoundryTroopPower:index===9?null:96000000-index*3500000,lastCanyonClashTroopPower:1520000000-index*135000000,
  lastTalTroopPower:98256120-index*3400000,troops:{infantry:'FC6',lancer:'FC6',marksman:'FC5'},
}));
const foundry={
  registrations:Object.fromEntries(players.slice(0,8).map((p,i)=>[p.id,i===6?'sub':i===7?'out':'join'])),
  registeredUnder:Object.fromEntries(players.slice(0,8).map(p=>[p.id,'ARC'])),teams:{},assignments:{},
  eventPlans:{[plannerKey('foundry','ARC',2)]:{...plannerSlot(null,'foundry','ARC',2),
    registrations:{'sample-8':'sub'},registeredUnder:{'sample-8':'ARC'}}},
};
function Preview(){
  const [kind,setKind]=useState('foundry');
  const [opened,open]=useState(null);
  const [workspace,save]=useState({players,foundry});
  const profile=workspace.players.find(p=>p.id===opened);
  return <main>
    <p style={{padding:'4px 16px',color:'#afc1d3'}}>Sample roster · Changes last until reload</p>
    <nav aria-label="Choose event planner">
      <button aria-pressed={kind==='foundry'} onClick={()=>setKind('foundry')}>Foundry</button>
      <button aria-pressed={kind==='canyon'} onClick={()=>setKind('canyon')}>Canyon Clash</button>
    </nav>
    <EventPlanner key={kind} kind={kind} players={workspace.players} storage={workspace.foundry}
      onUpdate={action=>save(prev=>updateEventPlanner(prev,action))} onOpenPlayerProfile={open}/>
    {profile&&<SoftDarkProfile player={profile} players={workspace.players} onClose={()=>open(null)} canFetchEquipment={false}/>}
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
