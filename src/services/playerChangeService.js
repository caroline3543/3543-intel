import {playerObservations} from './playerObservationService.js';
import {providerFurnaceLevel} from './providerProfileService.js';
import {RANKING_BOARDS} from './stateRankingsService.js';
export const HISTORY_LABELS={username:'Name',allianceTag:'Alliance',power:'Power',kills:'Kills',furnaceLevel:'Furnace',score:'Score',rank:'Rank'};
export function streamLabel(stream){return stream==='profile'?'Player profile':RANKING_BOARDS.find(b=>`ranking:${b.key}`===stream)?.label || 'Ranking';}
export function historyValue(value,field,stream='profile'){
  if(value==null)return '—';
  if(stream==='ranking:furnace' && field==='score')return providerFurnaceLevel(value) || String(value);
  if(typeof value==='number')return value.toLocaleString('en-US');
  return String(value);
}
export function playerChangeFeed(players,stateId,{since=0,query='',kind='all',dropPercent=5,killGain=100000}={}){
  const q=query.trim().toLocaleLowerCase(),feed=[];
  for(const player of players){
    if(q && !`${player.username || ''} ${player.fid || ''} ${player.allianceTag || ''}`.toLocaleLowerCase().includes(q))continue;
    for(const event of playerObservations(player,stateId)){
      if(Date.parse(event.observedAt)<since)continue;
      for(const change of event.changes || []){
        const numeric=typeof change.before==='number' && typeof change.after==='number';
        const delta=numeric?change.after-change.before:null;
        let category=event.stream.startsWith('ranking:')?'ranking':change.field;
        const power=change.field==='power' || (event.stream==='ranking:personal_power' && change.field==='score');
        const kills=change.field==='kills' || (event.stream==='ranking:kills' && change.field==='score');
        if(event.stream==='ranking:furnace' && change.field==='score' && providerFurnaceLevel(change.before) && providerFurnaceLevel(change.before)===providerFurnaceLevel(change.after))continue;
        if(power && delta<0 && change.before>0 && -delta/change.before*100>=Number(dropPercent))category='powerDrop';
        if(kills && delta>=Number(killGain))category='killGain';
        if(event.stream==='ranking:furnace' && change.field==='score')category='furnaceLevel';
        if(kind!=='all' && category!==kind && !(kind==='ranking' && event.stream.startsWith('ranking:')))continue;
        feed.push({id:`${player.id}:${event.id}:${change.field}`,player,event,change,delta,category});
      }
    }
  }
  return feed.sort((a,b)=>Date.parse(b.event.observedAt)-Date.parse(a.event.observedAt) || a.id.localeCompare(b.id));
}
export function historyMetrics(player,stateId){
  const observations=playerObservations(player,stateId);
  const metrics=[];
  for(const [field,label] of [['power','Power'],['kills','Kills'],['furnaceLevel','Furnace']])if(observations.some(e=>e.stream==='profile' && e.fields?.includes(field)))metrics.push({key:`profile|${field}`,label,stream:'profile',field});
  for(const board of RANKING_BOARDS)for(const field of ['score','rank'])if(observations.some(e=>e.stream===`ranking:${board.key}` && e.fields?.includes(field)))metrics.push({key:`ranking:${board.key}|${field}`,label:`${board.label} · ${field}`,stream:`ranking:${board.key}`,field});
  return metrics;
}
export function historyPoints(player,stateId,metric){
  if(!metric)return [];
  return playerObservations(player,stateId).filter(e=>e.stream===metric.stream && e.fields?.includes(metric.field)).map(e=>{
    const raw=e.values[metric.field];
    const fc=typeof raw==='string'?raw.match(/^FC(\d+)$/):null;
    const base=typeof raw==='string'?raw.match(/^F(\d+)$/):null;
    const value=fc?30+Number(fc[1])*5:base?Number(base[1]):Number(raw);
    return {at:e.observedAt,value,label:historyValue(raw,metric.field,metric.stream)};
  }).filter(p=>Number.isFinite(p.value));
}
