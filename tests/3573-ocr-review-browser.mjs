import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:4186';
const server=spawn('./node_modules/.bin/vite',['preview','roster-site','--host','127.0.0.1','--port','4186','--strictPort'],{stdio:'inherit'});
let browser;
try {
  let ready=false;
  for(let i=0;i<80;i++){
    try{if((await fetch(origin+'/event-preview.html')).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(ready);
  browser=await chromium.launch();
  await mkdir('ocr-review-captures',{recursive:true});
  for(const kind of ['foundry','canyon']){
    const page=await browser.newPage({viewport:{width:428,height:926},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    async function checkResponsive(stage){
      for(const width of [320,390,428]){
        await page.setViewportSize({width,height:width===428?926:844});
        const dimensions=await page.locator('.stage9-import-content').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
        assert.ok(dimensions.scroll<=dimensions.width+1,`${kind} ${stage}: horizontal overflow at ${width}px`);
      }
      await page.setViewportSize({width:428,height:926});
    }
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/event-preview.html');
    await page.evaluate(async kind=>{
      const db=await new Promise((resolve,reject)=>{
        const req=indexedDB.open('3573-screenshot-import',1);
        req.onupgradeneeded=()=>req.result.createObjectStore('sessions');
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error);
      });
      const rows=[
        {name:'Northvale',power:3647,registration:'combatant'},
        {name:'Unrecognised fixture',power:3100,registration:'substitute'},
        {name:'Juniper',power:null,registration:'combatant'},
        {name:'Aster',power:4200,registration:'other-legion',otherLegion:2}
      ].map((row,i)=>({...row,bounds:{top:.1+i*.15,bottom:.2+i*.15}}));
      const file=new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],'synthetic-fixture.png',{type:'image/png'});
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('sessions','readwrite');
        tx.objectStore('sessions').put({items:[{id:'fixture',file,reading:{legion:1,rows}}],occurrenceIds:{1:JSON.stringify([kind,'ARC',1]),2:JSON.stringify([kind,'ARC',2])}},kind+':ARC');
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });
      db.close();
    },kind);
    await page.reload();
    if(kind==='canyon')await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:'Canyon Clash'}).click();
    await page.getByRole('button',{name:'Open screenshot import'}).click();
    await page.getByRole('button',{name:'Review Legion 1 · 4 readings'}).click();
    const review=page.getByRole('region',{name:'Review screenshot readings'});
    await review.getByRole('heading',{name:'Import summary'}).waitFor();
    await checkResponsive('current-summary');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-current-summary.png'});
    await review.getByRole('button',{name:/Resolve .* readings/}).click();
    await review.getByText(/4 readings/).waitFor();
    await review.getByRole('heading',{name:'Confirm player identity'}).waitFor();
    await checkResponsive('04-identity');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-04-identity.png',animations:'disabled'});
    await review.getByRole('button',{name:'Review troop powers changes'}).click();
    await review.getByRole('alert').filter({hasText:'Resolve or skip'}).waitFor();
    const row=name=>review.locator('.ocr-reading').filter({has:page.locator('summary > strong',{hasText:name})});
    await review.getByText('Review options',{exact:true}).click();
    await review.getByLabel('Filter readings').selectOption('all');
    if(!(await row('Unrecognised fixture').getAttribute('open')!==null)) await row('Unrecognised fixture').locator('summary').first().click();
    await row('Unrecognised fixture').getByRole('checkbox',{name:'Skip this reading'}).check();
    await review.getByLabel('Filter readings').selectOption('review');
    await review.getByRole('heading',{name:'Confirm troop power'}).waitFor();
    await checkResponsive('05-power');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-05-power.png',animations:'disabled'});
    await review.getByLabel('Filter readings').selectOption('all');
    if(await row('Juniper').getAttribute('open')===null) await row('Juniper').locator('summary').first().click();
    await row('Juniper').getByRole('textbox',{name:'Troop power for Juniper'}).fill('3638');
    await review.getByLabel('Import mode').selectOption('both');
    await review.getByLabel('Filter readings').selectOption('review');
    await review.getByRole('heading',{name:'Review registration'}).waitFor();
    await checkResponsive('06-registration');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-06-registration.png',animations:'disabled'});
    await review.getByLabel('Filter readings').selectOption('all');
    for(const name of ['Northvale','Juniper','Aster']){
      if(await row(name).getAttribute('open')===null) await row(name).locator('summary').first().click();
      await row(name).getByRole('button',{name:'Keep existing registration'}).click();
    }
    assert.equal(await row('Aster').getByLabel('Registration for Aster').inputValue(),'');
    await review.getByRole('button',{name:'Review troop powers and registrations changes'}).click();
    const confirm=review.getByRole('region',{name:'Confirm screenshot import'});
    await confirm.waitFor();
    await checkResponsive('current-confirmation');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-current-confirmation.png'});
    await confirm.getByRole('button',{name:'Save troop powers and registrations'}).click();
    await review.getByRole('button',{name:'Done',exact:true}).waitFor();
    await checkResponsive('current-completion');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-current-completion.png'});
    const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('3573-event-preview-fixture-v1')));
    assert.equal(saved.foundry.eventPlans[JSON.stringify([kind,'ARC',1])].powerByPlayer['sample-1'],3638);
    assert.deepEqual(errors,[]);
    await page.close();
  }
} finally {await browser?.close();server.kill();}
