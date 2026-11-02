/** Parse explicitly supplied joiners. Format: Jessie:5; Norah:4. No inferred skill levels. */
export function parseJoinerHeroes(value) {
 const raw=String(value??'').trim();
 if(!raw)return [];
 const entries=raw.split(/[;,\n]+/).map(v=>v.trim()).filter(Boolean);
 if(entries.length>30)throw Error('Too many joiner heroes');
 const seen=new Set();
 return entries.map(entry=>{
  const match=/^([^:]{2,60}):\s*([1-5])$/.exec(entry);
  if(!match)throw Error('Use Hero Name:Skill Level (1-5), separated by semicolons');
  const hero=match[1].trim(),skillLevel=Number(match[2]),key=hero.toLocaleLowerCase();
  if(seen.has(key))throw Error('Duplicate joiner hero: '+hero);
  seen.add(key);
  return {hero,skillLevel};
 });
}
