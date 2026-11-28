import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,readdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const origin=process.env.EVENT_PREVIEW_ORIGIN || 'http://127.0.0.1:4185';
if(process.env.EVENT_PREVIEW_ORIGIN) assert.match(new URL(origin).hostname,/^3573-caroline(?:-demo)?-[a-z0-9]+-sunfire-castle-planner\.vercel\.app$/);
const server=process.env.EVENT_PREVIEW_ORIGIN ? null : spawn('./node_modules/.bin/vite',['preview','roster-site','--host','127.0.0.1','--port','4185','--strictPort'],{stdio:'inherit'});
let browser;
try {
  let ready=false;
  for(let i=0;i<80;i++){
    try{if((await fetch(origin+'/event-preview.html')).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,'Fixture server did not start');
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE});
  await mkdir('ocr-review-captures',{recursive:true});
  for(const event of ['Foundry','Canyon Clash']){
    const page=await browser.newPage({viewport:{width:428,height:926},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/event-preview.html');
    if(event==='Canyon Clash') await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:event}).click();
    await page.getByRole('button',{name:'Import roster'}).click();
    const upload=page.getByRole('dialog',{name:'Screenshot import workspace'});
    await upload.getByRole('button',{name:'Upload screenshots',exact:true}).click();
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
    await page.getByRole('button',{name:'Import roster'}).click();
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
    await upload.getByRole('button',{name:'Resume scan',exact:true}).waitFor();
    await upload.getByText('0 of 1 screenshots read',{exact:true}).waitFor();
    await upload.getByRole('button',{name:'Clear screenshots'}).click();
    await upload.getByRole('button',{name:'Upload troop power'}).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    // Use a fresh page because the cancellation test intentionally aborts the OCR module.
    await page.close();
    const real=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true});
    const realErrors=[];real.on('pageerror',e=>realErrors.push(e.message));
    await real.addInitScript(()=>{
      Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4});
      const Original=window.Worker;
      window.__ocrWorkerCounts={created:0,terminated:0};
      window.Worker=class extends Original{
        constructor(...args){super(...args);window.__ocrWorkerCounts.created++;}
        terminate(){window.__ocrWorkerCounts.terminated++;return super.terminate();}
      };
    });
    await real.goto(origin+'/event-preview.html');
    if(event==='Canyon Clash')await real.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:event}).click();
    await real.getByRole('button',{name:'Import roster'}).click();
    const dialog=real.getByRole('dialog',{name:'Screenshot import workspace'});
    await dialog.getByRole('button',{name:'Upload screenshots',exact:true}).click();
    const dir='tests/fixtures/3573-ocr/screenshots';
    const names=(await readdir(dir)).sort().slice(0,3);
    const files=await Promise.all(names.map(async name=>({name,mimeType:name.endsWith('.png')?'image/png':'image/jpeg',buffer:await readFile(dir+'/'+name)})));
    await dialog.locator('input[type=file]').setInputFiles(files.slice(0,2));
    await dialog.getByText('0 of 2 screenshots read',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Scan screenshots',exact:true}).click();
    await dialog.getByText('2 of 2 screenshots read',{exact:true}).waitFor({timeout:120000});
    const counts=()=>real.evaluate(()=>({...window.__ocrWorkerCounts}));
    await dialog.getByRole('button',{name:'Add screenshots'}).waitFor();
    await real.waitForFunction(()=>window.__ocrWorkerCounts.created===2&&window.__ocrWorkerCounts.terminated===1);
    const start=await counts();
    await dialog.locator('input[type=file]').setInputFiles(files.slice(2));
    await dialog.getByText('2 of 3 screenshots read',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Scan new screenshots',exact:true}).click();
    await dialog.getByText('3 of 3 screenshots read',{exact:true}).waitFor({timeout:120000});
    await real.waitForFunction(()=>window.__ocrWorkerCounts.created===2&&window.__ocrWorkerCounts.terminated===1);
    assert.deepEqual(await counts(),start,'Incremental scan should reuse the retained worker');
    await dialog.getByRole('button',{name:'Close',exact:true}).click();
    await real.waitForFunction(()=>window.__ocrWorkerCounts.created===window.__ocrWorkerCounts.terminated);
    await real.reload();
    if(event==='Canyon Clash')await real.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:event}).click();
    await real.getByRole('button',{name:'Import roster'}).click();
    await dialog.getByText('3 of 3 screenshots read',{exact:true}).waitFor();
    assert.deepEqual(realErrors,[]);
    await real.close();
    assert.deepEqual(errors,[]);
  }
} finally {await browser?.close();server?.kill();}
