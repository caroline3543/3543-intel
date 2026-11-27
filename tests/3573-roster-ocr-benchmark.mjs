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
const rosterPath=process.env.ROSTER_IDENTITY_SNAPSHOT;
const benchmarkAlliance=process.env.ROSTER_BENCHMARK_ALLIANCE??'HOT';
const roster=rosterPath?JSON.parse(await readFile(resolve(rosterPath),'utf8')):rosterNames.map((name,i)=>({name,id:String(i+1),alliance:'HOT'}));
assert.ok(Array.isArray(roster)&&roster.every(p=>typeof p.id==='string'&&typeof p.name==='string'&&typeof p.alliance==='string'),'Invalid identity snapshot');
assert.equal(new Set(roster.map(p=>p.id)).size,roster.length,'Duplicate snapshot identity');
if(rosterPath){assert.ok(labels,'External snapshot requires ID-labelled ground truth');const ids=new Set(roster.map(p=>p.id));for(const screenshot of Object.values(labels))for(const row of screenshot.rows)assert.ok(typeof row.playerId==='string'&&ids.has(row.playerId),'External ground truth must identify every row by a valid player ID');}
if(process.env.ROSTER_REQUIRE_INDEPENDENT_GATE==='1'){
  assert.ok(rosterPath&&labels,'Independent gate requires external roster and verified labels');
  assert.deepEqual(Object.keys(labels).sort(),files,'Every evaluation image must have labels, with no extra labelled images');
  for(const filename of files){
    const rows=labels[filename].rows;
    assert.ok(Array.isArray(rows)&&rows.length>0,'Empty evaluation labels: '+filename);
    assert.ok(rows.every(r=>Number.isFinite(r.center)&&r.center>=0&&r.center<=1),'Invalid row center: '+filename);
    assert.equal(new Set(rows.map(r=>r.center)).size,rows.length,'Duplicate row centers: '+filename);
  }
}
const identityScope=rosterPath?'external roster snapshot':'label-derived roster';
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
  await page.evaluate(async ({workerCount,roster,retriesEnabled,benchmarkAlliance}) => {
    const reader = await import('/src/foundry/readRosterScreenshot.js');
    window.rosterReaders = await Promise.all(Array.from({length:workerCount},()=>reader.createRosterReader()));
    window.rosterReader=window.rosterReaders[0];
    window.scanRoster = reader.readRosterScreenshot;
    const {createScreenshotMatcher}=await import('/src/foundry/screenshotImportPlan.js');
    window.matchName=retriesEnabled ? createScreenshotMatcher(roster,benchmarkAlliance) : undefined;
  },{workerCount,roster,retriesEnabled,benchmarkAlliance});
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
  // Exercise both production event modes on identical source images.
  // Opt-in because this requires two additional OCR passes per image.
  if(process.env.ROSTER_EVENT_PARITY==='1'){
    const parity=[];
    for(const filename of files){
      const content=(await readFile(resolve(directory,filename))).toString('base64');
      const result=await page.evaluate(async ({filename,content,roster,benchmarkAlliance})=>{
        const {createScreenshotMatcher}=await import('/src/foundry/screenshotImportPlan.js');
        const matcher=createScreenshotMatcher(roster,benchmarkAlliance);
        const scan=async kind=>{
          const file=new File([Uint8Array.from(atob(content),c=>c.charCodeAt(0))],filename);
          const data=await window.scanRoster(window.rosterReader,file,kind,{matchName:matcher});
          return data.rows.map(row=>({name:row.name,alternatives:row.nameAlternatives??[],identity:matcher(row.name).player?.id??null,power:row.power??null}));
        };
        const foundry=await scan('foundry'),canyon=await scan('canyon');
        return {equal:JSON.stringify(foundry)===JSON.stringify(canyon),foundryRows:foundry.length,canyonRows:canyon.length};
      },{filename,content,roster,benchmarkAlliance});
      parity.push(result);
    }
    console.log('Production event mode parity:',JSON.stringify({images:parity.length,equal:parity.filter(p=>p.equal).length,divergent:parity.filter(p=>!p.equal).length}));
    assert.ok(parity.every(p=>p.equal),'Foundry/Canyon production mode OCR divergence');
  }
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
  const reviewMetrics=labels?await page.evaluate(async ({screenshots,labels,roster,benchmarkAlliance})=>{
    const {createScreenshotMatcher}=await import('/src/foundry/screenshotImportPlan.js');
    const matcher=createScreenshotMatcher(roster,benchmarkAlliance);
    const correct=(p,label)=>!!p&&(label.playerId?p.id===label.playerId:p.name===label.name);
    const metrics={labelled:0,automaticCorrect:0,automaticWrong:0,manual:0,originalTop1:0,improvedTop1:0,originalTop8:0,improvedTop8:0,unresolved:[]};
    for(const screenshot of screenshots)for(const row of screenshot.rows??[]){
      const label=labels[screenshot.filename].rows.find(l=>Math.abs(l.center-(row.bounds.top+row.bounds.bottom)/2)<=.035);
      if(!label)continue;
      metrics.labelled++;
      const original=matcher(row.name);
      if(original.player){metrics[correct(original.player,label)?'automaticCorrect':'automaticWrong']++;continue;}
      metrics.manual++;
      const alternatives=(row.nameAlternatives??[]).map(matcher);
      const candidates=[...new Map([...alternatives.flatMap(m=>m.player?[m.player]:[]),...original.candidates,...alternatives.flatMap(m=>m.candidates)].map(p=>[p.id,p])).values()].slice(0,8);
      if(correct(original.candidates[0],label))metrics.originalTop1++;
      if(correct(candidates[0],label))metrics.improvedTop1++;
      if(original.candidates.some(p=>correct(p,label)))metrics.originalTop8++;
      if(candidates.some(p=>correct(p,label)))metrics.improvedTop8++;
      metrics.unresolved.push({filename:screenshot.filename,expected:label.name,reading:row.name,alternatives:row.nameAlternatives??[],candidates:original.candidates.map(p=>p.name),correctCandidateRank:candidates.findIndex(p=>correct(p,label))+1,decorativeOrSpacingAmbiguity:!!label.decorativeOrSpacingAmbiguity});
    }
    return metrics;
  },{screenshots,labels,roster,benchmarkAlliance}):null;
  const aliasComparison=rosterPath?await page.evaluate(async ({screenshots,labels,roster,benchmarkAlliance})=>{
    const {createScreenshotMatcher}=await import('/src/foundry/screenshotImportPlan.js');
    const variants=[roster.map(({nickname,ocrAliases,...p})=>p),roster.map(({ocrAliases,...p})=>p),roster];
    const results=variants.map(players=>{
      const match=createScreenshotMatcher(players,benchmarkAlliance);
      const counts={correct:0,wrong:0,manual:0,missing:0};
      for(const screenshot of screenshots){
        const used=new Set();
        for(const label of labels[screenshot.filename].rows){
        const row=(screenshot.rows??[]).filter(r=>!used.has(r)&&Math.abs(label.center-(r.bounds.top+r.bounds.bottom)/2)<=.035).sort((a,b)=>Math.abs(label.center-(a.bounds.top+a.bounds.bottom)/2)-Math.abs(label.center-(b.bounds.top+b.bounds.bottom)/2))[0];
        if(row)used.add(row);
        if(!row){counts.missing++;continue;}
        const p=match(row.name).player;
        counts[!p?'manual':p.id===label.playerId?'correct':'wrong']++;
        }
      }
      return counts;
    });
    const [withoutAliases,withNicknames,withAliases]=results;
    const reductionPercent=withNicknames.manual?100*(withNicknames.manual-withAliases.manual)/withNicknames.manual:null;
    return {withoutAliases,withNicknames,withAliases,reductionPercent,targetMet:reductionPercent!==null&&reductionPercent>=30&&withAliases.wrong===0&&withAliases.missing===0};
  },{screenshots,labels,roster,benchmarkAlliance}):null;
  if(aliasComparison)console.log('Paired alias comparison:',JSON.stringify(aliasComparison));
  // Release validation must use an externally supplied identity snapshot, not
  // a roster reconstructed from the evaluation labels. Never treat replay as proof.
  const requireIndependentGate=process.env.ROSTER_REQUIRE_INDEPENDENT_GATE==='1';
  if(requireIndependentGate){
    assert.ok(rosterPath && groundTruthPath,'Release gate requires external roster and ID-labelled evaluation screenshots');
    assert.ok(process.env.ROSTER_ALIAS_TRAINING_MANIFEST,'Release gate requires a separate alias training manifest');
    const training=JSON.parse(await readFile(resolve(process.env.ROSTER_ALIAS_TRAINING_MANIFEST),'utf8'));
    assert.ok(Array.isArray(training)&&training.length>0,'Training manifest must contain SHA-256 image hashes');
    const {createHash}=await import('node:crypto');
    const hashes=new Set(training);
    assert.ok(training.every(h=>typeof h==='string'&&/^[a-f0-9]{64}$/.test(h)),'Invalid training image hash');
    for(const filename of files){
      const hash=createHash('sha256').update(await readFile(resolve(directory,filename))).digest('hex');
      assert.ok(!hashes.has(hash),'Evaluation screenshot overlaps training: '+filename);
    }
  }

  const repeatUpload=labels?await page.evaluate(async ({screenshots,labels,roster,benchmarkAlliance})=>{
    const {createScreenshotMatcher}=await import('/src/foundry/screenshotImportPlan.js');
    const original=createScreenshotMatcher(roster,benchmarkAlliance);
    const learned=new Map();
    const samples=[];
    for(const screenshot of screenshots)for(const row of screenshot.rows??[]){
      const label=labels[screenshot.filename].rows.find(l=>Math.abs(l.center-(row.bounds.top+row.bounds.bottom)/2)<=.035);
      if(!label)continue;
      const expected=roster.find(p=>label.playerId?p.id===label.playerId:p.name===label.name);
      if(!expected)continue;
      samples.push({reading:row.name,id:expected.id});
      if(!original(row.name).player&&row.name?.trim()){
        if(!learned.has(expected.id))learned.set(expected.id,new Set());
        learned.get(expected.id).add(row.name);
      }
    }
    const augmented=roster.map(p=>({...p,ocrAliases:[...new Set([...(p.ocrAliases??[]),...(learned.get(p.id)??[])])]}));
    const score=matcher=>samples.reduce((acc,s)=>{const p=matcher(s.reading).player;acc[!p?'manual':p.id===s.id?'correct':'wrong']++;return acc;},{manual:0,correct:0,wrong:0});
    const before=score(original),after=score(createScreenshotMatcher(augmented,benchmarkAlliance));
    return {scope:'same-image replay with ground-truth simulated confirmations; not independent validation',before,after,reductionPercent:before.manual?100*(before.manual-after.manual)/before.manual:null};
  },{screenshots,labels,roster,benchmarkAlliance}):null;
  if(repeatUpload)console.log('Repeat upload simulation:',JSON.stringify(repeatUpload));
  if(rosterPath&&reviewMetrics)delete reviewMetrics.unresolved;
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
  await writeFile(output, JSON.stringify({identityScope,retriesEnabled,workerCount,startupMs,recognitionBatchMs,batchMs,errors,screenshots:rosterPath?undefined:screenshots,scores:rosterPath?undefined:scores,negative:rosterPath?undefined:negative,avatarMetrics:rosterPath?undefined:avatarMetrics,retryMetrics,reviewMetrics,aliasComparison,repeatUpload},null,2)+'\n');
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
  if(requireIndependentGate) assert.ok(aliasComparison?.targetMet,'Independent alias release gate failed: require >=30% fewer manual reviews, zero wrong matches and zero missing rows');
  assert.deepEqual(errors, []);
  if(negative)assert.equal(negative.rejected,true,'Unsupported screenshot must be rejected');
  assert.ok(screenshots.every(result => !result.error));
  console.log('Wrote OCR readings and timings for '+screenshots.length+' original screenshots.');
} finally {
  await browser?.close();
  await server.close();
}
