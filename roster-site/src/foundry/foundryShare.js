/** Pure Foundry share-message formatting. Preserve usernames exactly as stored. */
export const FOUNDRY_DEFAULT_INSTRUCTIONS='Save 1 march to refill the closest building, another to join a rally and use the rest to garrison buildings.';
export const FOUNDRY_BUILDING_LABELS={
 'Prototype Site I':'Prototype I','Prototype Site II':'Prototype II',
 'Boiler Room':'Boiler','Central Transit Station':'Transit',
 'Repair Facility I':'Repair I','Repair Facility II':'Repair II',
 'Repair Facility III':'Repair III','Repair Facility IV':'Repair IV'
};
export const FOUNDRY_POSITIONS={Blue:'Top left',Pink:'Top right',Green:'Bottom left',Yellow:'Bottom right'};
export function foundryMessageStats(message){
 const value=String(message);
 return {characters:[...value].length,lines:value.split('\n').length};
}
export function foundryShareMessages({teamNames={},buildings={},active=[],teams={},assignments={},instructions=FOUNDRY_DEFAULT_INSTRUCTIONS,colours=['Blue','Yellow','Green','Pink']}){
 const block=colour=>{
  const title=String(teamNames[colour]||colour).trim()||colour;
  return [title.toUpperCase()+(FOUNDRY_POSITIONS[colour]?' · '+FOUNDRY_POSITIONS[colour]:''),...(buildings[colour]||[]).map(building=>{
   const label=FOUNDRY_BUILDING_LABELS[building]||building;
   const names=active.filter(player=>teams[player.id]===colour&&assignments[player.id]===building).map(player=>player.name);
   return label+' · '+names.join(', ');
  })].join('\n');
 };
 const pairs=[['Blue','Pink'],['Green','Yellow'],['Purple','Teal']]
  .map(pair=>pair.filter(colour=>colours.includes(colour))).filter(pair=>pair.length);
 return [
  ...pairs.map((pair,index)=>[pair.join(' + '),['INITIAL ASSIGNMENTS ('+(index+1)+'/'+pairs.length+')',...pair.map(block)].join('\n\n')]),
  ['Foundry instructions',['FOUNDRY INSTRUCTIONS',instructions].join('\n\n')]
 ];
}
