/** Only explicitly confirmed skill-5 joiner heroes are eligible for import. */
export function parseJoinerHeroes(value) {
 const raw=String(value??'').trim();
 if(!raw)return [];
 const entries=raw.split(/[;,\n]+/).map(v=>v.trim()).filter(Boolean);
 if(entries.length>30)throw Error('Too many joiner heroes');
 const seen=new Set();
 return entries.map(entry=>{
  const match=/^([^:]{2,60}):\s*([1-5])$/.exec(entry);
  if(!match)throw Error('Specify Hero Name:5 for each qualified joiner');
  const hero=match[1].trim(),skillLevel=Number(match[2]),key=hero.toLocaleLowerCase();
  if(skillLevel!==5)throw Error(hero+' is not skill level 5; only level-5 joiners are collected');
  if(seen.has(key))throw Error('Duplicate joiner hero: '+hero);
  seen.add(key);
  return {hero,skillLevel:5};
 });
}
