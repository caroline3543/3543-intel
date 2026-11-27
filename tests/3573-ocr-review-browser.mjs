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
    await page.getByRole('button',{name:'Review Legion 1 · 4 readings'}).click();
    const review=page.getByRole('region',{name:'Review screenshot readings'});
    await review.getByText(/4 readings/).waitFor();
    await page.screenshot({path:'ocr-review-captures/'+kind+'-current-review.png'});
    await review.getByRole('button',{name:'Review troop powers changes'}).click();
    await review.getByRole('alert').filter({hasText:'Resolve or skip'}).waitFor();
    const row=name=>review.locator('.ocr-reading').filter({has:page.locator('summary > strong',{hasText:name})});
    await row('Unrecognised fixture').locator('summary').first().click();
    await row('Unrecognised fixture').getByRole('checkbox',{name:'Skip this reading'}).check();
    await row('Juniper').locator('summary').first().click();
    await row('Juniper').getByRole('textbox',{name:'Troop power for Juniper'}).fill('3638');
    await review.getByLabel('Import mode').selectOption('both');
    await row('Aster').locator('summary').first().click();
    assert.equal(await row('Aster').getByLabel('Registration for Aster').inputValue(),'');
    await review.getByRole('button',{name:'Review troop powers and registrations changes'}).click();
    const confirm=review.getByRole('region',{name:'Confirm screenshot import'});
    await confirm.waitFor();
    await page.screenshot({path:'ocr-review-captures/'+kind+'-current-confirmation.png'});
    await confirm.getByRole('button',{name:'Save troop powers and registrations'}).click();
    await review.getByRole('button',{name:'Done',exact:true}).waitFor();
    await page.screenshot({path:'ocr-review-captures/'+kind+'-current-completion.png'});
    const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('3573-event-preview-fixture-v1')));
    assert.equal(saved.foundry.eventPlans[JSON.stringify([kind,'ARC',1])].powerByPlayer['sample-1'],3638);
    assert.deepEqual(errors,[]);
    await page.close();
  }
} finally {await browser?.close();server.kill();}
