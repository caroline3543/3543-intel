import {record,playerLabel} from './planner.js';
const alphabet=new Intl.Collator('en',{sensitivity:'base',numeric:true});
export function moveMessageGroups(plan,players){
 const byId=new Map(players.map(p=>[p.id,p])),groups=new Map();
 for(const team of plan.teams){
  const seen=new Set();
  for(const member of team.members){
   if(seen.has(member.id))continue;seen.add(member.id);
   const p=byId.get(member.id);if(!p)continue;
   const home=record(plan,p).homeAlliance||'Unknown alliance',key=JSON.stringify([home,team.id]);
   if(!groups.has(key))groups.set(key,{id:key,home,team,players:[]});groups.get(key).players.push(p);
  }
 }
 return [...groups.values()].sort((a,b)=>alphabet.compare(a.home,b.home)||alphabet.compare(a.team.host,b.team.host)||a.team.number-b.team.number).map(group=>{
  group.players.sort((a,b)=>alphabet.compare(playerLabel(a),playerLabel(b))||String(a.id).localeCompare(String(b.id)));
  const title=`${group.home} players ${group.home.toLowerCase()===group.team.host.toLowerCase()?'staying in':'going to'} ${group.team.host} for Legion ${group.team.number}`;
  const heading=`${title}\nPrimary times: ${group.team.slots.length?group.team.slots.map(t=>t+' UTC').join(', '):'Not set'}`;
  return {...group,title,heading,text:[heading,...group.players.map(playerLabel)].join('\n')};
 });
}
// Discord has a 2,000-character message limit. Leave room for fences and headings.
export function discordBlocks(group){
 const clean=value=>String(value).replaceAll('```','``\u200b`');
 const heading=clean(group.heading),blocks=[];let lines=[heading],length=heading.length;
 for(const p of group.players){const name=clean(playerLabel(p));if(length+name.length+1>1850&&lines.length>1){blocks.push('```\n'+lines.join('\n')+'\n```');lines=[heading];length=heading.length;}lines.push(name);length+=name.length+1;}
 blocks.push('```\n'+lines.join('\n')+'\n```');return blocks;
}
