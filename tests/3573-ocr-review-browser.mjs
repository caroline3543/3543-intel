import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const origin=process.env.EVENT_PREVIEW_ORIGIN || 'http://127.0.0.1:4186';
if(process.env.EVENT_PREVIEW_ORIGIN) assert.match(new URL(origin).hostname,/^3573-caroline(?:-demo)?-[a-z0-9]+-sunfire-castle-planner\.vercel\.app$/);
const server=process.env.EVENT_PREVIEW_ORIGIN ? null : spawn('./node_modules/.bin/vite',['preview','roster-site','--host','127.0.0.1','--port','4186','--strictPort'],{stdio:'inherit'});
let browser;
try {
  let ready=false;
  for(let i=0;i<80;i++){
    try{if((await fetch(origin+'/event-preview.html')).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(ready);
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE});
  await mkdir('ocr-review-captures',{recursive:true});
  const evidenceImage=(await readFile('tests/fixtures/3573-ocr/screenshots/IMG_9840.jpeg')).toString('base64');
  for(const kind of ['foundry','canyon']){
    const enteredPower=kind==='foundry'?3638:1390000000;
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
    await page.waitForFunction(()=>{try{return Array.isArray(JSON.parse(sessionStorage.getItem('3573-event-preview-fixture-v1'))?.players);}catch{return false;}},null,{timeout:30000});
    await page.evaluate(async ({kind,evidenceImage})=>{
      const db=await new Promise((resolve,reject)=>{
        const req=indexedDB.open('3573-screenshot-import',1);
        req.onupgradeneeded=()=>req.result.createObjectStore('sessions');
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error);
      });
      // Juniper must be genuinely unassigned to exercise a new registration.
      const workspace=JSON.parse(sessionStorage.getItem('3573-event-preview-fixture-v1'));
      workspace.players.push({...workspace.players[0],id:'collision-hot',fid:'357309999',allianceTag:'HOT',username:'Northvale Two'});
      for(const slot of [workspace.foundry,...Object.values(workspace.foundry.eventPlans??{})]){
        if(slot.registrations)delete slot.registrations['sample-1'];
        if(slot.registeredUnder)delete slot.registeredUnder['sample-1'];
      }
      sessionStorage.setItem('3573-event-preview-fixture-v1',JSON.stringify(workspace));
      const rows=[
        {name:'Northvale',power:kind==='foundry'?3647:1530000000,registration:'unknown'},
        {name:'Northva1e',power:kind==='foundry'?3100:1200000000,registration:'substitute'},
        {name:'Juniper',power:null,registration:'combatant'},
        {name:'Aster',power:kind==='foundry'?4200:445000000,registration:'other-legion',otherLegion:2}
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
    await page.getByRole('button',{name:'Import roster'}).click();
    await page.getByRole('button',{name:'Review Legion 1 · 4 readings'}).click();
    const review=page.getByRole('region',{name:'Review screenshot readings'});
    await review.getByRole('heading',{name:'Review imported players'}).waitFor();
    const row=name=>review.locator(`[data-imported-name="${name}"]`);
    const openRow=async name=>{
      const item=row(name);
      if(!await item.evaluate(element=>element.classList.contains('is-expanded')))await item.locator('button.compact-review-row').click();
      assert.equal(await review.locator('.is-expanded').count(),1);
    };
    assert.equal(await review.locator('.compact-review-item').count(),4);
    assert.equal(await review.locator('.is-expanded').count(),0);
    await checkResponsive('compact-review');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-current-summary.png'});
    await openRow('Juniper');
    await openRow('Northva1e');
    assert.equal(await row('Juniper').locator('.ocr-reading-fields').count(),0);
    await checkResponsive('04-identity');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-04-identity.png',animations:'disabled'});
    // Candidate selection is provisional and must be cleared by a changed search.
    const search=row('Northva1e').getByRole('searchbox');
    await search.fill('Northvale');
    const cards=row('Northva1e').locator('.stage9-candidate-card');
    assert.ok(await cards.count()>=2,'Search must expose multiple candidates');
    const other=cards.filter({hasText:'Northvale Two'});
    await other.click();
    assert.equal(await other.getAttribute('aria-pressed'),'true');
    const candidate=cards.filter({hasText:'357301200'});
    await candidate.click();
    assert.equal(await other.getAttribute('aria-pressed'),'false');
    assert.equal(await candidate.getAttribute('aria-pressed'),'true');
    const confirmMatch=review.getByRole('button',{name:'Confirm match',exact:true});
    assert.equal(await confirmMatch.isEnabled(),true);
    await search.fill('Juniper');
    assert.equal(await confirmMatch.isEnabled(),false,'Changing search must clear provisional identity');
    await search.fill('');
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
    await page.getByRole('button',{name:'Import roster'}).click();
    await page.getByRole('button',{name:'Review Legion 1 · 4 readings'}).click();
    await openRow('Northva1e');
    assert.equal(await retryStatus.innerText(),firstReading,'Additional OCR evidence must survive reopening');
    assert.ok(await review.getByRole('button',{name:'Review troop powers changes'}).isDisabled());
    await row('Northva1e').getByRole('button',{name:'Skip this reading',exact:true}).click();
    assert.ok(await row('Northva1e').getByRole('button',{name:'Restore Northva1e'}).isVisible());
    await review.getByRole('button',{name:'Needs review',exact:true}).click();
    for(const name of ['Northvale','Aster']){
      if(await row(name).locator('button.compact-review-row').count())await openRow(name);
      if(await row(name).getByRole('alert').filter({hasText:'Unusually large change'}).count()){
        await row(name).getByRole('button',{name:'Confirm troop power',exact:true}).click();
      }
    }
    await openRow('Juniper');
    const comparison=row('Juniper').locator('.stage9-registration-comparison');
    const expectedPrevious=kind==='foundry'?3630:1385000000;
    assert.ok((await comparison.innerText()).includes(expectedPrevious.toLocaleString('en-US')),'Power comparison must show the correct event-specific recorded value');
    await checkResponsive('05-power');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-05-power.png',animations:'disabled'});
    const powerInput=row('Juniper').getByRole('textbox',{name:'Troop power for Juniper'});
    for(const value of [1,2,3,String(enteredPower).length].map(n=>String(enteredPower).slice(0,n))){
      await powerInput.fill(value);
      assert.equal(await powerInput.inputValue(),value);
      assert.equal(await row('Juniper').count(),1);
    }
    await page.getByRole('dialog',{name:'Screenshot import workspace'}).getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('button',{name:'Import roster'}).click();
    await page.getByRole('button',{name:'Review Legion 1 · 4 readings'}).click();
    await openRow('Juniper');
    assert.equal(await powerInput.inputValue(),String(enteredPower));
    await page.waitForFunction(async ({kind,enteredPower})=>{
      const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('3573-screenshot-import',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      try {
        const session=await new Promise((resolve,reject)=>{const req=db.transaction('sessions','readonly').objectStore('sessions').get(kind+':ARC');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
        return Object.values(session?.drafts?.[1]?.edits??{}).some(edit=>edit.power===String(enteredPower)&&!edit.powerConfirmed);
      } finally {db.close();}
    },{kind,enteredPower});
    await page.reload();
    if(kind==='canyon')await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:'Canyon Clash'}).click();
    await page.getByRole('button',{name:'Import roster'}).click();
    await page.getByRole('button',{name:'Review Legion 1 · 4 readings'}).click();
    await openRow('Juniper');
    assert.equal(await powerInput.inputValue(),String(enteredPower));
    await row('Juniper').getByRole('button',{name:'Confirm troop power',exact:true}).click();
    for(const name of ['Northvale','Aster']){
      if(await row(name).locator('button.compact-review-row').count())await openRow(name);
      if(await row(name).getByRole('alert').filter({hasText:'Unusually large change'}).count()){
        await row(name).getByRole('button',{name:'Confirm troop power',exact:true}).click();
      }
    }
    await review.getByText('Review options',{exact:true}).click();
    await review.getByLabel('Import mode').selectOption('both');
    await review.getByRole('button',{name:'Needs review',exact:true}).click();
    await openRow('Northvale');
    assert.ok(await row('Northvale').getByLabel('Registration for Northvale').isVisible());
    await checkResponsive('06-registration-exception');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-06-registration-exception.png',animations:'disabled'});
    await review.getByRole('button',{name:'All',exact:true}).click();
    await review.getByLabel('Show edit controls for matched players').check();
    await row('Juniper').getByRole('button',{name:'Edit Juniper'}).click();
    assert.equal(await row('Juniper').getByLabel('Registration for Juniper').inputValue(),'join');
    await row('Juniper').getByRole('button',{name:'Close details for Juniper'}).click();
    await openRow('Aster');
    assert.equal(await row('Aster').getByLabel('Registration for Aster').inputValue(),'');
    await checkResponsive('06-registration');
    await page.screenshot({path:'ocr-review-captures/'+kind+'-06-registration.png',animations:'disabled'});
    await openRow('Northvale');
    await row('Northvale').getByRole('button',{name:'Keep existing registration'}).click();
    await openRow('Aster');
    if(await row('Aster').getByRole('button',{name:'Keep existing registration'}).count())await row('Aster').getByRole('button',{name:'Keep existing registration'}).click();
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
    assert.equal(saved.foundry.eventPlans[JSON.stringify([kind,'ARC',1])].powerByPlayer['sample-1'],enteredPower);
    assert.equal(saved.foundry.eventPlans[JSON.stringify([kind,'ARC',1])].registrations['sample-1'],'join');
    // Simulate a persisted pending receipt after a successful submission.
    await page.evaluate(async ({kind,enteredPower})=>{
      const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('3573-screenshot-import',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('sessions','readwrite'),store=tx.objectStore('sessions'),key=kind+':ARC',req=store.get(key);
        req.onsuccess=()=>{const session=req.result;store.put({...session,pendingImport:{kind,alliance:'ARC',legion:1,expectedOccurrenceId:JSON.stringify([kind,'ARC',1]),powers:[{id:'sample-1',value:enteredPower}],roleChanges:[]}},key);};
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });db.close();
    },{kind,enteredPower});
    await page.reload();
    if(kind==='canyon')await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:'Canyon Clash'}).click();
    await page.getByRole('button',{name:'Import roster'}).click();
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
    await page.evaluate(async ({kind})=>{
      const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('3573-screenshot-import',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('sessions','readwrite'),store=tx.objectStore('sessions'),key=kind+':ARC',req=store.get(key);
        req.onsuccess=()=>store.put({...req.result,pendingImport:{kind,alliance:'ARC',legion:1,expectedOccurrenceId:JSON.stringify([kind,'ARC',1]),powers:[{id:'sample-1',value:9999}],roleChanges:[]}},key);
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });db.close();
    },{kind,enteredPower});
    await page.reload();
    if(kind==='canyon')await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:'Canyon Clash'}).click();
    await page.getByRole('button',{name:'Import roster'}).click();
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
  // Separate journey: confirm a spelling in Foundry, reload, then reuse it in Canyon.
  const page=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true});
  await page.goto(origin+'/event-preview.html');
  await page.waitForFunction(()=>!!sessionStorage.getItem('3573-event-preview-fixture-v1'));
  await page.evaluate(async evidenceImage=>{
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('3573-screenshot-import',1);req.onupgradeneeded=()=>req.result.createObjectStore('sessions');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const file=new File([Uint8Array.from(atob(evidenceImage),c=>c.charCodeAt(0))],'IMG_9840.jpeg',{type:'image/jpeg'});
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('sessions','readwrite');
      for(const kind of ['foundry','canyon']){
        const power=kind==='foundry'?3630:1520000000;
        tx.objectStore('sessions').put({items:[{id:'alias-fixture',file,reading:{legion:1,rows:[{name:'Northva1e',power,registration:'unknown',bounds:{top:.3,bottom:.377}}]}}],occurrenceIds:{1:JSON.stringify([kind,'ARC',1]),2:JSON.stringify([kind,'ARC',2])}},kind+':ARC');
      }
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });db.close();
  },evidenceImage);
  await page.reload();
  await page.getByRole('button',{name:'Import roster'}).click();
  await page.getByRole('button',{name:/Review Legion 1 · 1 reading/}).click();
  const review=page.getByRole('region',{name:'Review screenshot readings'});
  await review.getByRole('button',{name:'Review Northva1e',exact:true}).click();
  await review.getByRole('searchbox').fill('Northvale');
  await review.locator('.stage9-candidate-card').filter({hasText:'357301200'}).click();
  await review.getByLabel('Remember this spelling for future uploads').check();
  await review.getByRole('button',{name:'Confirm match',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('3573-event-preview-fixture-v1')).players.find(p=>p.id==='sample-0').ocrAliases?.includes('Northva1e'));
  await page.reload();
  await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:'Canyon Clash'}).click();
  await page.getByRole('button',{name:'Import roster'}).click();
  await page.getByRole('button',{name:/Review Legion 1 · 1 reading/}).click();
  await review.getByRole('heading',{name:'Review imported players'}).waitFor();
  assert.match(await review.locator('.stage9-review-counts').innerText(),/1 matched · 0 need review/,'Learned alias must not require another identity review');
  await page.screenshot({path:'ocr-review-captures/canyon-learned-alias.png'});
  console.log('PASS: Foundry UI alias confirmation, reload, Canyon automatic reuse in isolated fixture');
  await page.close();
} finally {await browser?.close();server?.kill();}
