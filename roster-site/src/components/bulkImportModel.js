/** Shared across 3573 bulk-paste workflows. Never merge identities on fuzzy similarity. */
export function normaliseBulkName(value){
 return String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}\p{M}\s]/gu,'');
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
export function bulkCandidates(name,players,preferredAlliance){
 const raw=String(name||'').trim().toLocaleLowerCase(),key=normaliseBulkName(name);
 return players.map(player=>{
  const fields=[player.name,...(player.searchFields||[]),player.id].filter(Boolean).map(String);
  const idExact=String(player.playerId||player.fid||player.id)===String(name).trim()&&/^\d+$/.test(String(name).trim());
  const exact=String(player.name||'').trim()===String(name).trim();
  const normalized=key.length>=3&&fields.some(v=>normaliseBulkName(v)===key);
  const fuzzy=key.length>=4&&fields.some(v=>{const k=normaliseBulkName(v);return k.length>=4&&(k.includes(key)||key.includes(k)||editDistance(k,key)<=2)});
  const score=idExact?110:exact?100:normalized?90:fuzzy?60:0;
  return {...player,score};
 }).filter(p=>p.score>0).sort((a,b)=>b.score-a.score||(a.alliance===preferredAlliance?-1:1)||a.name.localeCompare(b.name)).slice(0,8);
}
function editDistance(a,b){
 if(Math.abs(a.length-b.length)>2)return 3;
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;if(Math.min(...row)>2)return 3;}
 return row[b.length];
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
