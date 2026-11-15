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
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Members'}).click();
  const search=page.getByRole('combobox',{name:'Search roster'});
  await search.fill('Spic');
  await page.getByRole('option',{name:/Spicy/}).waitFor({timeout:10000});
  await search.fill('Spicyy');
  await page.getByRole('option',{name:/Spicy/}).waitFor({timeout:10000});
  await search.fill('681766603');
  await page.getByRole('option',{name:/Spicy/}).waitFor({timeout:10000});
  await search.fill('');
  assert.deepEqual(writes,[],'Read-only smoke test must not write to a workspace');
  assert.equal(errors.length,0,'Browser runtime errors: '+errors.join('; '));
  await context.close();
 }
 console.log('PASS: 3573 browser login, navigation, 390px/1280px viewports and read-only workspace smoke checks');
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
