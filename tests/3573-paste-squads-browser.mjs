import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const origin=process.env.EVENT_PREVIEW_ORIGIN || 'http://127.0.0.1:4188';
if(process.env.EVENT_PREVIEW_ORIGIN) assert.match(new URL(origin).hostname,/^3573-caroline(?:-demo)?-[a-z0-9]+-sunfire-castle-planner\.vercel\.app$/);
const server=process.env.EVENT_PREVIEW_ORIGIN ? null : spawn('./node_modules/.bin/vite',['preview','roster-site','--host','127.0.0.1','--port','4188','--strictPort'],{stdio:'inherit'});
const output=process.env.SQUAD_CAPTURE_DIR ?? 'paste-squad-captures';
const previewPath='/event-preview.html';
let browser;
try{
 for(let attempt=0;attempt<40;attempt++){
  try{if((await fetch(origin+previewPath)).ok)break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 await mkdir(output,{recursive:true});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE});
 const timing=[];
 for(const width of [320,390,428])for(const kind of ['Foundry','Canyon Clash']){
  const started=performance.now();
  const context=await browser.newContext({viewport:{width,height:width===428?926:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  const requests=[],errors=[];
  page.on('request',request=>requests.push(request.url()));
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   return url.origin===origin && !url.pathname.startsWith('/api/') && ['GET','HEAD'].includes(request.method())?route.continue():route.abort();
  });
  await page.goto(origin+previewPath);
  const capture=async stage=>{
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),kind+' '+width+' '+stage);
   const content=page.locator('.stage9-import-content');
   if(await content.count())assert.ok(await content.evaluate(el=>el.scrollWidth<=el.clientWidth+1),kind+' '+width+' '+stage+' import overflow');
   await page.screenshot({path:`${output}/${kind==='Foundry'?'foundry':'canyon'}-${width}-${stage}.png`,animations:'disabled'});
  };
  await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:kind,exact:true}).click();
  await page.getByRole('button',{name:'Open screenshot import'}).click();
  const dialog=page.getByRole('dialog',{name:'Screenshot import workspace'});
  await dialog.getByRole('button',{name:'Paste player list'}).click();
  const box=dialog.getByRole('textbox',{name:'Player list',exact:true});
  await box.fill('Broken|140|3|Combatant');
  await dialog.getByRole('button',{name:'Match players'}).click();
  await dialog.getByText('Line 1: Legion must be 1 or 2.').waitFor();
  const p = kind==='Foundry' ? [3631,3633,15632,8202,4801] : [1520000001,1385000001,1250000001,1115000001,710000001];
  const batch=`Username\tTroop power\tLegion\tRegistration\tPlayer ID
Northvale\t${p[0]}\t1\tCombatant\t357301200
Juniper\t${p[1]}\t1\tCombatant
Solaec\t${p[2]}\t1\tCombatant
Ember\t${p[3]}\t1\tCombatant
Lumen\t${p[4]}\t1\tSubstitute`;
  await box.fill(batch);
  await capture('paste');
  const matchingStarted=performance.now();
  await dialog.getByRole('button',{name:'Match players'}).click();
  const review=dialog.getByRole('region',{name:'Review screenshot readings'});
  const compact=review.locator('.compact-review-row');
  await compact.first().waitFor();
  const clickToRowsMs=Math.round(performance.now()-matchingStarted);
  assert.equal(await compact.count(),5);
  assert.deepEqual(await compact.locator('strong').allTextContents(),['Northvale','Juniper','Solaec','Ember','Lumen']);
  assert.equal(Math.round((await compact.first().boundingBox()).height),35);
  await capture('review');
  await review.getByRole('button',{name:'Needs review',exact:true}).click();
  assert.equal(await compact.count(),1);
  const ambiguous=review.locator('[data-imported-name="Solaec"]');
  await ambiguous.getByRole('searchbox').fill('Solace');
  await ambiguous.getByRole('button',{name:/^Solace\b/}).click();
  await ambiguous.getByRole('button',{name:'Confirm match',exact:true}).click();
  await review.getByRole('button',{name:'All',exact:true}).click();
  assert.deepEqual(await compact.locator('strong').allTextContents(),['Northvale','Juniper','Solace','Ember','Lumen']);
  await review.getByRole('button',{name:'Review troop powers and registrations changes'}).click();
  await capture('confirm');
  await review.getByRole('button',{name:'Save troop powers and registrations'}).click();
  await review.getByRole('button',{name:'Continue to Teams'}).click();
  const squad=page.getByRole('region',{name:'Squad Balancer'});
  assert.equal(await squad.getByRole('button',{name:'Lumen',exact:true}).count(),0);
  await squad.getByRole('button',{name:'2',exact:true}).click();
  await squad.getByRole('button',{name:'Northvale',exact:true}).click();
  await squad.getByRole('button',{name:'Juniper',exact:true}).click();
  assert.ok(await squad.getByRole('button',{name:'Solace',exact:true}).isDisabled());
  await capture('squad');
  await squad.getByRole('button',{name:'Auto-Balance 2 Teams'}).click();
  await page.getByText('Northvale · Leader',{exact:true}).waitFor();
  const snapshot=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('3573-event-preview-fixture-v1')));
  const slot=JSON.stringify([kind==='Foundry'?'foundry':'canyon','ARC',1]);
  const stored=(await snapshot()).foundry.eventPlans[slot];
  assert.equal(stored.teamCount,2);
  assert.deepEqual(stored.teamLeaders,{Blue:'sample-0',Yellow:'sample-1'});
  assert.equal(stored.registrations['sample-6'],'sub');
  assert.equal(stored.powerByPlayer['sample-2'],p[2]);
  await page.getByRole('button',{name:'Lock Northvale',exact:true}).click();
  assert.ok(await page.getByRole('button',{name:'Move Northvale to another team'}).isDisabled());
  const nextTeam=stored.teams['sample-2']==='Blue'?'Yellow':'Blue';
  await page.getByRole('button',{name:'Move Solace to another team'}).click();
  await page.getByRole('group',{name:'Move Solace to',exact:true}).getByRole('button',{name:nextTeam,exact:true}).click();
  await squad.getByRole('button',{name:'Auto-Balance 2 Teams'}).click();
  await squad.getByRole('button',{name:'Confirm rebalance'}).click();
  const saved=(await snapshot()).foundry.eventPlans[slot];
  assert.equal(saved.teams['sample-0'],'Blue');
  assert.equal(saved.teams['sample-2'],nextTeam);
  assert.equal(saved.teamLocks['sample-0'],true);
  assert.equal(saved.manualTeams['sample-2'],true);
  assert.equal(await page.locator('[data-team-card]').count(),2);
  await page.locator('[data-team-card="Blue"]').getByRole('button',{name:'Copy',exact:true}).click();
  assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/Northvale/);
  await page.locator('[data-team-card="Blue"]').scrollIntoViewIfNeeded();
  await capture('teams');
  assert.deepEqual(errors,[]);
  assert.ok(!requests.some(url=>/ocr-data|tesseract|\/api\//iu.test(url)),'Paste journey must bypass OCR and shared services');
  timing.push({kind,width,clickToRowsMs,syntheticJourneyMs:Math.round(performance.now()-started)});
  await context.close();
 }
 console.log(JSON.stringify(timing,null,2));
}finally{
 await browser?.close();
 server?.kill();
}
