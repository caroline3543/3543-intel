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

 await page.goto(process.env.HIVE_BASE_URL || 'http://127.0.0.1:5173/',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/Intel$/}).click();await page.getByRole('button',{name:/Arena comparison/}).click();
 await page.getByLabel('Your player',{exact:true}).selectOption('a');await page.getByLabel('Opponent',{exact:true}).selectOption('b');
 const board=page.getByRole('group',{name:'Your fixture · Attack formation',exact:true}),opponent=page.getByRole('group',{name:'Opponent fixture · Defence formation',exact:true});
 const slot=n=>board.locator('[data-arena-slot="'+n+'"]');
 await board.scrollIntoViewIfNeeded();
 const centre=async el=>{const b=await el.boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2}};
 const first=await centre(slot(0)),third=await centre(slot(2));
 await page.mouse.move(first.x,first.y);await page.mouse.down();await page.mouse.move(third.x,third.y,{steps:8});
 assert.equal(await board.locator('[data-arena-slot="2"]').evaluate(el=>el.style.borderColor),'rgb(245, 166, 35)');
 await page.mouse.up();assert.equal(await page.getByLabel('Your team Front left',{exact:true}).inputValue(),'saved-50004');assert.equal(await page.getByLabel('Your team Back left',{exact:true}).inputValue(),'saved-50006');
 assert.equal(await slot(0).getAttribute('aria-pressed'),'false');await board.getByRole('button',{name:'Undo portrait move',exact:true}).click();assert.equal(await page.getByLabel('Your team Front left',{exact:true}).inputValue(),'saved-50006');
 // Real browser touch events exercise Pointer Events, capture and drop targeting.
 const cdp=await page.context().newCDPSession(page);await board.scrollIntoViewIfNeeded();const start=await centre(slot(0)),end=await centre(slot(4));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:start.x,y:start.y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:end.x,y:end.y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await page.getByLabel('Your team Back right',{exact:true}).inputValue(),'saved-50006');assert.equal(await page.getByLabel('Opponent Back right',{exact:true}).inputValue(),'saved-50012');await board.getByRole('button',{name:'Undo portrait move',exact:true}).click();
 // Keyboard and tap fallback; Escape cancels selection.
 await slot(1).focus();await page.keyboard.press('Enter');assert.equal(await slot(1).getAttribute('aria-pressed'),'true');await slot(3).focus();await page.keyboard.press('Space');assert.equal(await page.getByLabel('Your team Back centre',{exact:true}).inputValue(),'saved-50001');await board.getByRole('button',{name:'Undo portrait move',exact:true}).click();
 await slot(0).click();await page.keyboard.press('Escape');assert.equal(await slot(0).getAttribute('aria-pressed'),'false');
 // Cross-board drops and pointer cancellation must not change either team.
 await board.scrollIntoViewIfNeeded();const a=await centre(slot(0)),b=await centre(opponent.locator('[aria-label*="Front left"]').first());
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();assert.equal(await page.getByLabel('Your team Front left',{exact:true}).inputValue(),'saved-50006');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:2,x:a.x,y:a.y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:2,x:a.x+30,y:a.y+20}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await page.getByLabel('Your team Front left',{exact:true}).inputValue(),'saved-50006');
 assert.equal(await opponent.locator('[data-arena-slot]').count(),0);
 await opponent.getByRole('button',{name:'Adjust defence positions',exact:true}).click();
 await opponent.locator('[data-arena-slot="0"]').click();await opponent.locator('[data-arena-slot="2"]').click();
 assert.equal(await page.getByLabel('Opponent Front left',{exact:true}).inputValue(),'saved-50004');
 await opponent.getByRole('button',{name:'Undo portrait move',exact:true}).click();await opponent.getByRole('button',{name:'Lock defence positions',exact:true}).click();
 assert.equal(await opponent.locator('[data-arena-slot]').count(),0);
 await page.getByText('Arena rules & skill formulas',{exact:true}).click();await page.getByText('Alonso: skills & scaling',{exact:true}).click();await page.getByLabel('Alonso reference level',{exact:true}).selectOption('5');await page.getByLabel('Alonso reference Attack',{exact:true}).fill('1000');await page.getByText('2,800',{exact:true}).waitFor();
 await page.getByText('Arena rules & skill formulas',{exact:true}).click();
 await page.setViewportSize({width:320,height:844});await board.scrollIntoViewIfNeeded();for(const b of await board.getByRole('button').all()){const rect=await b.boundingBox();assert.ok(rect.width>=44&&rect.height>=44)}
 assert.equal(await page.getByRole('heading',{name:'Arena comparison',exact:true}).evaluate(el=>{const panel=el.closest('section');return panel.scrollWidth>panel.clientWidth}),false);
 await page.setViewportSize({width:390,height:844});await page.getByRole('heading',{name:'Arena comparison',exact:true}).evaluate(el=>el.closest('section').scrollTop=0);await page.screenshot({path:'/tmp/arena-drag-phone.png',fullPage:true});
 await page.setViewportSize({width:1024,height:800});await board.scrollIntoViewIfNeeded();const x=await centre(slot(0)),y=await centre(slot(2));await page.mouse.move(x.x,x.y);await page.mouse.down();await page.mouse.move(y.x,y.y,{steps:8});await page.mouse.up();assert.equal(await page.getByLabel('Your team Front left',{exact:true}).inputValue(),'saved-50004');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('svs_rally_data:state:3573')).players[0].notes),'Preserve me');assert.deepEqual(provider,[]);assert.deepEqual(errors,[]);
 console.log('PASS: mouse/touch portrait swaps, targets, undo, keyboard/tap, cancellation, locked opponent, 320px touch targets, skill arithmetic and desktop; no provider calls or roster changes.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
