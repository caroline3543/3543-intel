// Conservative OCR matching: suggestions are never accepted automatically.
export function normalizeOcrName(value){
 return String(value||'').normalize('NFKC').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\s\p{P}\p{S}]/gu,'');
}
export function parseFoundryPaste(text){
 return String(text||'').split(/\r?\n|\r/).map((raw,index)=>{
  const line=raw.trim();
  if(!line||/^(name|username)\s*[,;]\s*(power|troop power)$/i.test(line))return null;
  const match=line.match(/^(.*?)(?:\s*[,;:\t]\s*|\s+[—–-]\s+|\s+)([\d,.]+\s*[mMkK]?)$/);
  const username=match?match[1].trim():line;
  const rawPower=match?match[2].trim():'';
  const v=rawPower.replace(/,/g,'').replace(/\s/g,'');
  const n=Number.parseFloat(v);
  const power=rawPower&&Number.isFinite(n)?n*(/[mM]$/.test(v)?1000000:/[kK]$/.test(v)?1000:1):null;
  return {key:index,raw:line,username,power:power===null?null:Math.round(power),rawPower};
 }).filter(Boolean);
}
export function findFoundryCandidates(username,players,alliance){
 const raw=String(username||'').trim().toLocaleLowerCase(),key=normalizeOcrName(username);
 return players.map(player=>{
  const fields=[player.name,...(player.searchFields||[]),player.id].filter(Boolean).map(String);
  const exact=fields.some(field=>field.trim().toLocaleLowerCase()===raw);
  const normalized=key.length>=3&&fields.some(field=>normalizeOcrName(field)===key);
  const partial=key.length>=3&&fields.some(field=>{const n=normalizeOcrName(field);return n.length>=3&&(n.includes(key)||key.includes(n))});
  const score=exact?100:normalized?90:partial?65:0;
  return {...player,score};
 }).filter(p=>p.score>0).sort((a,b)=>b.score-a.score||(a.alliance===alliance?-1:1)-(b.alliance===alliance?-1:1)).slice(0,8);
}
export function initialFoundryMatch(row,players,alliance){
 const candidates=findFoundryCandidates(row.username,players,alliance);
 const exact=candidates.filter(c=>c.score===100);
 return {candidates,matchedId:exact.length===1?exact[0].id:null};
}
export function foundryImportProblems(rows){
 const seen=new Set(),duplicates=[];
 for(const row of rows){if(!row.matchedId||row.matchedId==='new'||row.matchedId==='skip')continue;if(seen.has(row.matchedId))duplicates.push(row.matchedId);seen.add(row.matchedId);}
 return duplicates;
}
