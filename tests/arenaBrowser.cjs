const {chromium}=require(process.env.HIVE_PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.HIVE_CHROMIUM_PATH?{executablePath:process.env.HIVE_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[],provider=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/functions/v1/'))provider.push(r.url())});
 await page.addInitScript(()=>{
  if(localStorage.getItem('arena-fixture'))return;localStorage.setItem('arena-fixture','1');localStorage.setItem('svs_onboarded','1');
  localStorage.setItem('svs_state_workspaces_v1',JSON.stringify({version:1,activeStateId:'3573',states:['3573','3543']}));
  function p(id,fid,name,strong){const items=[50006,50001,50004,50005,50012].map((h,i)=>({id:h,position:i+1,level:strong?80:70,stars:4,power:strong?120:100,exclusive_gear_level:strong?5:1,gear:[{slot:'Goggles',quality_label:'Mythic',troop_label:'Infantry',enhancement_level:strong?40:20,refine_level:3}]}));return {id,fid,username:name,allianceTag:'LUN',roles:[],languages:[],joinerHeroes:[],eventHistory:[],notes:'Preserve me',providerDetails:{stateId:'3573',fid,heroes:{items,retrievedAt:'2026-10-21T00:00:00Z'}}}}
  const players=[p('a','12345','Your fixture',false),p('b','67890','Opponent fixture',true)];
  const data={_version:'3.1.0',settings:{stateId:'3573',allianceTag:'LUN'},players,events:[],svsPlans:[],customRoles:[]};
  localStorage.setItem('svs_rally_data:state:3573',JSON.stringify(data));localStorage.setItem('svs_rally_data:state:3543',JSON.stringify({...data,settings:{stateId:'3543'},players:[]}));
 });
 const open=async()=>{await page.getByRole('button',{name:/Intel$/}).click();await page.getByRole('button',{name:/Arena comparison/}).click()};
 await page.goto(process.env.HIVE_BASE_URL || 'http://127.0.0.1:5173/',{waitUntil:'networkidle'});await open();
 await page.getByLabel('Your player',{exact:true}).selectOption('a');await page.getByLabel('Opponent',{exact:true}).selectOption('b');
 await page.getByText('Win chance unavailable',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Save battle result',exact:true}).isDisabled(),true);
 await page.getByText('Your team: edit attack & inspect gear',{exact:true}).click();await page.getByText('Opponent: verify defence & inspect gear',{exact:true}).click();
 await page.getByLabel('I checked your team positions against the game').check();await page.getByLabel('I checked opponent positions against the game').check();
 await page.getByRole('button',{name:'Try this swap',exact:true}).click();assert.equal(await page.getByLabel('Your team Front left',{exact:true}).inputValue(),'saved-50004');
 assert.equal(await page.getByLabel('Your team Back left',{exact:true}).inputValue(),'saved-50006');await page.getByLabel('I checked your team positions against the game').check();
 await page.getByRole('button',{name:'Add owned alternative',exact:true}).first().click();
 await page.getByLabel('Alternative hero',{exact:true}).selectOption('50007');await page.getByLabel('Alternative Level',{exact:true}).fill('80');await page.getByRole('button',{name:'Add to trial',exact:true}).click();
 await page.getByLabel('Your team Back right',{exact:true}).selectOption('manual-50007');await page.getByLabel('I checked your team positions against the game').check();
 await page.getByLabel('Your battle result',{exact:true}).selectOption('loss');await page.getByLabel('Arena battle notes',{exact:true}).fill('Tested frontline swap');await page.getByRole('button',{name:'Save battle result',exact:true}).click();await page.getByText('Battle result saved on this device.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('svs_arena_results_v1:state:3573')).results.length),1);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('svs_rally_data:state:3573')).players[0].notes),'Preserve me');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('svs_rally_data:state:3573')).players[0].providerDetails.heroes.items.length),5);
 await page.getByText('Your team: edit attack & inspect gear',{exact:true}).click();await page.getByText('Opponent: verify defence & inspect gear',{exact:true}).click();await page.getByRole('heading',{name:'Arena comparison',exact:true}).evaluate(el=>el.closest('section').scrollTop=0);await page.screenshot({path:'/tmp/arena-phone.png',fullPage:true});
 await page.reload({waitUntil:'networkidle'});await open();await page.getByText('Saved battle results (1)',{exact:true}).click();await page.getByText(/LOSS · Your fixture vs Opponent fixture/).click();await page.getByText('Tested frontline swap',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Remove result',exact:true}).click();await page.getByRole('button',{name:'Keep result',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('svs_arena_results_v1:state:3573')).results.length),1);
 await page.setViewportSize({width:1024,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/arena-desktop.png',fullPage:true});
 await page.evaluate(()=>{const r=JSON.parse(localStorage.getItem('svs_state_workspaces_v1'));r.activeStateId='3543';localStorage.setItem('svs_state_workspaces_v1',JSON.stringify(r))});await page.reload({waitUntil:'networkidle'});await open();await page.getByText('Saved battle results (0)',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(provider,[]);console.log('PASS: Arena comparison, formation swaps, manual alternative, gear, result persistence, record preservation, phone/desktop and state isolation; no provider requests or page errors.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
