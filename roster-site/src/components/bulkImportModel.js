/** Shared across 3573 bulk-paste workflows. Never merge identities on fuzzy similarity. */
export function normaliseBulkName(value){
 return String(value||'').normalize('NFKC').toLocaleLowerCase().normalize('NFD').replace(/[\p{P}\p{S}\p{M}\s]/gu,'');
}
export function parseBulkPlayers(text,parsePower){
 return String(text||'').split(/\r?\n/).map((line,index)=>{
  const raw=line.trim();
  if(!raw||/^(name|username)\s*[,;\t]\s*(power|troop power)$/i.test(raw))return null;
  const match=raw.match(/^(.*?)(?:\s*[,;:\t]\s*|\s+[—–-]\s+|\s+)([\d,.]+\s*[mMkKbB]?)$/);
  const username=(match?.[1]||raw).trim(),powerText=(match?.[2]||'').trim();
  let power=null;
  if(powerText&&parsePower)power=parsePower(powerText);
  else if(powerText){
   const value=powerText.replace(/,/g,'').replace(/\s/g,'');
   const amount=Number.parseFloat(value);
   if(Number.isFinite(amount))power=amount*(/[mM]$/.test(value)?1000000:/[kK]$/.test(value)?1000:/[bB]$/.test(value)?1000000000:1);
  }
  return {key:index,raw,username,power,powerText};
 }).filter(Boolean);
}
export function createBulkCandidateSearch(players, preferredAlliance) {
 const indexed = players.map(player => ({
  player,
  fields: [...new Set([player.name, ...(player.searchFields || []), player.id].filter(Boolean).map(normaliseBulkName))],
  fid: String(player.playerId || player.fid || player.id),
 }));
 return name => {
  const raw = String(name || '').trim();
  const key = normaliseBulkName(name);
  const numeric = /^\d+$/.test(raw);
  const maxDistance = key.length >= 8 ? 2 : 1;
  const matches = [];
  for (const {player, fields, fid} of indexed) {
   const score = numeric && fid === raw ? 110
    : String(player.name || '').trim() === raw ? 100
    : key.length >= 3 && fields.includes(key) ? 90
    : key.length >= 4 && fields.some(field => field.length >= 4 && (field.includes(key) || key.includes(field) || withinDistance(field,key,maxDistance))) ? 60 : 0;
   if (score) matches.push({...player, score});
  }
  return matches.sort((a,b)=>b.score-a.score || Number(b.alliance===preferredAlliance)-Number(a.alliance===preferredAlliance) || a.name.localeCompare(b.name)).slice(0,8);
 };
}

export function bulkCandidates(name,players,preferredAlliance){
 return createBulkCandidateSearch(players,preferredAlliance)(name);
}

function withinDistance(a,b,limit){
 if(Math.abs(a.length-b.length)>limit)return false;
 const outside=limit+1;
 let previous=new Uint16Array(b.length+1), current=new Uint16Array(b.length+1);
 for(let j=0;j<=Math.min(limit,b.length);j++)previous[j]=j;
 if(limit<b.length)previous[limit+1]=outside;
 for(let i=1;i<=a.length;i++){
  const from=Math.max(1,i-limit), to=Math.min(b.length,i+limit);
  current[from-1]=from===1?i:outside;
  if(to<b.length)current[to+1]=outside;
  let best=outside;
  for(let j=from;j<=to;j++){
   current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+Number(a[i-1]!==b[j-1]));
   best=Math.min(best,current[j]);
  }
  if(best>limit)return false;
  [previous,current]=[current,previous];
 }
 return previous[b.length]<=limit;
}
export function resolveBulkRows(rows,players,choices={},powers={},alliance=''){
 return rows.map(row=>{
  const candidates=bulkCandidates(row.username,players,alliance);
  const automatic=candidates.filter(p=>p.score>=100&&(!alliance||p.alliance===alliance));
  const exactAcrossRoster=players.filter(p=>String(p.name||'').trim()===row.username||/^\d+$/.test(row.username)&&String(p.playerId||p.fid||p.id)===row.username);
  const safeAutomatic=automatic.length===1&&exactAcrossRoster.length===1&&automatic[0].id===exactAcrossRoster[0].id;
  const choice=choices[row.key];
  const id=choice===undefined&&safeAutomatic?automatic[0].id:choice;
  const player=players.find(p=>p.id===id)||null;
  const rawPower=powers[row.key]===undefined?row.power:String(powers[row.key]).trim()===''?null:Number(powers[row.key]);
  const status=choice==='skip'?'skip':choice==='new'?'new':player?(choice!==undefined?'approved':'exact'):'review';
  return {...row,candidates,player,status,power:rawPower};
 });
}
