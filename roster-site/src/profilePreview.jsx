import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SoftDarkProfile} from '../../src/components/players/SoftDarkProfile.jsx';

const ago = hours => new Date(Date.now() - hours * 3600000).toISOString();
const teammate = {id:'sample-2',fid:'357300013',username:'Juniper'};
const complete = {
  id:'sample-1',fid:'357300012',username:'Northvale',allianceTag:'WAR',allianceRank:'R3',furnaceLevel:'FC6',
  country:'New Zealand',gameLanguage:'en',languages:['English'],
  membershipLastSuccessfulAt:ago(2.1),troopTiersChangedAt:ago(73),
  troops:{infantry:'FC6',lancer:'FC6',marksman:'FC5'},
  power:252451388,providerRankings:{labyrinth:{score:18420,rank:24}},kills:2121064,
  lastFoundryTroopPower:112400000,lastFoundryTroopPowerAt:ago(97),
  lastTalTroopPower:108700000,lastTalTroopPowerAt:ago(289),
  lastCanyonClashTroopPower:116200000,lastCanyonClashTroopPowerAt:ago(169),
  lastKnownLocation:{x:432,y:618,observedAt:ago(2.1)},
  allianceHistory:[
    {from:'LUN',to:'WAR',at:'2026-11-23T00:00:00Z'},{from:'ARC',to:'LUN',at:'2026-11-14T00:00:00Z'},
    {from:'HOT',to:'ARC',at:'2026-11-09T00:00:00Z'},{from:'RKG',to:'HOT',at:'2026-11-02T00:00:00Z'},
  ],
  joinerHeroes:[{hero:'Jessie',skillLevel:5,verified:true},{hero:'Seo-yoon',skillLevel:4,verified:true}],
  notes:'Prefers early UTC events.',
  totalHeroPower:16800000,totalPetPower:9200000,totalExpertPower:4600000,
};
const sparse = {id:'sample-1',fid:'357300012',username:'NorthvaleWithAVeryLongDecoratedUsername✦'};
const params = new URLSearchParams(window.location.search);

function Preview() {
  const [player,setPlayer] = useState(params.has('sparse') ? sparse : complete);
  const [open,setOpen] = useState(true);
  const [teamwork,setTeamwork] = useState({players:{[player.id]:{voice:true,reliable:true}},pairs:[[player.id,teammate.id]]});
  const editable = !params.has('readonly');
  return <main>
    <div style={{padding:'12px 16px'}}><small>Sample player · Preview only</small>{!open&&<p><button type="button" onClick={()=>setOpen(true)}>Open player profile</button></p>}</div>
    {open&&<SoftDarkProfile player={player} players={[player,teammate]} onClose={()=>setOpen(false)}
      onSave={editable ? setPlayer : undefined} teamworkPreferences={teamwork}
      onSaveTeamworkPreferences={editable ? setTeamwork : undefined} canFetchEquipment={false}/>}
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
