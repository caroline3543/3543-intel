import {C} from '../../utils/constants.js';
import {RANKING_BOARDS,rankingScore} from '../../services/stateRankingsService.js';
export function PlayerRankingsSection({player}) {
  const entries=Object.entries(player.providerRankings || {}).filter(([key])=>RANKING_BOARDS.some(b=>b.key===key));
  if(!entries.length)return null;
  return <section style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}><h3 style={{fontSize:14,color:C.icy,margin:'0 0 10px'}}>State rankings</h3>
    {entries.map(([key,row])=><div key={key} style={{padding:'10px 0',borderBottom:`1px solid ${C.border}`}}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><span>{RANKING_BOARDS.find(b=>b.key===key).label}</span><strong style={{color:C.gold}}>#{row.rank} · {rankingScore(row,key)}</strong></div><div style={{fontSize:11,color:C.muted,marginTop:4}}>State {row.stateId} · Whiteout Stats{row.retrievedAt && Number.isFinite(Date.parse(row.retrievedAt))?` · ${new Date(row.retrievedAt).toISOString().slice(0,16).replace('T',' ')} UTC`:''}</div></div>)}
  </section>;
}
