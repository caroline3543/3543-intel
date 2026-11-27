import assert from 'node:assert/strict';
import { scoreScreenshot } from './3573-ocr-score.mjs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const directory = resolve(process.env.ROSTER_SCREENSHOTS_DIR ?? '../screenshots');
const output = resolve(process.argv[2] ?? '../3573-ocr-results.json');
const negativePath=process.env.ROSTER_NEGATIVE_SCREENSHOT ? resolve(process.env.ROSTER_NEGATIVE_SCREENSHOT) : null;
const groundTruthPath=process.env.ROSTER_GROUND_TRUTH ? resolve(process.env.ROSTER_GROUND_TRUTH) : null;
const files = (await readdir(directory)).filter(name => /\.(?:png|jpe?g|webp)$/i.test(name)).sort();
assert.ok(files.length >= 1 && files.length <= 25, 'Put 1–25 original screenshots in ROSTER_SCREENSHOTS_DIR.');
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
  await page.evaluate(async () => {
    const reader = await import('/src/foundry/readRosterScreenshot.js');
    window.rosterReader = await reader.createRosterReader();
    window.scanRoster = reader.readRosterScreenshot;
  });
  const startupMs = Math.round(performance.now() - workerStarted);
  const batchStarted = performance.now();
  const screenshots = [];
  for (const filename of files) {
    const content = (await readFile(resolve(directory, filename))).toString('base64');
    const reading = await page.evaluate(async ({ filename, content }) => {
      const file = new File([Uint8Array.from(atob(content), char => char.charCodeAt(0))], filename);
      const started = performance.now();
      try {
        const data = await window.scanRoster(window.rosterReader, file);
        return { filename, ms:Math.round(performance.now()-started), ...data };
      } catch (error) {
        return { filename, error:error.message };
      }
    }, { filename, content });
    screenshots.push(reading);
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
  const labels=groundTruthPath ? JSON.parse(await readFile(groundTruthPath,'utf8')) : null;
  const scores=labels ? screenshots.map(actual=>{
    const expected=labels[actual.filename];
    assert.ok(expected,'Missing ground truth for '+actual.filename);
    return {filename:actual.filename,...scoreScreenshot(expected,actual)};
  }) : null;
  await writeFile(output, JSON.stringify({startupMs,batchMs,errors,screenshots,scores,negative},null,2)+'\n');
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
