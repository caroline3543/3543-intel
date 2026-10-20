import {RANKING_BOARDS} from '../../supabase/functions/whiteoutstats/rankings.js';
import {normalizeStateId} from './stateWorkspaceService.js';
import {providerFurnaceLevel} from './providerProfileService.js';
export {RANKING_BOARDS};
export function normalizeRankings(response,state,board) {
  const stateId=normalizeStateId(state), meta=RANKING_BOARDS.find(b=>b.key===board);
  if(!meta)throw new Error('Unknown ranking category.');
  const data=response?.data;
  if(!data || data.ok===false)throw new Error('Provider did not return rankings.');
  if(data.kid!=null && String(data.kid)!==stateId)throw new Error('Provider returned a different state.');
  if(data.board && typeof data.board==='string' && data.board!==board && String(data.board)!==String(meta.type))throw new Error('Provider returned a different ranking category.');
  const candidates=Array.isArray(data.boards) ? data.boards.find(b=>b.key===board || b.slug===board || Number(b.type)===meta.type) : data.boards?.[board] ?? data.boards?.[String(meta.type)];
  const selected=candidates ?? (typeof data.board==='object'?data.board:null);
  const rows=Array.isArray(data)?data : Array.isArray(selected)?selected : selected?.rows ?? selected?.entries ?? data.rows ?? data.entries ?? data.rankings ?? (meta.alliance?data.alliances:data.players);
  if(!Array.isArray(rows))throw new Error('Unrecognised rankings response. No profiles were changed.');
  const retrievedAt=response.retrieved_at || new Date().toISOString();
  return {stateId,board,retrievedAt,cachedAt:selected?.captured_at || data.captured_at || data.cached_at || null,rows:rows.map((row,index)=>{
    if(row.kid!=null && String(row.kid)!==stateId)throw new Error('Rankings contain a different state.');
    const fid=String(row.chief_id ?? row.fid ?? '');
    const score=row.score ?? row.value ?? (meta.field?row[meta.field]:null) ?? null;
    return {key:String(row.aid ?? (fid || row.uid || index)),fid:/^[1-9]\d*$/.test(fid)?fid:null,
      username:row.nick_name || row.name || 'Unknown',allianceTag:row.abbr || row.alliance_abbr || row.alliance?.abbr || '',
      avatarUrl:row.avatar_url || null,rank:Number.isInteger(Number(row.rank)) && Number(row.rank)>0?Number(row.rank):index+1,
      score,scoreLabel:row.score_label || row.value_label || null};
  })};
}
export function rankingScore(row,board) {
  if(row.scoreLabel)return row.scoreLabel;
  if(row.score==null || row.score==='')return '—';
  if(board==='furnace')return providerFurnaceLevel(row.score) || String(row.score);
  const number=Number(row.score);
  return Number.isFinite(number)?number.toLocaleString('en-US'):String(row.score);
}
export function filterRankingRows(rows,{query='',alliance='',minimum='',board=''}={}) {
  const q=query.trim().toLocaleLowerCase(), tag=alliance.trim().toLocaleLowerCase();
  const floor=minimum.trim()===''?null:Number(minimum.replace(/^FC\s*/i,''));
  const score=row=>board==='furnace' ? Number((providerFurnaceLevel(row.score) || 'F0').replace(/^FC/,'')) : Number(row.score);
  return rows.filter(row=>(!q || `${row.username} ${row.fid || ''}`.toLocaleLowerCase().includes(q))
    && (!tag || row.allianceTag.toLocaleLowerCase()===tag)
    && (floor===null || (row.score!=null && row.score!=='' && Number.isFinite(score(row)) && score(row)>=floor)));
}
export function matchedRankingPlayer(players,fid) {
  if(!fid)return null;
  const found=players.filter(p=>String(p.fid || '').trim()===fid);
  return found.length===1?found[0]:null;
}
export function rankingProfileUpdates(players,result,state) {
  if(result.stateId!==normalizeStateId(state))throw new Error('Switch to the correct state before saving rankings.');
  const meta=RANKING_BOARDS.find(b=>b.key===result.board);
  if(!meta || meta.alliance)return [];
  const seen=new Set(), updates=[];
  for(const row of result.rows) {
    const p=matchedRankingPlayer(players,row.fid);
    if(!p || row.score==null || row.score==='' || seen.has(p.id))continue;
    seen.add(p.id);
    updates.push({...p,providerRankings:{...p.providerRankings,[result.board]:{
      stateId:result.stateId,rank:row.rank,score:row.score,scoreLabel:row.scoreLabel,
      retrievedAt:result.retrievedAt,cachedAt:result.cachedAt,source:'Whiteout Stats',
    }}});
  }
  return updates;
}
