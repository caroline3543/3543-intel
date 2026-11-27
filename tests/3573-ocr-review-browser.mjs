import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
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
  const evidenceImage=(await readFile('tests/fixtures/3573-ocr/screenshots/IMG_9840.jpeg')).toString('base64');
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
    await page.evaluate(async ({kind,evidenceImage})=>{
      const db=await new Promise((resolve,reject)=>{
        const req=indexedDB.open('3573-screenshot-import',1);
        req.onupgradeneeded=()=>req.result.createObjectStore('sessions');
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error);
      });
      // Juniper must be genuinely unassigned to exercise a new registration.
      const workspace=JSON.parse(sessionStorage.getItem('3573-event-preview-fixture-v1'));
      for(const slot of [workspace.foundry,...Object.values(workspace.foundry.eventPlans??{})]){
        if(slot.registrations)delete slot.registrations['sample-1'];
        if(slot.registeredUnder)delete slot.registeredUnder['sample-1'];
      }
      sessionStorage.setItem('3573-event-preview-fixture-v1',JSON.stringify(workspace));
      const rows=[
        {name:'Northvale',power:3647,registration:'combatant'},
        {name:'Unrecognised fixture',power:3100,registration:'substitute'},
        {name:'Juniper',power:null,registration:'combatant'},
        {name:'Aster',power:4200,registration:'other-legion',otherLegion:2}
      ].map((row,i)=>({...row,bounds:{top:.30+i*.077,bottom:.377+i*.077}}));
      const file=new File([Uint8Array.from(atob(evidenceImage),c=>c.charCodeAt(0))],'IMG_9840.jpeg',{type:'image/jpeg'});
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('sessions','readwrite');
        tx.objectStore('sessions').put({items:[{id:'fixture',file,reading:{legion:1,rows}}],occurrenceIds:{1:JSON.stringify([kind,'ARC',1]),2:JSON.stringify([kind,'ARC',2])}},kind+':ARC');
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });
      db.close();
    },{kind,evidenceImage});
    await page.reload();
    if(kind==='canyon')await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:'Canyon Clash'}).click();
    await page.getByRole('button',{name:'Open screenshot import'}).click();
    await page.getByRole('button',{name:'Review Legion 1 · 4 readings'}).click();
    const review=page.getByRole('region',{name:'Review screenshot readings'});
    await review.getByRole('heading',{name:'Import summary'}).waitFor();
    await checkResponsive('current-summary');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-current-summary.png'});
    await review.getByRole('button',{name:/Resolve .* readings/}).click();
    await page.getByRole('dialog',{name:'Screenshot import workspace'}).getByRole('heading',{name:'Confirm player',exact:true}).waitFor();
    await checkResponsive('04-identity');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-04-identity.png',animations:'disabled'});
    const reread=review.getByRole('button',{name:'Reread username',exact:true});
    await reread.click();
    await review.getByRole('button',{name:'Rereading username…',exact:true}).waitFor({state:'hidden',timeout:90000});
    await review.getByRole('status').filter({hasText:/Additional reading:|No additional username found/}).waitFor();
    await page.waitForFunction(async kind=>{
      const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('3573-screenshot-import',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      try{
        const session=await new Promise((resolve,reject)=>{const req=db.transaction('sessions','readonly').objectStore('sessions').get(kind+':ARC');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
        return Object.values(session?.drafts?.[1]?.edits??{}).some(edit=>edit.retryNote&&!edit.playerId);
      }finally{db.close();}
    },kind);
    const retryStatus=review.getByRole('status').filter({hasText:/Additional reading:|No additional username found/});
    const firstReading=await retryStatus.innerText();
    await reread.click();
    await review.getByRole('button',{name:'Rereading username…',exact:true}).waitFor({state:'hidden',timeout:90000});
    assert.equal(await retryStatus.innerText(),firstReading,'Repeated recognition must remain stable');
    await page.getByRole('dialog',{name:'Screenshot import workspace'}).getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('button',{name:'Open screenshot import'}).click();
    await page.getByRole('button',{name:'Review Legion 1 · 4 readings'}).click();
    await review.getByRole('button',{name:/Resolve .* readings/}).click();
    await page.getByRole('dialog',{name:'Screenshot import workspace'}).getByRole('heading',{name:'Confirm player',exact:true}).waitFor();
    assert.equal(await retryStatus.innerText(),firstReading,'Additional OCR evidence must survive reopening');
    await review.getByText('Review options',{exact:true}).click();
    await review.getByRole('button',{name:'Review troop powers changes'}).click();
    await review.getByRole('alert').filter({hasText:'Resolve or skip'}).waitFor();
    const row=name=>review.locator('.ocr-reading').filter({has:page.locator('summary > strong',{hasText:name})});
    await review.locator('.stage9-action-footer').getByRole('button',{name:'Skip this reading',exact:true}).click();
    if(await review.locator('.stage9-review-options').getAttribute('open')===null) await review.getByText('Review options',{exact:true}).click();
    await review.getByLabel('Filter readings').selectOption('all');
    if(await row('Unrecognised fixture').getAttribute('open')===null) await row('Unrecognised fixture').locator('summary').first().click();
    assert.equal(await row('Unrecognised fixture').getByRole('checkbox',{name:'Skip this reading'}).isChecked(),true);
    if(await review.locator('.stage9-review-options').getAttribute('open')===null) await review.getByText('Review options',{exact:true}).click();
    await review.getByLabel('Filter readings').selectOption('review');
    for(const name of ['Northvale','Aster']){
      if(await row(name).count() && await row(name).getByRole('alert').filter({hasText:'Unusually large change'}).count()){
        await review.locator('.stage9-action-footer').getByRole('button',{name:'Confirm troop power',exact:true}).click();
      }
    }
    await page.getByRole('dialog',{name:'Screenshot import workspace'}).getByRole('heading',{name:'Resolve troop power',exact:true}).waitFor();
    await checkResponsive('05-power');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-05-power.png',animations:'disabled'});
    const powerInput=row('Juniper').getByRole('textbox',{name:'Troop power for Juniper'});
    for(const value of ['3','36','363','3638']){
      await powerInput.fill(value);
      assert.equal(await powerInput.inputValue(),value);
      await page.getByRole('dialog',{name:'Screenshot import workspace'}).getByRole('heading',{name:'Resolve troop power',exact:true}).waitFor();
      assert.equal(await row('Juniper').count(),1);
    }
    await page.getByRole('dialog',{name:'Screenshot import workspace'}).getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('button',{name:'Open screenshot import'}).click();
    await page.getByRole('button',{name:'Review Legion 1 · 4 readings'}).click();
    await review.getByRole('button',{name:/Resolve .* readings/}).click();
    await page.getByRole('dialog',{name:'Screenshot import workspace'}).getByRole('heading',{name:'Resolve troop power',exact:true}).waitFor();
    assert.equal(await powerInput.inputValue(),'3638');
    await page.waitForFunction(async kind=>{
      const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('3573-screenshot-import',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      try {
        const session=await new Promise((resolve,reject)=>{const req=db.transaction('sessions','readonly').objectStore('sessions').get(kind+':ARC');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
        return Object.values(session?.drafts?.[1]?.edits??{}).some(edit=>edit.power==='3638'&&!edit.powerConfirmed);
      } finally {db.close();}
    },kind);
    await page.reload();
    if(kind==='canyon')await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:'Canyon Clash'}).click();
    await page.getByRole('button',{name:'Open screenshot import'}).click();
    await page.getByRole('button',{name:'Review Legion 1 · 4 readings'}).click();
    await review.getByRole('button',{name:/Resolve .* readings/}).click();
    await page.getByRole('dialog',{name:'Screenshot import workspace'}).getByRole('heading',{name:'Resolve troop power',exact:true}).waitFor();
    assert.equal(await powerInput.inputValue(),'3638');
    await review.locator('.stage9-action-footer').getByRole('button',{name:'Confirm troop power',exact:true}).click();
    for(let i=0;i<4;i++){
      const warning=review.getByRole('alert').filter({hasText:'Unusually large change'});
      if(!await warning.count())break;
      await review.locator('.stage9-action-footer').getByRole('button',{name:'Confirm troop power',exact:true}).click();
    }
    await review.getByText('Review options',{exact:true}).click();
    await review.getByLabel('Filter readings').selectOption('all');
    if(await review.locator('.stage9-review-options').getAttribute('open')===null) await review.getByText('Review options',{exact:true}).click();
    await review.getByLabel('Import mode').selectOption('both');
    if(await review.locator('.stage9-review-options').getAttribute('open')===null) await review.getByText('Review options',{exact:true}).click();
    await review.getByLabel('Filter readings').selectOption('review');
    if(await page.getByRole('heading',{name:'Check registration',exact:true}).count()){
      await checkResponsive('06-registration-exception');
      await page.screenshot({path:'ocr-review-captures/'+kind+'-06-registration-exception.png',animations:'disabled'});
    }
    if(await review.locator('.stage9-review-options').getAttribute('open')===null) await review.getByText('Review options',{exact:true}).click();
    await review.getByLabel('Filter readings').selectOption('all');
    for(const name of ['Northvale','Juniper','Aster']){
      if(await row(name).getAttribute('open')===null) await row(name).locator('summary').first().click();
    }
    assert.equal(await row('Aster').getByLabel('Registration for Aster').inputValue(),'');
    assert.equal(await row('Juniper').getByLabel('Registration for Juniper').inputValue(),'join');
    await checkResponsive('06-registration');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-06-registration.png',animations:'disabled'});
    await row('Northvale').getByRole('button',{name:'Keep existing registration'}).click();
    await row('Aster').getByRole('button',{name:'Keep existing registration'}).click();
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
    assert.equal(saved.foundry.eventPlans[JSON.stringify([kind,'ARC',1])].registrations['sample-1'],'join');
    // Simulate a persisted pending receipt after a successful submission.
    await page.evaluate(async kind=>{
      const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('3573-screenshot-import',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('sessions','readwrite'),store=tx.objectStore('sessions'),key=kind+':ARC',req=store.get(key);
        req.onsuccess=()=>{const session=req.result;store.put({...session,pendingImport:{kind,alliance:'ARC',legion:1,expectedOccurrenceId:JSON.stringify([kind,'ARC',1]),powers:[{id:'sample-1',value:3638}],roleChanges:[]}},key);};
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });db.close();
    },kind);
    await page.reload();
    if(kind==='canyon')await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:'Canyon Clash'}).click();
    await page.getByRole('button',{name:'Open screenshot import'}).click();
    const pending=page.getByRole('dialog',{name:'Screenshot import workspace'});
    await pending.getByRole('heading',{name:'Awaiting confirmation'}).waitFor();
    assert.equal(await pending.getByRole('button',{name:'Check save status'}).count(),1);
    assert.equal(await pending.getByRole('button',{name:'Clear screenshots'}).count(),0);
    assert.equal(await pending.getByRole('button',{name:/Review Legion/}).count(),0);
    await page.screenshot({path:'ocr-review-captures/'+kind+'-pending-recovery.png'});
    const beforeVerify=await page.evaluate(()=>sessionStorage.getItem('3573-event-preview-fixture-v1'));
    await pending.getByRole('button',{name:'Check save status'}).click();
    await pending.getByRole('button',{name:'Checking shared save…'}).waitFor({state:'hidden'});
    try { await pending.getByRole('heading',{name:'Awaiting confirmation'}).waitFor({state:'hidden',timeout:5000}); } catch(error) { throw new Error(kind+' recovery: '+await pending.innerText(),{cause:error}); }
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('3573-event-preview-fixture-v1')),beforeVerify,'Verification must not mutate the roster');
    // A receipt for a change that never reached storage must not replay automatically.
    await page.evaluate(async kind=>{
      const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('3573-screenshot-import',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('sessions','readwrite'),store=tx.objectStore('sessions'),key=kind+':ARC',req=store.get(key);
        req.onsuccess=()=>store.put({...req.result,pendingImport:{kind,alliance:'ARC',legion:1,expectedOccurrenceId:JSON.stringify([kind,'ARC',1]),powers:[{id:'sample-1',value:9999}],roleChanges:[]}},key);
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });db.close();
    },kind);
    await page.reload();
    if(kind==='canyon')await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:'Canyon Clash'}).click();
    await page.getByRole('button',{name:'Open screenshot import'}).click();
    await pending.getByRole('button',{name:'Check save status'}).click();
    await pending.getByText('Sample save not confirmed.',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('3573-event-preview-fixture-v1')),beforeVerify);
    page.once('dialog',dialog=>dialog.accept());
    await pending.getByRole('button',{name:'Return to review'}).click();
    await pending.getByRole('heading',{name:'Awaiting confirmation'}).waitFor({state:'hidden'});
    await pending.getByRole('button',{name:'Review Legion 1 · 4 readings'}).waitFor();
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('3573-event-preview-fixture-v1')),beforeVerify);
    assert.deepEqual(errors,[]);
    await page.close();
  }
} finally {await browser?.close();server.kill();}
