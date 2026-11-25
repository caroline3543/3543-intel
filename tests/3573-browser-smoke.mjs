import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
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
const player=(id,name)=>({id,username:name,fid:String(681766600+Number(id)),allianceTag:'HOT',cityPower:1000000,membershipObservedAt:new Date().toISOString(),providerStats:{capturedAt:new Date().toISOString()}});
const fixture={players:[player('1','Caroline'),player('2','Carolinne'),player('3','Spicy')],events:[],customRoles:[],settings:{stateId:'3573',compareLabTop100:{stateId:'3573',board:'labyrinth',retrievedAt:'2026-11-18T12:00:00Z',counts:{ARC:3,HOT:2,RKG:1,LUN:0},other:{},noAlliance:0,unknown:0,total:6}}};
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
  let stage='initial';
  await page.route('**/api/**',route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()!=='GET'&&url.pathname!=='/api/lookup')writes.push({stage,path:url.pathname,method:request.method(),body:request.postData()?.slice(0,1200)});
   if(url.pathname==='/api/session')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({authenticated:true,role:'leader'})});
   if(url.pathname==='/api/transfers'){
    const first_detected_at=new Date().toISOString();
    const events=[
     {id:1,fid:fixture.players[0].fid,username:'Caroline',confidence:'confirmed',from_state:'3574',to_state:'3573',to_alliance:'HOT',first_detected_at},
     {id:2,fid:'681766699',username:'Departed player',confidence:'confirmed',from_state:'3573',to_state:'3574',from_alliance:'ARC',first_detected_at}
    ];
    return route.fulfill({status:200,json:{events}});
   }
   if(url.pathname==='/api/workspace')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:fixture,revision:1,updatedAt:'2026-11-01T00:00:00Z',role:'leader'})});
   if(url.pathname==='/api/lookup'&&request.method()==='POST'){
    const body=JSON.parse(request.postData()||'{}');
    if(body.action==='alliance'&&['HOT','ARC'].includes(body.tag)){
     const members=[{chief_id:body.tag==='HOT'?'681766601':'681766602',nick_name:'FC8 player',furnace_level:'FC8',power:2000000,labyrinth_score:150},{chief_id:body.tag==='HOT'?'681766603':'681766604',nick_name:'FC9 player',furnace_level:'FC9',power:1000000,labyrinth_score:100}];
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{alliance:{kid:3573,tag:body.tag},members}})});
    }
   }
   return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Mocked test environment'})});
  });
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  try{await page.getByRole('navigation',{name:'Main navigation'}).waitFor({timeout:12000});}catch(e){throw Error('Navigation failed to mount; page errors: '+errors.join(' | ')+'; body: '+(await page.locator('body').innerText()).slice(0,500),{cause:e});}
  const tour=page.getByRole('dialog',{name:/Load your alliances/i});
  if(await tour.isVisible()) await tour.getByRole('button',{name:'Skip'}).click();
  const expectedTabs=['Members','Events','Compare','Changes'];
  const mainNav=page.getByRole('navigation',{name:'Main navigation'});
  assert.deepEqual(await mainNav.getByRole('button').allTextContents(),expectedTabs,'Main navigation must show the four primary tabs');
  assert.equal(await page.getByText('Transfer history',{exact:true}).count(),0);
  await page.getByRole('group',{name:'Filter by alliance'}).getByRole('button',{name:/More/}).click();
  await page.getByRole('group',{name:'Other alliances'}).getByRole('button',{name:/Transferred out · /i}).waitFor();
  await page.getByText('Transfer history',{exact:true}).click();
  await page.getByText(/1 in · 1 out · 0 net/).click();
  await page.getByText('Departed player',{exact:true}).waitFor();
  await page.getByText('Transfer history',{exact:true}).click();
  stage='events';
  await mainNav.getByRole('button',{name:'Events',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:/Castle Battle/}).isDisabled(),true,'Unavailable Castle Battle must not be clickable');
  assert.equal(await page.getByRole('button',{name:/Canyon Clash/}).isEnabled(),true);
  const events=page.getByRole('region',{name:'Events'});
  assert.deepEqual(await events.locator('button strong').allTextContents(),['Canyon Clash','Castle Battle','Foundry','Tundra Arms League']);
  assert.equal(await events.locator('button svg[aria-hidden="true"]').count(),4);
  stage='tal-placeholder';
  const talEntry=page.getByRole('button',{name:/Tundra Arms League/});
  assert.equal(await talEntry.isEnabled(),true,'TAL event should open its under-development screen');
  await talEntry.click();
  await page.getByRole('region',{name:'Tundra Arms League under development'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Tundra Arms League'}).count(),1);
  assert.equal(await page.getByText('Under development',{exact:true}).count(),1);
  assert.equal(await page.getByRole('navigation',{name:'TAL Planner sections'}).count(),0,'TAL editor must stay hidden');
  assert.equal(await mainNav.getByRole('button',{name:'Events',exact:true}).getAttribute('aria-current'),'page');
  await page.getByRole('button',{name:/Back to Events/}).click();
  assert.equal(await page.getByRole('region',{name:'Events'}).count(),1);
  stage='compare';
  await mainNav.getByRole('button',{name:'Compare',exact:true}).click();
  await page.getByRole('heading',{name:'Alliance standings'}).waitFor();
  assert.equal(await page.getByText('Pre-FC',{exact:true}).count(),1,'Furnace chart must include Pre-FC');
  assert.equal(await page.getByText('FC8',{exact:true}).count(),1,'Furnace chart must include FC8');
  assert.equal(await page.getByText('FC9',{exact:true}).count(),0,'Furnace chart must stop at FC8');
  const chartUnits=page.getByRole('group',{name:'Furnace chart units'});
  assert.equal(await chartUnits.getByRole('button',{name:'Players'}).getAttribute('aria-pressed'),'true','Counts must be the default');
  await chartUnits.getByRole('button',{name:'%'}).click();
  assert.equal(await chartUnits.getByRole('button',{name:'%'}).getAttribute('aria-pressed'),'true','Percentage switch must work');
  await page.getByRole('button',{name:'Show FC8 furnace counts'}).click();
  assert.equal(await page.getByRole('status').filter({hasText:'FC8'}).count(),1,'Chart selection must reveal counts');
  await page.getByRole('button',{name:'Refresh Lab'}).click();
  await page.getByRole('alert').filter({hasText:/Previous results retained/}).waitFor();
  assert.equal(await page.getByText(/Last lookup/).count(),1,'Shared Lab lookup timestamp must remain visible after refresh failure');
  assert.equal(await page.getByRole('row',{name:/HOT/}).getByRole('cell').last().innerText(),'2','Shared Lab summary must supply last known counts');
  await page.getByRole('button',{name:'ⓘ About data'}).click();
  assert.equal(await page.getByText(/The chart shows Pre-FC through FC8/).count(),1,'Methodology must explain range');
  stage='alliance-compare';
  await page.getByRole('button',{name:'Alliances',exact:true}).click();
  await page.getByRole('textbox',{name:'Opponent state'}).fill('3573');
  await page.getByLabel('Opponent alliance').fill('ARC');
  await page.getByRole('button',{name:'Load rosters'}).click();
  await page.getByRole('heading',{name:'Furnace strength'}).waitFor({timeout:10000});
  assert.equal(await page.getByRole('button',{name:'FC8',exact:true}).count(),1,'FC8 must remain a threshold');
  assert.equal(await page.getByRole('button',{name:'FC9',exact:true}).count(),0,'FC9 threshold must be removed');
  assert.equal(await page.getByRole('button',{name:'FC10',exact:true}).count(),0,'FC10 threshold must be removed');
  assert.equal(await page.getByText('Pre-FC',{exact:true}).count(),1,'Alliance comparison must include Pre-FC');
  await page.getByRole('group',{name:'Distribution metric'}).getByRole('button',{name:'Roster %'}).click();
  assert.equal(await page.getByRole('group',{name:'Distribution metric'}).getByRole('button',{name:'Roster %'}).getAttribute('aria-pressed'),'true');
  stage='members';
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Members'}).click();
  const search=page.getByRole('combobox',{name:'Search roster'});
  await search.fill('Spic');
  await page.getByRole('option',{name:/Spicy/}).waitFor({timeout:10000});
  await search.fill('Spicyy');
  await page.getByRole('option',{name:/Spicy/}).waitFor({timeout:10000});
  await search.fill('681766603');
  await page.getByRole('option',{name:/Spicy/}).waitFor({timeout:10000});
  await search.fill('');
  assert.match(await page.getByRole('status').filter({hasText:/Showing \d+ of \d+ players/}).innerText(),/Showing 3 of 3 players/,'Fresh fixture players must appear in the current roster');
  stage='bulk-selection';
  await page.getByRole('button',{name:'☷ Options',exact:true}).click();
  stage='select-players';
  await page.getByRole('button',{name:'Select players'}).click();
  stage='select-shown';
  await page.getByRole('button',{name:'Select shown'}).click();
  stage='update-selected';
  await page.getByRole('button',{name:'Update selected'}).click();
  assert.equal(await page.getByRole('button',{name:/Review changes for/}).isDisabled(),true,'Bulk editor should not submit an empty change');
  stage='done-selecting';
  await page.getByRole('button',{name:'Done selecting'}).click();
  for(const write of writes){try{const parsed=JSON.parse(write.body);const decoded=JSON.parse(gunzipSync(Buffer.from(parsed.encoded,'base64')).toString('utf8'));write.diff=Object.keys(decoded).filter(k=>JSON.stringify(decoded[k])!==JSON.stringify(fixture[k])).map(k=>({key:k,before:JSON.stringify(fixture[k])?.slice(0,350),after:JSON.stringify(decoded[k])?.slice(0,350)}));delete write.body;}catch(e){write.decodeError=e.message;}}
  assert.deepEqual(writes,[],'Read-only smoke test must not write to a workspace');
  assert.equal(errors.length,0,'Browser runtime errors: '+errors.join('; '));
  await context.close();
 }
 console.log('PASS: 3573 browser login, Events/TAL locked placeholder, navigation, 390px/1280px viewports and read-only workspace smoke checks');
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
