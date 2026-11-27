import assert from 'node:assert/strict';
import { scoreScreenshot } from './3573-ocr-score.mjs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const retriesEnabled=process.env.ROSTER_OCR_RETRIES!=='0';
const workerCount=Number(process.env.ROSTER_OCR_WORKERS??1);
assert.ok(Number.isInteger(workerCount)&&workerCount>=1&&workerCount<=4);
const directory = resolve(process.env.ROSTER_SCREENSHOTS_DIR ?? '../screenshots');
const output = resolve(process.argv[2] ?? '../3573-ocr-results.json');
const negativePath=process.env.ROSTER_NEGATIVE_SCREENSHOT ? resolve(process.env.ROSTER_NEGATIVE_SCREENSHOT) : null;
const groundTruthPath=process.env.ROSTER_GROUND_TRUTH ? resolve(process.env.ROSTER_GROUND_TRUTH) : null;
const files = (await readdir(directory)).filter(name => /\.(?:png|jpe?g|webp)$/i.test(name)).sort();
assert.ok(files.length >= 1 && files.length <= 25, 'Put 1–25 original screenshots in ROSTER_SCREENSHOTS_DIR.');
const labels=groundTruthPath ? JSON.parse(await readFile(groundTruthPath,'utf8')) : null;
const rosterNames=[...new Set(Object.values(labels??{}).flatMap(s=>s.rows.map(r=>r.name)))];
process.chdir('roster-site');
const server = await createServer({ server:{ host:'127.0.0.1', port:5177, strictPort:true } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ executablePath:process.env.CHROMIUM_EXECUTABLE_PATH });
  const page = await browser.newPage({ viewport:{width:428,height:926}, isMobile:true, deviceScaleFactor:3 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5177/event-preview.html');
  const workerStarted = performance.now();
  await page.evaluate(async ({workerCount,rosterNames,retriesEnabled}) => {
    const reader = await import('/src/foundry/readRosterScreenshot.js');
    window.rosterReaders = await Promise.all(Array.from({length:workerCount},()=>reader.createRosterReader()));
    window.rosterReader=window.rosterReaders[0];
    window.scanRoster = reader.readRosterScreenshot;
    const {createScreenshotMatcher}=await import('/src/foundry/screenshotImportPlan.js');
    window.matchName=retriesEnabled ? createScreenshotMatcher(rosterNames.map((name,i)=>({name,id:String(i+1),alliance:'HOT'})),'HOT') : undefined;
  },{workerCount,rosterNames,retriesEnabled});
  const startupMs = Math.round(performance.now() - workerStarted);
  const batchStarted = performance.now();
  const screenshots = new Array(files.length);
  await Promise.all(Array.from({length:workerCount},async (_,workerIndex)=>{
  for(let index=workerIndex;index<files.length;index+=workerCount){
    const filename=files[index];
    const content = (await readFile(resolve(directory, filename))).toString('base64');
    const reading = await page.evaluate(async ({ filename, content, workerIndex }) => {
      const file = new File([Uint8Array.from(atob(content), char => char.charCodeAt(0))], filename);
      const started = performance.now();
      try {
        const data = await window.scanRoster(window.rosterReaders[workerIndex], file, {avatarBenchmark:true},{matchName:window.matchName});
        const ms=Math.round(performance.now()-started);
        const {screenshotAvatarEvidence}=await import('/src/foundry/screenshotAvatarEvidence.js');
        const {avatarDistance}=await import('/src/foundry/avatarFingerprint.js');
        const avatarStarted=performance.now();
        const cropChecks=[];
        for(const row of data.rows){
          const temporary=await screenshotAvatarEvidence(file,row.bounds);
          cropChecks.push({usable:!!temporary,distance:avatarDistance(temporary,row.avatarEvidence)});
        }
        return { filename, ms, ...data, cropChecks, cropMs:Math.round(performance.now()-avatarStarted) };
      } catch (error) {
        return { filename, error:error.message };
      }
    }, { filename, content, workerIndex });
    screenshots[index]=reading;
  }
  }));
  const recognitionBatchMs=Math.round(performance.now()-batchStarted);
  let negative=null;
  if(negativePath){
    const content=(await readFile(negativePath)).toString('base64');
    negative=await page.evaluate(async content=>{
      try{
        const file=new File([Uint8Array.from(atob(content),c=>c.charCodeAt(0))],'unsupported.jpeg');
        const result=await window.scanRoster(window.rosterReader,file);
        return {rejected:false,result};
      }catch(error){return {rejected:true,message:error.message};}
    },content);
  }
  const batchMs=Math.round(performance.now()-batchStarted);
  const scores=labels ? screenshots.map(actual=>{
    const expected=labels[actual.filename];
    assert.ok(expected,'Missing ground truth for '+actual.filename);
    return {filename:actual.filename,...scoreScreenshot(expected,actual)};
  }) : null;
  const cards=screenshots.flatMap(s=>s.rows??[]);
  const retryMetrics={rows:cards.length,rowsWithAlternatives:cards.filter(r=>r.nameAlternatives?.length).length,alternativeExactRecoveries:0};
  if(labels) for(const screenshot of screenshots) for(const row of screenshot.rows??[]){
    const label=labels[screenshot.filename].rows.find(l=>Math.abs(l.center-(row.bounds.top+row.bounds.bottom)/2)<=.035);
    if(label&&row.name!==label.name&&row.nameAlternatives?.includes(label.name))retryMetrics.alternativeExactRecoveries++;
  }
  const reviewMetrics=labels?await page.evaluate(async ({screenshots,labels,rosterNames})=>{
    const {createScreenshotMatcher}=await import('/src/foundry/screenshotImportPlan.js');
    const roster=rosterNames.map((name,i)=>({name,id:String(i+1),alliance:'HOT'}));
    const matcher=createScreenshotMatcher(roster,'HOT');
    const metrics={labelled:0,automaticCorrect:0,automaticWrong:0,manual:0,originalTop1:0,improvedTop1:0,originalTop8:0,improvedTop8:0};
    for(const screenshot of screenshots)for(const row of screenshot.rows??[]){
      const label=labels[screenshot.filename].rows.find(l=>Math.abs(l.center-(row.bounds.top+row.bounds.bottom)/2)<=.035);
      if(!label)continue;
      metrics.labelled++;
      const original=matcher(row.name);
      if(original.player){metrics[original.player.name===label.name?'automaticCorrect':'automaticWrong']++;continue;}
      metrics.manual++;
      const alternatives=(row.nameAlternatives??[]).map(matcher);
      const candidates=[...new Map([...alternatives.flatMap(m=>m.player?[m.player]:[]),...original.candidates,...alternatives.flatMap(m=>m.candidates)].map(p=>[p.id,p])).values()].slice(0,8);
      if(original.candidates[0]?.name===label.name)metrics.originalTop1++;
      if(candidates[0]?.name===label.name)metrics.improvedTop1++;
      if(original.candidates.some(p=>p.name===label.name))metrics.originalTop8++;
      if(candidates.some(p=>p.name===label.name))metrics.improvedTop8++;
    }
    return metrics;
  },{screenshots,labels,rosterNames}):null;
  console.log('Identity review metrics:',JSON.stringify(reviewMetrics));
  const fingerprints=cards.filter(r=>r.avatarEvidence);
  const groups=new Map();
  for(const r of fingerprints){
    const key=r.avatarEvidence.difference+':'+r.avatarEvidence.average;
    const group=groups.get(key)??[];
    group.push(r.name);groups.set(key,group);
  }
  const cropChecks=screenshots.flatMap(s=>s.cropChecks??[]);
  const distances=cropChecks.map(c=>c.distance).filter(d=>d!==null).sort((a,b)=>a-b);
  const cropMetrics={checked:cropChecks.length,usable:cropChecks.filter(c=>c.usable).length,comparable:distances.length,medianDistance:distances[Math.floor(distances.length/2)]??null,withinThreshold:distances.filter(d=>d<=.18).length};
  for(const screenshot of screenshots){delete screenshot.cropChecks;delete screenshot.cropMs;}
  const avatarMetrics={cropMetrics,cards:cards.length,usable:fingerprints.length,coverage:cards.length?fingerprints.length/cards.length:0,
    identicalFingerprintGroups:[...groups.values()].filter(g=>g.length>1).map(g=>({count:g.length,names:[...new Set(g)]}))};
  // Only aggregate diagnostics leave the benchmark process; no avatar fingerprints in artifacts.
  for(const row of cards)delete row.avatarEvidence;
  await writeFile(output, JSON.stringify({retriesEnabled,workerCount,startupMs,recognitionBatchMs,batchMs,errors,screenshots,scores,negative,avatarMetrics,retryMetrics,reviewMetrics},null,2)+'\n');
  if(scores){
    const sum=key=>scores.reduce((total,s)=>total+s[key],0);
    const expected=sum('expected');
    assert.ok(expected>0,'Ground truth must contain labelled cards');
    assert.ok(sum('detected')/expected>=.99,'Card detection below 99%');
    assert.ok(sum('powerCorrect')/expected>=.99,'Exact power recognition below 99%');
    assert.equal(sum('registrationCorrect'),expected,'Registration recognition must be exact');
    assert.equal(sum('otherLegionCorrect'),expected,'Other-legion recognition must be exact');
    assert.ok(scores.every(s=>s.legionCorrect),'Incorrect screenshot legion');
    assert.equal(sum('extra'),0,'Unexpected player cards detected');
  }
  assert.deepEqual(errors, []);
  if(negative)assert.equal(negative.rejected,true,'Unsupported screenshot must be rejected');
  assert.ok(screenshots.every(result => !result.error));
  console.log('Wrote OCR readings and timings for '+screenshots.length+' original screenshots.');
} finally {
  await browser?.close();
  await server.close();
}
