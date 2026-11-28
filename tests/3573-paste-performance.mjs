import assert from 'node:assert/strict';
import {cpus,platform,arch} from 'node:os';
import {parseRosterPaste} from '../roster-site/src/foundry/parseRosterPaste.js';
import {createScreenshotMatcher} from '../roster-site/src/foundry/screenshotImportPlan.js';

const roster=Array.from({length:1000},(_,i)=>({
 id:'sample-'+i, name:'Sample Player '+i, alliance:i%3===0?'HOT':'ARC',
 searchFields:['Historical name '+i,'Nickname '+i], fid:String(100000+i),
}));
const percentile=(values,p)=>values.slice().sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
const results=[];
for(const mode of ['exact','needs-review']){
 const eligible=roster.filter(p=>p.alliance==='ARC').slice(0,40);
 const pasted=eligible.map(p=>p.name.replace('Sample',mode==='exact'?'Sample':'Sampel')+'|10000|1|Combatant').join('\n');
 const samples=[];
 for(let trial=0;trial<20;trial++){
  let start=performance.now();
  const {rows,errors}=parseRosterPaste(pasted,1);
  const parseMs=performance.now()-start;
  assert.deepEqual(errors,[]);
  assert.equal(rows.length,40);
  start=performance.now();
  const matcher=createScreenshotMatcher(roster,'ARC');
  const matched=rows.map(row=>matcher(row.name,{source:row.source}));
  const matchingMs=performance.now()-start;
  assert.equal(matched.filter(match=>match.player).length,mode==='exact'?40:0);
  if(mode==='exact')assert.deepEqual(matched.map(match=>match.player.id),eligible.map(p=>p.id));
  samples.push({parseMs,matchingMs});
 }
 const parse=samples.map(s=>s.parseMs),matching=samples.map(s=>s.matchingMs);
 const result={mode,rows:40,roster:1000,runs:samples.length,parseMedianMs:percentile(parse,.5),parseP95Ms:percentile(parse,.95),
   coldMatchMedianMs:percentile(matching,.5),coldMatchP95Ms:percentile(matching,.95),coldMatchMaxMs:Math.max(...matching)};
 results.push(result);
 assert.ok(result.coldMatchP95Ms<250,'40-row cold match exceeded the 250 ms target');
}
console.log(JSON.stringify({environment:{node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model},results},null,2));
