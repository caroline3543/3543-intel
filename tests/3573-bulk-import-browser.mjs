import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4174';
const server=spawn('./node_modules/.bin/vite',['roster-site','--host','127.0.0.1','--port','4174','--strictPort'],{stdio:'pipe'});
let browser;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<80;i++){try{if((await fetch(origin+'/bulk-import-qa.html')).ok)return;}catch{}await sleep(250);}throw Error('Vite fixture unavailable');}
try{
 await ready();browser=await chromium.launch({headless:true});
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/bulk-import-qa.html');
  await page.getByRole('heading',{name:'Import troop power'}).waitFor();
  const input=page.getByLabel('Paste names and troop power');
  await input.fill('Caroline,3675\nREINTLESSRKG,5472\n8ARI,3593\nБакит Кыргыз,5049');
  await page.getByRole('button',{name:/Find roster matches/}).click();
  assert.equal(await page.getByRole('button',{name:/Review/}).first().count(),1);
  assert.equal(await page.getByRole('button',{name:/Confirm 2 matched players/}).isDisabled(),true);
  // The compact reviewer automatically expands the first unresolved entry.
  assert.equal(await page.getByRole('button',{name:/REINTLESSRKG/}).first().getAttribute('aria-expanded'),'true');
  await page.getByRole('button',{name:'Match',exact:true}).first().click();
  await page.getByRole('button',{name:'Match',exact:true}).first().click();
  await page.getByRole('button',{name:/Confirm 4 matched players/}).click();
  await page.getByRole('heading',{name:'Import complete'}).waitFor();
  const saved=JSON.parse(await page.getByLabel('Saved import').textContent());
  assert.deepEqual(saved.map(r=>r.id),['1','2','3','4']);
  assert.deepEqual(saved.map(r=>r.power),[3675,5472,3593,5049]);
  assert.equal(errors.length,0,'Browser errors: '+errors.join('; '));
  await page.screenshot({path:'/tmp/3573-bulk-import-'+width+'.png',fullPage:true});
  await context.close();
 }
 console.log('PASS: bulk paste, suggestions, cross-alliance review, confirmation and exact Unicode on mobile/desktop');
}finally{await browser?.close();server.kill('SIGTERM');}
