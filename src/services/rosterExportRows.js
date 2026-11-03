export const ROSTER_HEADERS = ['State','Home alliance','Username','Player ID','Rally leader / joiner','Power','Furnace level','Labyrinth rank','Labyrinth score','Infantry troop level','Lancer troop level','Marksman troop level','Last Canyon Clash troop power','Canyon Clash recorded (UTC)','Last Foundry troop power','Foundry recorded (UTC)','Last Tundra Arms League troop power','TAL recorded (UTC)','Last Frostdragon Tyrant troop power','Frostdragon recorded (UTC)','Joiner heroes','Rally leader heroes'];
const numeric = v => v == null || String(v).trim()==='' || !Number.isFinite(Number(v)) ? '' : Number(v);
function eventKind(event) {
  const type=String(event.type||'').toLowerCase().replace(/[^a-z]/g,'');
  const name=String(event.name||'').toLowerCase().replace(/[^a-z]/g,'');
  if(type==='custom' && name.includes('frostdragon')&&name.includes('tyrant'))return 'frostdragon';
  return ({canyonclash:'canyon',foundry:'foundry',tundraarmsleague:'tal',frostdragontyrant:'frostdragon'})[type];
}
export function latestTroopPowers(player, events=[]) {
  const latest={};
  function add(snapshot,event){
    const kind=eventKind(event), power=numeric(snapshot.troopPower);
    if(!kind || power==='' || power<0)return;
    const timestamp=snapshot.updatedAt||snapshot.createdAt||(event.date?`${event.date}T${event.time||'00:00'}:00Z`:'');
    const time=Date.parse(timestamp);
    if(!Number.isFinite(time))return;
    if(!latest[kind]||time>latest[kind].time)latest[kind]={power,time,date:new Date(time).toISOString().replace('T',' ').slice(0,19)};
  }
  for(const event of events) for(const snapshot of event.snapshots||[]) if(snapshot.playerId===player.id) add(snapshot,event);
  for(const snapshot of player.eventHistory||[]){const event=events.find(e=>e.id===snapshot.eventId)||{type:snapshot.eventType,date:snapshot.date,time:snapshot.time};add(snapshot,event);}
  return latest;
}
export function rosterExportRow(player,data={}) {
  const p=player,ranks=p.providerRankings?.labyrinth,details=p.providerDetails?.ranks;
  const lead=p.roles?.includes('Rally Lead')||['leader','both'].includes(p.leaderProfile?.role);
  const joiner=p.roles?.some(r=>/joiner/i.test(r))||['joiner','both'].includes(p.leaderProfile?.role)||(p.joinerHeroes||[]).length>0;
  const role=lead&&joiner?'Rally leader / Joiner':lead?'Rally leader':joiner?'Joiner':'';
  const powers=latestTroopPowers(p,data.events);
  const teams=(p.leaderProfile?.teams||[]).map(t=>(t.leadHeroes||[]).filter(Boolean).join(', ')).filter(Boolean).join('; ');
  return [String(data.settings?.stateId||''),p.allianceTag||'',p.username||p.alias||'',String(p.fid||''),role,numeric(p.power??p.providerStats?.power),p.furnaceLevel||'',numeric(ranks?.rank??details?.labyrinth_rank),numeric(ranks?.score??details?.labyrinth),p.troops?.infantry||'',p.troops?.lancer||'',p.troops?.marksman||'',...['canyon','foundry','tal','frostdragon'].flatMap(k=>[powers[k]?.power??'',powers[k]?.date||'']),(p.joinerHeroes||[]).map(h=>`${h.hero} (Skill ${h.skillLevel??'unknown'})`).join('; '),teams];
}
