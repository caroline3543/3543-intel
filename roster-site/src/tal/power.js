import {record,playerLabel} from './planner.js';
import {matchPollEntries} from '../../../src/services/talPoll.js';
export function parsePower(value){
 const text=String(value??'').trim();if(!text)return null;
 const m=text.match(/^((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*([kmb])?$/i);
 if(!m)throw Error('Use a whole number, such as 3,179.');
 const n=Number(m[1].replaceAll(',',''))*({k:1e3,m:1e6,b:1e9}[m[2]?.toLowerCase()]||1);
 if(!Number.isSafeInteger(n)||n<0)throw Error('Use a whole-number power.');return n;
}
export const fmtPower=value=>value==null?'Not entered':Number(value).toLocaleString('en-US');
export function troopPower(plan,p){try{return parsePower(record(plan,p).troopPower);}catch{return null;}}
export function comparePlayers(plan,mode='troop'){
 return (a,b)=>{
  if(mode==='game'){const rank=p=>Number(p.allianceRank?.match(/^R([1-5])$/)?.[1])||0;const diff=rank(b)-rank(a);if(diff)return diff;}
  if(mode==='game'||mode==='troop'){const av=troopPower(plan,a),bv=troopPower(plan,b);if(av==null||bv==null){if(av!==bv)return av==null?1:-1;}else if(av!==bv)return bv-av;}
  if(mode==='city'){const av=a.power??a.providerStats?.power,bv=b.power??b.providerStats?.power;if(av==null||bv==null){if(av!==bv)return av==null?1:-1;}else if(Number(av)!==Number(bv))return Number(bv)-Number(av);}
  return playerLabel(a).localeCompare(playerLabel(b))||String(a.id).localeCompare(String(b.id));
 };
}
export function teamPower(plan,team,players){
 const byId=new Map(players.map(p=>[p.id,p]));
 const unique=[...new Map(team.members.map(m=>[m.id,m])).values()];
 const entries=unique.map(m=>({m,p:byId.get(m.id)})).map(r=>({...r,value:r.p?troopPower(plan,r.p):null}));
 const known=entries.filter(r=>r.value!=null).sort((a,b)=>b.value-a.value);
 const confirmed=known.filter(r=>r.m.registered);
 const sum=rows=>rows.reduce((n,r)=>n+r.value,0);
 return {total:sum(known),planned:sum(known.slice(0,20)),confirmed:sum(confirmed.slice(0,20)),known:known.length,count:entries.length,missing:entries.filter(r=>r.value==null).length,registeredMissing:entries.filter(r=>r.m.registered&&r.value==null).length};
}
export function targetGap(value,target){return value<target?`${fmtPower(target-value)} below target`:value===target?'Target reached':`${fmtPower(value-target)} above target`;}
export function powerPastePreview(text,players,plan){
 const rows=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(line=>{
  const pair=line.match(/^(.*?)\s*[\t;]\s*([^\t;]+)$/)||line.match(/^(.*?)\s+((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*[kmb]?)$/i)||line.match(/^(.*?),\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*[kmb]?)$/i);
  if(!pair)return {line,error:'Use player ID or name, then power.'};
  const match=matchPollEntries(players,pair[1])[0];
  if(!match?.player)return {line,error:match?.ambiguous?'Name matches more than one player. Use an ID.':'No matching player in this legion.'};
  try{const value=parsePower(pair[2]);if(value==null)throw Error('Power is missing.');return {line,player:match.player,value,before:troopPower(plan,match.player)};}catch(e){return {line,error:e.message};}
 });
 const counts=new Map();for(const r of rows)if(r.player)counts.set(r.player.id,(counts.get(r.player.id)||0)+1);
 return rows.map(r=>r.player&&counts.get(r.player.id)>1?{...r,error:'Player appears twice. Keep one row.'}:r);
}
