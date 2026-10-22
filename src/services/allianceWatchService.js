import {allianceRows} from './allianceImportService.js';
import {providerProfilePatch} from './providerProfileService.js';

export const ALLIANCE_SNAPSHOT_LIMIT = 30;
export const ALLIANCE_WATCH_LIMIT = 5;
export function watchId(stateId, tag) {
  const state = String(stateId).trim(), name = String(tag).trim();
  if (!/^[1-9]\d{0,4}$/.test(state) || !/^[\p{L}\p{N}_-]{1,16}$/u.test(name)) throw new Error('Enter a valid state and alliance tag. Tags are case sensitive.');
  return `${state}:${name}`;
}
export function newAllianceWatch(stateId, tag) {
  return {id:watchId(stateId,tag),stateId:String(stateId),tag:tag.trim(),snapshots:[],powerSpikePercent:5};
}
export function allianceSnapshot(response, stateId, tag) {
  const rows = allianceRows(response,stateId,tag);
  if (!rows.length) throw new Error('No members returned. The last roster was kept; check the tag and try again.');
  const observedAt = response.retrieved_at || new Date().toISOString();
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error('Invalid observation time. Nothing was saved.');
  const members = rows.map(row => {
    const patch=providerProfilePatch(row);
    return {fid:row.fid,...Object.fromEntries(['username','furnaceLevel','power','kills','allianceRank'].filter(key=>patch[key]!=null).map(key=>[key,patch[key]]))};
  });
  return {observedAt:new Date(observedAt).toISOString(),members};
}
export function appendAllianceSnapshot(watch, snapshot) {
  const last = watch.snapshots.at(-1);
  if (last && Date.parse(snapshot.observedAt) <= Date.parse(last.observedAt)) return watch;
  return {...watch,snapshots:[...watch.snapshots,snapshot].slice(-ALLIANCE_SNAPSHOT_LIMIT)};
}
export function allianceChanges(watch, {since=0,kind='all',query=''}={}) {
  const result=[], q=query.trim().toLocaleLowerCase();
  const add = (snapshot, member, field, before, after) => {
    const delta=typeof before==='number' && typeof after==='number'?after-before:null;
    const percent=delta!=null && before>0?delta/before*100:null;
    const category=field==='power' && percent>=Number(watch.powerSpikePercent ?? 5)?'powerSpike':field==='power' && delta<0?'powerDrop':field;
    if (Date.parse(snapshot.observedAt)<since || (kind!=='all' && kind!==category) || (q && !`${member.username || ''} ${member.fid}`.toLocaleLowerCase().includes(q))) return;
    result.push({id:`${snapshot.observedAt}:${member.fid}:${field}`,at:snapshot.observedAt,member,field,before,after,delta,percent,category});
  };
  for(let i=1;i<watch.snapshots.length;i++) {
    const snapshot=watch.snapshots[i], previous=watch.snapshots[i-1];
    const before=new Map(previous.members.map(m=>[m.fid,m])), after=new Map(snapshot.members.map(m=>[m.fid,m]));
    for(const member of snapshot.members) {
      const old=before.get(member.fid);
      if(!old) {add(snapshot,member,'appeared',null,'Newly returned in roster');continue;}
      for(const field of ['furnaceLevel','power','kills','username','allianceRank']) if(old[field]!=null && member[field]!=null && old[field]!==member[field]) add(snapshot,member,field,old[field],member[field]);
    }
    for(const member of previous.members) if(!after.has(member.fid)) add(snapshot,member,'missing','Returned in previous roster','Not returned in latest roster');
  }
  return result.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at) || a.member.fid.localeCompare(b.member.fid));
}
export function allianceSummary(watch) {
  const latest=watch.snapshots.at(-1), previous=watch.snapshots.at(-2);
  const members=latest?.members || [], old=new Map((previous?.members || []).map(m=>[m.fid,m]));
  const known=members.filter(m=>typeof m.power==='number');
  const paired=members.filter(m=>typeof m.power==='number' && typeof old.get(m.fid)?.power==='number');
  const distribution={};
  for(const m of members) distribution[m.furnaceLevel || 'Unknown']=(distribution[m.furnaceLevel || 'Unknown'] || 0)+1;
  return {members:members.length,powerKnown:known.length,power:known.reduce((sum,m)=>sum+m.power,0),
    comparable:paired.length,powerDelta:paired.reduce((sum,m)=>sum+m.power-old.get(m.fid).power,0),distribution};
}
export function mergeAllianceWatches(left=[],right=[]) {
  const map=new Map(left.map(w=>[w.id,w]));
  for(const watch of right) {
    const old=map.get(watch.id);
    const snapshots=new Map([...(old?.snapshots || []),...(watch.snapshots || [])].map(s=>[s.observedAt,s]));
    map.set(watch.id,{...old,...watch,snapshots:[...snapshots.values()].sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)).slice(-ALLIANCE_SNAPSHOT_LIMIT)});
  }
  return [...map.values()];
}
