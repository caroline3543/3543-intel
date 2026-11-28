import {useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {addRecordedLanguage} from '../../src/services/gameLanguageService.js';
import {NameChanges} from './components/NameChanges.jsx';
import {readPreferences,tapFeedback} from './preferences.js';
import {EventPlanner} from './foundry/EventPlanner.jsx';
import {SoftDarkProfile} from '../../src/components/players/SoftDarkProfile.jsx';
import {plannerKey,plannerSlot,updateEventPlanner} from '../../src/services/eventPlanner.js';

const players=['Northvale','Juniper','Solace','Ember','Tides','Kite','Lumen','Cypress','Aster','Wren'].map((username,index)=>({
  id:'sample-'+index,username,fid:String(357301200+index),allianceTag:'ARC',allianceRank:['R3','R2','R4','R3','R1','R3','R5'][index%7],furnaceLevel:'FC6',
  lastFoundryTroopPower:[3630,3630,15630,8200,7100,5900,4800,4200,4100,null][index],lastCanyonClashTroopPower:1520000000-index*135000000,
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
const pilotMode = new URLSearchParams(location.search).get('pilot') === 'rkg';
const previewStorageKey = '3573-event-preview-fixture-v1' + (pilotMode ? '-rkg' : '');

function readPilotRoster(data) {
  if (data.version !== 1 || !Array.isArray(data.players) || !data.players.length || data.players.length > 1000
      || !Array.isArray(data.legion2) || data.legion2.length > 30) throw Error('Choose the RKG pilot roster file.');
  const players = data.players.map(row => {
    if (typeof row?.fid !== 'string' || !/^[1-9]\d+$/.test(row.fid)
        || typeof row.username !== 'string' || !row.username.trim()
        || typeof row.allianceTag !== 'string') throw Error('The pilot roster contains an invalid player.');
    return {id:'pilot-'+row.fid,fid:row.fid,username:row.username,allianceTag:row.allianceTag,
      alias:typeof row.alias==='string'?row.alias:undefined,
      pastUsernames:Array.isArray(row.pastUsernames)?row.pastUsernames.filter(name=>typeof name==='string'):[]};
  });
  const ids = new Set(players.map(player=>player.fid));
  if (ids.size!==players.length || new Set(data.legion2).size!==data.legion2.length
      || data.legion2.some(fid=>!ids.has(fid))) throw Error('The pilot roster has duplicate or missing player IDs.');
  const key=plannerKey('canyon','RKG',2);
  const assigned=data.legion2.map(fid=>'pilot-'+fid);
  const legion={...plannerSlot(null,'canyon','RKG',2),
    registrations:Object.fromEntries(assigned.map(id=>[id,'join'])),
    registeredUnder:Object.fromEntries(assigned.map(id=>[id,'RKG']))};
  return {pilot:true,players,foundry:{eventPlans:{[key]:legion}}};
}
function previewWorkspace() {
  try { return JSON.parse(sessionStorage.getItem(previewStorageKey)) || { players, foundry }; }
  catch { return { players, foundry }; }
}

function Preview(){
  const [kind,setKind]=useState(pilotMode?'canyon':'foundry');
  const [pilotError,setPilotError]=useState('');
  const [opened,open]=useState(null);
  const [teamwork,setTeamwork]=useState({pairs:[['sample-7','sample-9']]});
  const [workspace,save]=useState(previewWorkspace);
  useEffect(()=>{try{sessionStorage.setItem(previewStorageKey,JSON.stringify(workspace));}catch{}},[workspace]);
  const saveScreenshot = (action,{verifyOnly=false}={}) => {
    if(verifyOnly){
      const persisted=previewWorkspace();
      const slot=plannerSlot(persisted.foundry,action.kind,action.alliance,action.legion);
      const field=action.kind==='foundry'?'lastFoundryTroopPower':'lastCanyonClashTroopPower';
      const matches=slot.occurrenceId===action.expectedOccurrenceId&&(action.powers??[]).every(row=>slot.powerByPlayer?.[row.id]===row.value&&persisted.players.find(p=>p.id===row.id)?.[field]===row.value)&&(action.roleChanges??[]).every(row=>(slot.registrations[row.id]||'')===row.role&&(!row.moveFrom||!plannerSlot(persisted.foundry,action.kind,row.moveFrom.alliance,row.moveFrom.legion).registrations[row.id]));
      return matches?{message:'Sample roster save verified.'}:{error:'Sample save not confirmed.',pending:true};
    }
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
  const rememberAlias=(id,reading)=>{
    const value=String(reading).trim().normalize('NFC');
    if(!value||value.length>128||!workspace.players.some(p=>p.id===id))return {error:'Invalid sample alias.'};
    const next={...workspace,players:workspace.players.map(p=>p.id===id?{...p,ocrAliases:[...new Set([...(p.ocrAliases??[]),value])]}:p)};
    try{sessionStorage.setItem(previewStorageKey,JSON.stringify(next));}catch{return {error:'Sample alias could not be saved.'};}
    save(next);return {verified:true};
  };
  async function loadPilot(event){
    const file=event.target.files[0];
    event.target.value='';
    if(!file)return;
    setPilotError('');
    try{
      if(file.size>1024*1024)throw Error('The pilot roster file must be under 1 MB.');
      const next=readPilotRoster(JSON.parse(await file.text()));
      sessionStorage.setItem(previewStorageKey,JSON.stringify(next));
      localStorage.setItem('caroline3573_canyon_alliance','RKG');
      save(next);
    }catch(error){
      setPilotError(error instanceof SyntaxError?'Choose the RKG pilot roster JSON file.':error.message);
    }
  }
  if(pilotMode&&!workspace.pilot)return <main style={{padding:'12px 16px'}}>
    <h1>RKG iPhone pilot</h1>
    <p>Load the roster file to test Canyon Clash. The roster and changes stay in this browser tab.</p>
    <label style={{display:'grid',gap:8}}>Load RKG pilot roster<input type="file" accept=".json,application/json" onChange={loadPilot}/></label>
    {pilotError&&<p role="alert">{pilotError}</p>}
  </main>;
  const profile=workspace.players.find(p=>p.id===opened);
  return <main>
    <p style={{padding:'4px 16px',color:'#afc1d3'}}>{pilotMode?'RKG pilot roster · Changes are saved in this tab':'Sample roster · Roster imports are saved in this tab'}</p>
    <nav aria-label="Choose event planner">
      <button aria-pressed={kind==='foundry'} onClick={()=>setKind('foundry')}>Foundry</button>
      <button aria-pressed={kind==='canyon'} onClick={()=>setKind('canyon')}>Canyon Clash</button>
      <button aria-pressed={kind==='changes'} onClick={()=>setKind('changes')}>Changes</button>
    </nav>
    {kind==='changes'?<NameChanges players={workspace.players} plan={{}} onOpen={open}/>:<EventPlanner key={kind} kind={kind} players={workspace.players} storage={workspace.foundry}
      onRoleFeedback={()=>tapFeedback(readPreferences().haptics,navigator,14)}
      onUpdate={action=>save(prev=>updateEventPlanner(prev,action))} onScreenshotUpdate={saveScreenshot} onRememberOcrAlias={rememberAlias} onOpenPlayerProfile={open}
      teamworkPreferences={teamwork} onSaveTeamworkPreferences={setTeamwork}
      onUpdatePlayerLanguage={(ids,language)=>save(prev=>({...prev,players:prev.players.map(player=>
        ids.includes(player.id)?addRecordedLanguage(player,language):player)}))}/>}
    {profile&&<SoftDarkProfile player={profile} players={workspace.players} onClose={()=>open(null)} canFetchEquipment={false}/>}
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
