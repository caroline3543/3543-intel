import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:4173';
const server=spawn('./node_modules/.bin/vite',['roster-site','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'pipe'});
let browser;
const errors=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(){
  for(let i=0;i<80;i++){try{const r=await fetch(origin);if(r.ok)return;}catch{}await delay(250);}
  throw Error('Local 3573 preview server failed to start');
}
const player=(id,name)=>({id,username:name,fid:String(681766600+Number(id)),allianceTag:'HOT',cityPower:1000000,profileLastUpdated:'2026-11-01T00:00:00Z'});
const fixture={players:[player('1','Caroline'),player('2','Carolinne'),player('3','Spicy')],events:[],customRoles:[],settings:{stateId:'3573'}};
function record(page){
 page.on('pageerror',error=>errors.push(error.message));
}
try{
 await ready();
 browser=await chromium.launch({headless:true});
 const guest=await browser.newContext({viewport:{width:390,height:844}});
 const guestPage=await guest.newPage();record(guestPage);
 await guestPage.route('**/api/session',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({authenticated:false})}));
 await guestPage.goto(origin,{waitUntil:'domcontentloaded'});
 await guestPage.getByRole('heading',{name:/Caroline.s roster/i}).waitFor();
 assert.equal(await guestPage.getByLabel('Site password').count(),1);
 assert.equal(await guestPage.getByRole('button',{name:'Open roster'}).count(),1);
 assert.equal(await guestPage.getByLabel('Remember me for 30 days').count(),1);
 await guest.close();
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844}});
  const page=await context.newPage();record(page);
  const writes=[];
  await page.route('**/api/**',route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()!=='GET')writes.push(url.pathname);
   if(url.pathname==='/api/session')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({authenticated:true,role:'leader'})});
   if(url.pathname==='/api/workspace')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:fixture,revision:1,updatedAt:'2026-11-01T00:00:00Z',role:'leader'})});
   return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Mocked test environment'})});
  });
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.getByRole('navigation',{name:'Main navigation'}).waitFor({timeout:20000});
  const tour=page.getByRole('dialog',{name:/Load your alliances/i});
  if(await tour.isVisible()) await tour.getByRole('button',{name:'Skip'}).click();
  for(const name of ['Members','TAL Planner','Compare','Changes','Foundry'])assert.equal(await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name}).count(),1);
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'TAL Planner'}).click();
  const talSections=page.getByRole('navigation',{name:'TAL Planner sections'});
  await talSections.waitFor();
  for(const section of ['Registration','TAL Prep','Teams']){
   await talSections.getByRole('button',{name:section,exact:true}).click();
   await page.waitForTimeout(150);
   assert.equal(errors.length,0,'TAL '+section+' runtime error: '+errors.join('; '));
   assert.equal(await talSections.count(),1,'TAL section navigation disappeared after opening '+section);
   assert.equal(await talSections.getByRole('button',{name:section,exact:true}).getAttribute('aria-current'),'page',section+' should be active after navigation');
   if(section==='Teams'){
    await page.getByText('No TAL legions yet. Assign players in Registration first.').waitFor();
    assert.equal(await page.getByRole('navigation',{name:'Main navigation'}).count(),1,'Main navigation should remain available with no TAL legions');
   }
  }
  await talSections.getByRole('button',{name:'Registration',exact:true}).click();
  assert.equal(await talSections.getByRole('button',{name:'Registration',exact:true}).getAttribute('aria-current'),'page');
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Members'}).click();
  const search=page.getByRole('combobox',{name:'Search roster'});
  await search.fill('Spic');
  await page.getByRole('option',{name:/Spicy/}).waitFor({timeout:10000});
  await search.fill('Spicyy');
  await page.getByRole('option',{name:/Spicy/}).waitFor({timeout:10000});
  await search.fill('681766603');
  await page.getByRole('option',{name:/Spicy/}).waitFor({timeout:10000});
  await search.fill('');
  await page.getByRole('button',{name:'☷ Options',exact:true}).click();
  await page.getByRole('button',{name:'Select players'}).click();
  await page.getByRole('button',{name:'Select shown'}).click();
  await page.getByRole('button',{name:'Update selected'}).click();
  assert.equal(await page.getByRole('button',{name:/Review changes for/}).isDisabled(),true,'Bulk editor should not submit an empty change');
  await page.getByRole('button',{name:'Done selecting'}).click();
  assert.deepEqual(writes,[],'Read-only smoke test must not write to a workspace');
  assert.equal(errors.length,0,'Browser runtime errors: '+errors.join('; '));
  await context.close();
 }
 // Exercise the TAL screens with real-looking assignments in an isolated mocked workspace.
 const populated={...fixture,talPlan:{name:'3573 TAL test',times:['02:00','07:00','12:00','14:00','19:00'],availability:{'1':['12:00'],'2':['12:00']},records:{},teams:[{id:'HOT:1',host:'HOT',number:1,slots:[],members:[{id:'1',role:'combatant',registered:true},{id:'2',role:'substitute',registered:false}]}]}};
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844}});
  const page=await context.newPage();record(page);
  const writes=[];
  await page.route('**/api/**',route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()!=='GET')writes.push(url.pathname);
   if(url.pathname==='/api/session')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({authenticated:true,role:'leader'})});
   if(url.pathname==='/api/workspace')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:populated,revision:1,updatedAt:'2026-11-01T00:00:00Z',role:'leader'})});
   return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Mocked test environment'})});
  });
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.getByRole('navigation',{name:'Main navigation'}).waitFor({timeout:20000});
  const tour=page.getByRole('dialog',{name:/Load your alliances/i});
  if(await tour.isVisible())await tour.getByRole('button',{name:'Skip'}).click();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'TAL Planner'}).click();
  const sections=page.getByRole('navigation',{name:'TAL Planner sections'});
  await sections.waitFor();
  await page.getByLabel('Working on legion. Select to change legion').selectOption('HOT:1');
  for(const section of ['Registration','TAL Prep','Teams']){
   await sections.getByRole('button',{name:section,exact:true}).click();
   await page.waitForTimeout(150);
   assert.equal(errors.length,0,'Populated TAL '+section+' runtime errors: '+errors.join('; '));
   assert.equal(await sections.getByRole('button',{name:section,exact:true}).getAttribute('aria-current'),'page');
   if(section==='Teams'){
    await page.getByRole('heading',{name:'Team preparation'}).waitFor();
    assert.equal(await page.getByLabel('Match time UTC').count(),1,'Match time selector must exist for assigned legion');
    assert.equal(await page.getByRole('button',{name:'Show all available players'}).count(),1,'Attendance summary must be accessible');
    assert.equal(await page.getByRole('group',{name:'Filter participants'}).count(),1,'Participant filters must be accessible');
    const generator=page.getByRole('region',{name:'Generate four teams'});
    await generator.getByRole('button',{name:'Regenerate all teams'}).click();
    await generator.getByRole('alert').getByText('Select at least four registered players who can attend.').waitFor();
    await generator.getByRole('button',{name:'Add unassigned only'}).click();
    await generator.getByRole('alert').getByText('Assign four team leaders first, or choose Regenerate all teams.').waitFor();
   }
  }
  assert.deepEqual(writes,[],'Populated TAL navigation must not write to the workspace');
  await context.close();
 }
 // Generate four distinct teams from four registered players without touching production data.
 const fourPlayers=[player('1','Caroline'),player('2','Carolinne'),player('3','Spicy'),player('4','Dinu')];
 const fourPlan={...populated,players:fourPlayers,talPlan:{...populated.talPlan,availability:{'1':['12:00'],'2':['12:00'],'3':['12:00'],'4':['12:00']},records:Object.fromEntries(fourPlayers.map((p,i)=>[p.id,{troopPower:5000-i*500}])),teams:[{id:'HOT:1',host:'HOT',number:1,slots:[],members:fourPlayers.map(p=>({id:p.id,role:'combatant',registered:true}))}]}};
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844}});
  const page=await context.newPage();record(page);
  await page.route('**/api/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/session')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({authenticated:true,role:'leader'})});
   if(url.pathname==='/api/workspace'&&route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:fourPlan,revision:1,updatedAt:'2026-11-01T00:00:00Z',role:'leader'})});
   return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Mocked test environment'})});
  });
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.getByRole('navigation',{name:'Main navigation'}).waitFor({timeout:20000});
  const tour=page.getByRole('dialog',{name:/Load your alliances/i});
  if(await tour.isVisible())await tour.getByRole('button',{name:'Skip'}).click();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'TAL Planner'}).click();
  await page.getByLabel('Working on legion. Select to change legion').selectOption('HOT:1');
  await page.getByRole('navigation',{name:'TAL Planner sections'}).getByRole('button',{name:'Teams',exact:true}).click();
  await page.getByLabel('Match time UTC').selectOption('12:00');
  const generator=page.getByRole('region',{name:'Generate four teams'});
  await generator.getByRole('button',{name:'Regenerate all teams'}).click();
  await generator.getByRole('status').getByText('4 of 4 eligible players assigned across four teams.').waitFor({timeout:10000});
  const draft=await page.evaluate(()=>{
   const key=Object.keys(localStorage).find(k=>k.startsWith('caroline-3573-tal-teams-v1:HOT:1:')&&k.endsWith(':12:00'));
   return key?JSON.parse(localStorage.getItem(key)):null;
  });
  assert.ok(draft,'Generated TAL teams should be saved to the device draft');
  assert.equal(draft.groups?.length,4,'Generator must create four colour teams');
  const assigned=draft.groups.flatMap(g=>[g.leader,...g.members].filter(Boolean).map(String));
  assert.deepEqual([...assigned].sort(),['1','2','3','4'],'Each of the four selected players must be assigned exactly once');
  assert.equal(draft.groups.filter(g=>g.leader).length,4,'Every team must have a leader');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('navigation',{name:'Main navigation'}).waitFor({timeout:20000});
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'TAL Planner'}).click();
  await page.getByLabel('Working on legion. Select to change legion').selectOption('HOT:1');
  await page.getByRole('navigation',{name:'TAL Planner sections'}).getByRole('button',{name:'Teams',exact:true}).click();
  await page.getByLabel('Match time UTC').selectOption('12:00');
  await page.waitForTimeout(1200);
  const afterReload=await page.evaluate(()=>{
   const keys=Object.keys(localStorage).filter(k=>k.startsWith('caroline-3573-tal-teams-v1:'));
   return keys.map(key=>({key,chosen:JSON.parse(localStorage.getItem(key))?.chosen,groups:JSON.parse(localStorage.getItem(key))?.groups}));
  });
  assert.ok(afterReload.some(entry=>entry.key.endsWith(':12:00')&&entry.groups?.filter(g=>g.leader).length===4),
   'Reload must preserve four leaders. Observed local drafts: '+JSON.stringify(afterReload));
  const reloaded=await page.evaluate(()=>{
   const key=Object.keys(localStorage).find(k=>k.startsWith('caroline-3573-tal-teams-v1:HOT:1:')&&k.endsWith(':12:00'));
   return JSON.parse(localStorage.getItem(key));
  });
  assert.deepEqual(reloaded.groups,draft.groups,'Generated teams must survive a browser reload unchanged');

  assert.equal(errors.length,0,'Four-player TAL generation runtime errors: '+errors.join('; '));
  await context.close();
 }
 // Adding a fifth combatant must preserve every existing leader and assignment.
 const fivePlayers=[...fourPlayers,player('5','Newcomer')];
 const fivePlan={...fourPlan,players:fivePlayers,talPlan:{...fourPlan.talPlan,availability:{...fourPlan.talPlan.availability,'5':['12:00']},records:{...fourPlan.talPlan.records,'5':{troopPower:2500}},teams:[{...fourPlan.talPlan.teams[0],members:fivePlayers.map(p=>({id:p.id,role:'combatant',registered:true}))}]}};
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844}});
  const page=await context.newPage();record(page);
  await page.addInitScript(()=>{
   const date=new Date().toISOString().slice(0,10);
   const key='caroline-3573-tal-teams-v1:HOT:1:'+date+':12:00';
   localStorage.setItem('caroline-3573-last-tal-match',JSON.stringify({legion:'HOT:1',date,time:'12:00'}));
   localStorage.setItem(key,JSON.stringify({chosen:['1','2','3','4','5'],powers:{},groups:['blue','yellow','green','pink'].map((color,i)=>({key:i+1,color,leader:String(i+1),members:[]})),assignment:{},mode:'balanced',leaderStrategy:'power',confirmed:false,absentIds:[]}));
  });
  await page.route('**/api/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/session')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({authenticated:true,role:'leader'})});
   if(url.pathname==='/api/workspace'&&route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:fivePlan,revision:1,updatedAt:'2026-11-01T00:00:00Z',role:'leader'})});
   return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Mocked test environment'})});
  });
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.getByRole('navigation',{name:'Main navigation'}).waitFor({timeout:20000});
  const tour=page.getByRole('dialog',{name:/Load your alliances/i});
  if(await tour.isVisible())await tour.getByRole('button',{name:'Skip'}).click();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'TAL Planner'}).click();
  await page.getByLabel('Working on legion. Select to change legion').selectOption('HOT:1');
  await page.getByRole('navigation',{name:'TAL Planner sections'}).getByRole('button',{name:'Teams',exact:true}).click();
  const generator=page.getByRole('region',{name:'Generate four teams'});
  await generator.getByRole('button',{name:'Add unassigned only'}).click();
  await generator.getByRole('status').getByText('5 of 5 eligible players assigned. Added 1 without changing existing teams.').waitFor({timeout:10000});
  await page.waitForTimeout(1000);
  const draftDiagnostics=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('caroline-3573-tal-teams-v1:')).map(key=>({key,groups:JSON.parse(localStorage.getItem(key))?.groups,chosen:JSON.parse(localStorage.getItem(key))?.chosen})));
  assert.ok(draftDiagnostics.some(d=>d.key.endsWith(':12:00')&&d.groups?.some(g=>g.members.includes('5'))),
   'Adding newcomer must save their assignment. Drafts: '+JSON.stringify(draftDiagnostics));
  const groups=await page.evaluate(()=>{
   const key=Object.keys(localStorage).find(k=>k.startsWith('caroline-3573-tal-teams-v1:HOT:1:')&&k.endsWith(':12:00'));
   return JSON.parse(localStorage.getItem(key)).groups;
  });
  assert.deepEqual(groups.map(g=>g.leader),['1','2','3','4'],'Adding a newcomer must preserve the four original leaders');
  assert.deepEqual(groups.flatMap(g=>[g.leader,...g.members]).sort(),['1','2','3','4','5'],'Each player must appear exactly once');
  assert.equal(errors.length,0,'Add-unassigned runtime errors: '+errors.join('; '));
  await context.close();
 }
 console.log('PASS: 3573 browser login, navigation, 390px/1280px viewports and read-only workspace smoke checks');
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
