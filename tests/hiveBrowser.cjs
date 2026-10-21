const {chromium}=require(process.env.HIVE_PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.HIVE_CHROMIUM_PATH?{executablePath:process.env.HIVE_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  if(localStorage.getItem('hive-fixture'))return;
  localStorage.setItem('hive-fixture','1');localStorage.setItem('svs_onboarded','1');
  localStorage.setItem('svs_state_workspaces_v1',JSON.stringify({version:1,activeStateId:'3573',states:['3573','3543']}));
  function p(id,fid,name,tag,x,y){return{id,fid,username:name,allianceTag:tag,furnaceLevel:'FC7',roles:[],languages:[],joinerHeroes:[],eventHistory:[],providerDetails:{fid,stateId:'3573',retrievedAt:'2026-10-21T00:00:00Z',raw:{player:{fid,kid:3573,x,y}}}}}
  const data={_version:'3.1.0',settings:{stateId:'3573',allianceTag:'LUN'},players:[p('a','111111111','Test Caroline','LUN',634,748),p('b','222222222','Test 名','LUN',638,750),p('c','333333333','Test Other','MBT',600,700)],events:[],svsPlans:[],customRoles:[]};
  localStorage.setItem('svs_rally_data:state:3573',JSON.stringify(data));localStorage.setItem('svs_rally_data:state:3543',JSON.stringify({...data,settings:{stateId:'3543',allianceTag:'LUN'},players:[{...data.players[0],providerDetails:null}]}));
 });
 await page.goto(process.env.HIVE_BASE_URL || 'http://127.0.0.1:5173/',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/Hive$/}).click();
 await page.getByRole('status').filter({hasText:'Planner roster connected'}).waitFor();
 let frame=page.frames().find(f=>f.url().includes('/hive/index.html'));
 assert.equal(await frame.evaluate(()=>state.members.length),2);
 assert.equal(await frame.evaluate(()=>state.members[0].trap),0);
 await page.screenshot({path:'/tmp/hive-phone-planner.png',fullPage:true});
 await frame.locator('#themeBtn').click();assert.equal(await frame.evaluate(()=>document.body.classList.contains('dark')),true);await frame.locator('#themeBtn').click();
 await frame.locator('#expandMapBtn').click();assert.equal(await frame.evaluate(()=>document.body.classList.contains('expanded-map')),true);await frame.locator('#expandMapBtn').click();
 // Use the planner UI to open templates, then return to test the bridge preserving an existing design.
 await frame.locator('#loadLunBtn').click();assert.equal(await frame.locator('#modal').isVisible(),true);await frame.locator('#closeModal').click();
 await frame.evaluate(()=>{commit(()=>{state.members[0].trap=1;state.members[0].notes='Keep my plan';state.members[0].locked=true})});
 await page.getByRole('button',{name:'Update planner roster'}).click();
 assert.equal(await frame.evaluate(()=>state.members[0].notes),'Keep my plan');assert.equal(await frame.evaluate(()=>state.members[0].locked),true);
 await page.getByRole('button',{name:'Reported locations',exact:true}).click();
 await page.getByRole('img',{name:'Reported LUN city locations'}).waitFor();
 await page.getByLabel('Find a player',{exact:true}).selectOption('a');
 await page.getByText(/X634 · Y748/).first().waitFor();
 await page.screenshot({path:'/tmp/hive-phone-locations.png',fullPage:true});
 await page.getByRole('button',{name:'Planned layout',exact:true}).click();
 await page.getByLabel('State 3573 · alliance').selectOption('MBT');
 await page.getByRole('status').filter({hasText:'Planner roster connected'}).waitFor();
 frame=page.frames().find(f=>f.url().includes('/hive/index.html'));
 assert.equal(await frame.evaluate(()=>state.members.length),1);assert.equal(await frame.evaluate(()=>state.members[0].name),'Test Other');
 await page.getByLabel('State 3573 · alliance').selectOption('LUN');
 await page.getByRole('status').filter({hasText:'Planner roster connected'}).waitFor();
 frame=page.frames().find(f=>f.url().includes('/hive/index.html'));
 assert.equal(await frame.evaluate(()=>state.members[0].notes),'Keep my plan');
 await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/Hive$/}).click();await page.getByRole('status').filter({hasText:'Planner roster connected'}).waitFor();
 frame=page.frames().find(f=>f.url().includes('/hive/index.html'));assert.equal(await frame.evaluate(()=>state.members[0].notes),'Keep my plan');
 await page.getByLabel('Hive state',{exact:true}).selectOption('3543');await page.waitForLoadState('networkidle');await page.getByRole('button',{name:/Hive$/}).click();await page.getByRole('status').filter({hasText:'Planner roster connected'}).waitFor();frame=page.frames().find(f=>f.url().includes('/hive/index.html'));assert.equal(await frame.evaluate(()=>state.settings.state),'3543');assert.equal(await frame.evaluate(()=>state.members.length),1);assert.equal(await frame.evaluate(()=>state.members[0].notes),'');
 await page.setViewportSize({width:1024,height:800});await page.screenshot({path:'/tmp/hive-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: phone planner load, roster bridge, templates, preservation, location view, alliance isolation, reload persistence and desktop layout; no page errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
