const {chromium}=require(process.env.HIVE_PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.HIVE_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let requests=0;
 await page.route('**/src/services/mightpulseService.js',route=>route.fulfill({contentType:'application/javascript',body:`
 export async function mightpulseRequest(action,params={}){const r=await fetch('/__watch_fixture',{method:'POST',body:JSON.stringify({action,...params})});const data=await r.json();if(!r.ok)throw new Error(data.error);return data;}
 export const fetchMightpulseAlliance=(state,tag)=>mightpulseRequest('alliance',{state,tag});
 export const fetchMightpulseUsage=()=>mightpulseRequest('usage');
 `}));
 await page.route('**/__watch_fixture',route=>{
  const body=route.request().postDataJSON();assert.equal(body.action,'alliance');assert.equal(body.state,3573);assert.equal(body.tag,'LUN');requests++;
  const member=(id,power,fc)=>({chief_id:id,kid:3573,nick_name:'Player '+id,power,furnace_level:fc,kills:0});
  const members=requests===1?[member(1,1000,55),member(2,1000,55)]:[member(1,1200,60),member(3,9000,55)];
  return route.fulfill({json:{retrieved_at:requests===1?'2026-10-22T00:00:00Z':'2026-10-23T00:00:00Z',data:{alliance:{kid:3573},members}}});
 });
 await page.addInitScript(()=>{
  if(localStorage.getItem('watch-fixture'))return;localStorage.setItem('watch-fixture','1');localStorage.setItem('svs_onboarded','1');
  localStorage.setItem('svs_state_workspaces_v1',JSON.stringify({version:1,activeStateId:'3573',states:['3573']}));
  localStorage.setItem('svs_rally_data:state:3573',JSON.stringify({settings:{stateId:'3573'},players:[],events:[],svsPlans:[],customRoles:[]}));
 });
 const open=async()=>{await page.getByRole('button',{name:/Intel$/}).click();await page.getByRole('button',{name:/Alliance watch →/}).click();};
 await page.goto(process.env.HIVE_BASE_URL || 'http://127.0.0.1:5183/',{waitUntil:'networkidle'});await open();
 await page.getByLabel('Alliance to watch').fill('LUN');await page.getByRole('button',{name:'Watch alliance',exact:true}).click();
 assert.equal(requests,0);
 await page.getByRole('button',{name:'Refresh [LUN]',exact:true}).click();await page.getByText('[LUN] · 2 returned members',{exact:true}).waitFor();
 assert.equal(requests,1);
 await page.getByRole('button',{name:'Refresh [LUN]',exact:true}).click();await page.getByText(/Power change: \+200 across 1 members/).waitFor();
 await page.getByLabel('Alliance change period').selectOption('all');
 await page.getByLabel('Alliance change type').selectOption('furnaceLevel');await page.getByText('Furnace: FC5 → FC6',{exact:true}).waitFor();
 await page.getByLabel('Alliance change type').selectOption('powerSpike');await page.getByText(/Power: 1,000 → 1,200/).waitFor();
 await page.getByLabel('Alliance change type').selectOption('missing');await page.getByText('Player 2',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('svs_rally_data:state:3573')).players.length),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.reload({waitUntil:'networkidle'});await open();await page.getByText('[LUN] · 2 returned members',{exact:true}).waitFor();assert.equal(requests,2);
 await page.getByRole('button',{name:'Refresh all alliances',exact:true}).click();await page.getByRole('button',{name:'Refresh [LUN]',exact:true}).waitFor();
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove watch',exact:true}).click();await page.getByText(/Add an alliance, then refresh/).waitFor();
 assert.deepEqual(errors,[]);console.log('Mobile watch flow passed: baseline, whole-roster comparison, filters, separate roster, persistence, refresh all and removal.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
