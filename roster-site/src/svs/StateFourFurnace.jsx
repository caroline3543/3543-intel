import {useState} from 'react';
import {providerFurnaceLevel} from '../../../src/services/providerProfileService.js';

export const MAIN_3573_ALLIANCES=['ARC','HOT','RKG','LUN'];
const TIERS=['FC10','FC9','FC8','FC7','FC6','FC5','FC4','FC3','FC2','FC1','Pre-FC','Unknown'];
const colors=['#89C4FF','#DDBE83','#A7D3B1','#BBA7E3'];
export function stateFourFurnace(players){
 const groups=Object.fromEntries(MAIN_3573_ALLIANCES.map(tag=>[tag,[]]));
 for(const p of players||[]){
  if(p.membershipStatus==='transferred_out'||String(p.stateId||'3573')!=='3573')continue;
  const tag=String(p.allianceTag||'').toUpperCase();
  if(!groups[tag])continue;
  const level=providerFurnaceLevel(p.furnaceLevel)||providerFurnaceLevel(p.providerStats?.furnaceLabel)||providerFurnaceLevel(p.providerStats?.furnaceLevel);
  const tier=level?.startsWith('FC')?level:level?.startsWith('F')?'Pre-FC':'Unknown';
  groups[tag].push({fid:p.fid,tier:TIERS.includes(tier)?tier:'Unknown'});
 }
 return MAIN_3573_ALLIANCES.map(tag=>({tag,players:groups[tag],counts:Object.fromEntries(TIERS.map(tier=>[tier,groups[tag].filter(p=>p.tier===tier).length]))}));
}
export function StateFourFurnace({players}){
 const [metric,setMetric]=useState('count');
 const groups=stateFourFurnace(players);
 const total=groups.reduce((n,g)=>n+g.players.length,0);
 const known=groups.reduce((n,g)=>n+g.players.filter(p=>p.tier!=='Unknown').length,0);
 const denominator=groups.map(g=>g.players.filter(p=>p.tier!=='Unknown').length);
 const scale=Math.max(1,...groups.flatMap((g,i)=>TIERS.map(t=>metric==='count'?g.counts[t]:denominator[i]?g.counts[t]/denominator[i]*100:0)));
 return <section aria-label="3573 top four furnace distribution" style={{background:'#15273A',border:'1px solid #344F69',borderRadius:15,padding:13,marginTop:13}}>
  <h3 style={{fontSize:17,margin:'0 0 5px'}}>3573 · Furnace distribution</h3>
  <p style={{fontSize:12,color:'#A8BFD5',margin:'0 0 13px'}}>ARC, HOT, RKG and LUN only · Saved player records</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginBottom:13}}>{groups.map((g,i)=><div key={g.tag} style={{background:'#102238',borderRadius:10,padding:10}}><strong style={{color:colors[i],fontSize:12}}>{g.tag}</strong><div style={{fontSize:23,fontWeight:750,fontVariantNumeric:'tabular-nums'}}>{g.players.length}</div><div style={{fontSize:11,color:'#A8BFD5'}}>{denominator[i]} known furnace levels</div></div>)}</div>
  <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',marginBottom:11}}><strong style={{fontSize:13}}>Players by furnace</strong><div role="group" aria-label="Furnace chart measure" style={{display:'flex',background:'#102238',padding:3,borderRadius:8}}>{[['count','Players'],['percent','%']].map(([id,label])=><button type="button" key={id} aria-pressed={metric===id} onClick={()=>setMetric(id)} style={{border:0,borderRadius:6,padding:'7px 9px',color:'#F2F7FD',background:metric===id?'#355879':'transparent'}}>{label}</button>)}</div></div>
  <div style={{display:'flex',gap:9,flexWrap:'wrap',marginBottom:10}}>{groups.map((g,i)=><span key={g.tag} style={{fontSize:11,color:colors[i]}}>● {g.tag}</span>)}</div>
  {TIERS.map((tier,index)=><div key={tier} style={{padding:'7px 6px',borderRadius:5,background:index%2?'#192F43':'transparent'}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}><strong>{tier}</strong><span style={{color:'#A8BFD5',fontVariantNumeric:'tabular-nums'}}>{groups.map((g,i)=>metric==='count'?g.counts[tier]:denominator[i]?(g.counts[tier]/denominator[i]*100).toFixed(1)+'%':'—').join(' / ')}</span></div>{groups.map((g,i)=>{const v=metric==='count'?g.counts[tier]:denominator[i]?g.counts[tier]/denominator[i]*100:0;return <div key={g.tag} style={{height:6,background:'#0B1929',borderRadius:5,overflow:'hidden',margin:'3px 0'}}><div style={{height:'100%',width:(v/scale*100)+'%',background:colors[i],borderRadius:5}}/></div>})}</div>)}
  <p style={{fontSize:11,color:'#A8BFD5',lineHeight:1.5,margin:'12px 0 0'}}>{total} saved players across the four alliances · {known} with known furnace levels. Percentages exclude unknown levels. This is a saved-roster snapshot, not proof that all members are current or that the full state has been counted.</p>
 </section>;
}
