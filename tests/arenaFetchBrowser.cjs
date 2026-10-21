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

 // Stub the app proxy client. This fixture never authenticates or calls the live provider.
 await page.route('**/src/services/mightpulseService.js*',async route=>{
  const source=await route.fetch(),text=await source.text(),start=text.indexOf('export async function mightpulseRequest('),end=text.indexOf('export function fetchMightpulseUsage');
  assert.ok(start>=0 && end>start);
  const replacement=`export async function mightpulseRequest(action,params={}){window.arenaRequests=window.arenaRequests||[];window.arenaRequests.push({action,...params});if(params.fid==='77777')await new Promise(resolve=>window.arenaRelease=resolve);return {retrieved_at:'2026-10-21T04:00:00Z',data:{chief_id:params.fid,cached_at:'2026-10-21T03:30:00Z',player:{fid:params.fid,kid:params.fid==='99999'?3543:3573,nick_name:params.fid==='12345'?'Fetched you':'Fetched opponent',alliance:{abbr:'LUN'}},heroes:[50004,50001,50006,50005,50012].map((id,i)=>({id,position:i+1,level:80,stars:4,power:100,gear:[{slot:'Gloves',quality_label:'Mythic',enhancement_level:80,refine_level:5}]}))}}}\n`;
  await route.fulfill({response:source,body:text.slice(0,start)+replacement+text.slice(end)});
 });
 await page.goto(process.env.HIVE_BASE_URL || 'http://127.0.0.1:5173/',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/Intel$/}).click();await page.getByRole('button',{name:/Arena comparison/}).click();
 await page.getByLabel('Your player',{exact:true}).selectOption('a');
 await page.getByRole('button',{name:'Fetch your heroes & gear',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('select[aria-label="Your player"]').value==='arena-fetched-12345');
 await page.getByLabel('Opponent player ID',{exact:true}).fill('66666');await page.getByRole('button',{name:'Fetch opponent heroes & gear',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('select[aria-label="Opponent"]').value==='arena-fetched-66666');
 assert.deepEqual(await page.evaluate(()=>window.arenaRequests),[{action:'player_details',state:3573,fid:'12345'},{action:'player_details',state:3573,fid:'66666'}]);
 await page.getByLabel('Your team Holger Arena Elite',{exact:true}).selectOption('10');await page.getByLabel('Your team Holger Legacy',{exact:true}).selectOption('5');
 await page.getByLabel('Opponent Holger Arena Elite',{exact:true}).selectOption('5');await page.getByLabel('Opponent Holger Legacy',{exact:true}).selectOption('10');
 await page.getByText('Your bonus difference: heroes -10 percentage points; escorts +10 percentage points.',{exact:true}).waitFor();
 await page.getByText('Your team: edit attack & inspect gear',{exact:true}).click();await page.getByText('Opponent: verify defence & inspect gear',{exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Add owned alternative',exact:true}).count(),1);
 await page.getByLabel('Your team Front left',{exact:true}).selectOption('saved-50006');assert.equal(await page.getByLabel('Opponent Front left',{exact:true}).inputValue(),'saved-50004');
 await page.getByLabel('I checked your team positions against the game').check();await page.getByLabel('I checked opponent positions against the game').check();
 await page.getByRole('button',{name:'Save battle result',exact:true}).click();await page.getByText('Battle result saved on this device.',{exact:true}).waitFor();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('svs_arena_results_v1:state:3573')).results[0]);
 assert.equal(saved.yours.fid,'12345');assert.equal(saved.theirs.fid,'66666');assert.equal(saved.yours.holger.arenaElite,10);assert.equal(saved.theirs.holger.legacy,10);
 await page.getByLabel('Opponent player ID',{exact:true}).fill('99999');await page.getByRole('button',{name:'Fetch opponent heroes & gear',exact:true}).click();await page.getByRole('alert').filter({hasText:'different state'}).waitFor();assert.equal(await page.getByLabel('Opponent',{exact:true}).inputValue(),'arena-fetched-66666');
 await page.getByLabel('Opponent player ID',{exact:true}).fill('77777');await page.getByRole('button',{name:'Fetch opponent heroes & gear',exact:true}).click();await page.waitForFunction(()=>window.arenaRelease);
 await page.getByLabel('Opponent player ID',{exact:true}).fill('88888');await page.evaluate(()=>window.arenaRelease());
 await page.waitForTimeout(100);assert.equal(await page.getByLabel('Opponent',{exact:true}).inputValue(),'arena-fetched-66666');
 const players=await page.evaluate(()=>JSON.parse(localStorage.getItem('svs_rally_data:state:3573')).players);assert.equal(players.length,2);assert.equal(players[0].notes,'Preserve me');assert.equal(players[0].providerDetails.heroes.items[0].level,70);
 await page.getByText('Your team: edit attack & inspect gear',{exact:true}).click();await page.getByText('Opponent: verify defence & inspect gear',{exact:true}).click();
 await page.getByRole('heading',{name:'Arena comparison',exact:true}).evaluate(el=>el.closest('section').scrollTop=0);await page.screenshot({path:'/tmp/arena-fetch-phone.png',fullPage:true});
 await page.setViewportSize({width:1024,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);assert.deepEqual(provider,[]);console.log('PASS: fetch both IDs, external opponent, attack-vs-defence, Holger calculations/logs, wrong-state and delayed response rejection, preserved roster, phone/desktop; no live provider calls.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
