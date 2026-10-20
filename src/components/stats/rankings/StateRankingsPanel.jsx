import {useState} from 'react';
import {C} from '../../../utils/constants.js';
import {PlayerAvatar} from '../../players/PlayerAvatar.jsx';
import {useStateRankings} from '../../../hooks/useStateRankings.js';
import {RANKING_BOARDS,filterRankingRows,rankingScore,rankingProfileUpdates,matchedRankingPlayer} from '../../../services/stateRankingsService.js';
const control={minHeight:44,background:C.section,color:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px',fontSize:14,boxSizing:'border-box'};
export function StateRankingsPanel({stateId,players,onUpdatePlayers,onViewPlayer,onClose,showToast}) {
  const [board,setBoard]=useState('personal_power'),[query,setQuery]=useState(''),[alliance,setAlliance]=useState(''),[minimum,setMinimum]=useState('');
  const {result,error,busy,refresh}=useStateRankings(stateId,board);
  const meta=RANKING_BOARDS.find(b=>b.key===board);
  const rows=result?filterRankingRows(result.rows,{query,alliance,minimum,board}):[];
  const tags=[...new Set((result?.rows || []).map(row=>row.allianceTag).filter(Boolean))].sort();
  const updates=result?rankingProfileUpdates(players,{...result,rows},stateId):[];
  function save(){try{onUpdatePlayers(updates);showToast(`${updates.length} profiles received ${meta.label.toLowerCase()} rankings ✓`);}catch(e){showToast(e.message,'error');}}
  function category(value){setBoard(value);setQuery('');setAlliance('');setMinimum('');}
  return <div style={{position:'fixed',inset:0,zIndex:600,background:C.bg,overflowY:'auto',maxWidth:480,margin:'0 auto',padding:20,boxSizing:'border-box',color:C.white}}>
    <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><h2 style={{fontSize:19}}>State {stateId} rankings</h2><button style={control} onClick={onClose}>Close</button></header>
    <label htmlFor="ranking-category" style={{fontSize:12,color:C.icy}}>Leaderboard</label>
    <select id="ranking-category" value={board} onChange={e=>category(e.target.value)} style={{...control,width:'100%',margin:'6px 0 10px'}}>{RANKING_BOARDS.map(b=><option key={b.key} value={b.key}>{b.label}</option>)}</select>
    <div style={{display:'flex',gap:8}}><input aria-label="Search ranking name or FID" style={{...control,flex:1,minWidth:0}} placeholder="Search name or FID" value={query} onChange={e=>setQuery(e.target.value)}/><button style={control} onClick={refresh} disabled={busy}>Refresh</button></div>
    <div style={{display:'flex',gap:8,marginTop:8}}><select aria-label="Ranking alliance filter" style={{...control,flex:1,minWidth:0}} value={alliance} onChange={e=>setAlliance(e.target.value)}><option value="">All alliances</option>{tags.map(tag=><option key={tag} value={tag}>[{tag}]</option>)}</select><input aria-label="Minimum ranking score" style={{...control,width:'45%'}} inputMode="decimal" placeholder={board==='furnace'?'Minimum FC tier':'Minimum score'} value={minimum} onChange={e=>setMinimum(e.target.value)}/></div>
    {board==='furnace' && <p style={{fontSize:11,color:C.muted}}>Minimum FC tier: enter 5 for FC5 and above.</p>}
    <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Published top 100 only. Filters apply to these results. A missing player is not necessarily unranked. Data may be up to an hour old. Sign in through Settings → Admin access to fetch.</p>
    {busy && <p role="status" style={{color:C.gold}}>Fetching {meta.label.toLowerCase()}…</p>}
    {error && <p role="alert" style={{color:C.red}}>{error}</p>}
    {result && <>
      <p style={{fontSize:12,color:C.icy}}>{rows.length} shown of {result.rows.length} returned · Pulled {new Date(result.retrievedAt).toISOString().replace('T',' ').replace(/\.\d+Z$/,' UTC')}</p>
      {!meta.alliance && <button style={{...control,width:'100%',background:updates.length?C.gold:C.section,color:updates.length?C.bg:C.muted,fontWeight:700}} disabled={!updates.length} onClick={save}>Save rankings to {updates.length} matching profiles</button>}
      <p style={{fontSize:11,color:C.muted}}>Profile saves add this ranking only. They preserve manually entered player data.</p>
      {!rows.length && <p>No rankings match these filters, or this board is not available yet.</p>}
      {rows.map((row,index)=>{const player=meta.alliance?null:matchedRankingPlayer(players,row.fid);return <article key={`${row.key}:${index}`} style={{padding:'14px 0',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:10}}>
        <strong style={{color:C.gold,minWidth:30}}>#{row.rank}</strong><PlayerAvatar player={row} size={36}/>
        <div style={{flex:1,minWidth:0}}><strong style={{overflowWrap:'anywhere'}}>{row.username}</strong><div style={{fontSize:12,color:C.muted,marginTop:4}}>{row.allianceTag?`[${row.allianceTag}] · `:''}{row.fid?`FID ${row.fid}`:meta.alliance?'Alliance ranking':'Chief ID unavailable'}</div>{player && <button style={{...control,minHeight:44,marginTop:6,color:C.icy}} onClick={()=>onViewPlayer(player.id)}>View profile</button>}</div>
        <strong style={{fontSize:14,textAlign:'right',maxWidth:'35%',overflowWrap:'anywhere'}}>{rankingScore(row,board)}</strong>
      </article>;})}
    </>}
  </div>;
}
