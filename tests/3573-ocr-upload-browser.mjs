import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:4185';
const server=spawn('./node_modules/.bin/vite',['preview','roster-site','--host','127.0.0.1','--port','4185','--strictPort'],{stdio:'inherit'});
let browser;
try {
  let ready=false;
  for(let i=0;i<80;i++){
    try{if((await fetch(origin+'/event-preview.html')).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,'Fixture server did not start');
  browser=await chromium.launch();
  await mkdir('ocr-review-captures',{recursive:true});
  for(const event of ['Foundry','Canyon Clash']){
    const page=await browser.newPage({viewport:{width:428,height:926},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/event-preview.html');
    if(event==='Canyon Clash') await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:event}).click();
    await page.getByRole('button',{name:'Open screenshot import'}).click();
    const upload=page.getByRole('dialog',{name:'Screenshot import workspace'});
    await upload.getByRole('button',{name:'Upload troop power'}).waitFor();
    const key=event==='Foundry'?'foundry':'canyon';
    await page.screenshot({path:'ocr-review-captures/'+key+'-01-current-upload.png'});
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');
    const input=upload.locator('input[type=file]');
    await input.setInputFiles([{name:'one.png',mimeType:'image/png',buffer:png},{name:'duplicate.png',mimeType:'image/png',buffer:png}]);
    await upload.getByText('0 of 1 screenshots read',{exact:true}).waitFor();
    await upload.getByText('Duplicate screenshots were skipped.',{exact:true}).waitFor();
    await page.reload();
    if(event==='Canyon Clash') await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:event}).click();
    await page.getByRole('button',{name:'Open screenshot import'}).click();
    await upload.getByText('0 of 1 screenshots read',{exact:true}).waitFor();
    // Hold the lazy OCR module request to capture the genuine loading UI without external OCR assets.
    let releaseReader;
    const readerGate=new Promise(resolve=>{releaseReader=resolve;});
    await page.route(/\/assets\/readRosterScreenshot[^/]*\.js(?:\?.*)?$/,async route=>{await readerGate;await route.abort();});
    await upload.getByRole('button',{name:'Scan screenshots',exact:true}).click();
    await upload.getByRole('heading',{name:'Processing screenshots'}).waitFor();
    await upload.getByRole('button',{name:'Stop scan'}).waitFor();
    for(const width of [320,390,428]){
      await page.setViewportSize({width,height:width===428?926:844});
      assert.ok(await upload.locator('.stage9-import-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    }
    await page.screenshot({path:'ocr-review-captures/'+key+'-02-processing.png',animations:'disabled'});
    await upload.getByRole('button',{name:'Stop scan'}).click();
    releaseReader();
    await upload.getByRole('button',{name:'Scan screenshots',exact:true}).waitFor();
    await upload.getByText('0 of 1 screenshots read',{exact:true}).waitFor();
    await upload.getByRole('button',{name:'Clear screenshots'}).click();
    await upload.getByRole('button',{name:'Upload troop power'}).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    await page.close();
  }
} finally {await browser?.close();server.kill();}
