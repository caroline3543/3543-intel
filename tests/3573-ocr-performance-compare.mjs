import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const read=(w,t)=>readFile(`ocr-results-${w}-${t}.json`,'utf8').then(JSON.parse);
const baseline=await read(1,1);
const comparable=r=>({screenshots:r.screenshots.map(({ms,...s})=>s),scores:r.scores,avatarMetrics:r.avatarMetrics,negative:r.negative});
const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
const results=[];
for(let w=1;w<=4;w++){
 const trials=await Promise.all([1,2,3].map(t=>read(w,t)));
 for(const trial of trials)assert.deepEqual(comparable(trial),comparable(baseline),'Recognition changed with worker count '+w);
 results.push({workers:w,recognitionMedianMs:median(trials.map(t=>t.recognitionBatchMs)),startupMedianMs:median(trials.map(t=>t.startupMs)),coldTotalMedianMs:median(trials.map(t=>t.startupMs+t.batchMs)),trials:trials.map(t=>({recognitionMs:t.recognitionBatchMs,startupMs:t.startupMs,batchMs:t.batchMs}))});
}
await writeFile('ocr-results-comparison.json',JSON.stringify({exactParity:true,results},null,2));
console.log(JSON.stringify(results,null,2));
