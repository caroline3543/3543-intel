import { C } from '../../utils/constants.js';
const label = key => key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()) + (['furnace_level','stove_lv','town_center_level'].includes(key) ? ' (provider code)' : '');
function Value({value}) {
  if (value === null) return <span style={{color:C.muted}}>Not supplied</span>;
  if (Array.isArray(value)) return value.length ? <ol style={{paddingLeft:20}}>{value.map((item,i)=><li key={i}><Value value={item}/></li>)}</ol> : <span>None</span>;
  if (typeof value === 'object') return <dl style={{margin:0}}>{Object.entries(value).map(([key,item])=><div key={key} style={{padding:'5px 0'}}><dt style={{color:C.muted}}>{label(key)}</dt><dd style={{margin:'3px 0 0',overflowWrap:'anywhere'}}><Value value={item}/></dd></div>)}</dl>;
  return <span>{typeof value === 'boolean' ? (value?'Yes':'No') : typeof value === 'number' ? value.toLocaleString('en-US') : String(value)}</span>;
}
export function ProviderStatsSection({player}) {
  const stats = player.providerStats;
  if (!stats && player.power == null && player.kills == null) return null;
  return <section style={{background:C.section,padding:16,borderRadius:12,marginBottom:12}}>
    <h3 style={{color:C.icy,fontSize:14,margin:'0 0 12px'}}>Player stats</h3>
    <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
      {[['Power',player.power ?? stats?.power],['Kills',player.kills ?? stats?.kills]].filter(([,v])=>v!=null).map(([name,value])=><div key={name}><div style={{fontSize:12,color:C.muted}}>{name}</div><strong style={{color:C.white,fontSize:20}}>{Number(value).toLocaleString('en-US')}</strong></div>)}
    </div>
    {player.furnaceLevel && <p style={{color:C.gold,fontSize:14}}>Furnace {player.furnaceLevel}</p>}
    {stats && <p style={{fontSize:11,color:C.muted}}>Whiteout Stats · State {stats.stateId} · [{stats.allianceTag}]{stats.retrievedAt ? ` · Pulled ${new Date(stats.retrievedAt).toISOString().replace('T',' ').replace('.000Z',' UTC')}` : ''}</p>}
    {stats?.raw && <details><summary style={{minHeight:44,display:'list-item',paddingTop:12,color:C.gold,cursor:'pointer'}}>All fetched player data</summary><div style={{fontSize:13,color:C.icy}}><Value value={stats.raw}/></div></details>}
  </section>;
}
