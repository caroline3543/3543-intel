// City drag-and-drop regression + map render budget for the vendored Bear Hive planner.
// Runs against the standalone planner served statically (no React build needed):
//   python3 -m http.server 4173 --directory public   (or: npx vite preview / vite dev)
//   HIVE_STATIC_URL=http://127.0.0.1:4173/hive/index.html node tests/hiveCityDragBrowser.cjs
// Uses only synthetic demo data in an isolated browser context. No network/provider calls.
const {chromium}=require(process.env.HIVE_PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
const BASE=(process.env.HIVE_STATIC_URL || 'http://127.0.0.1:4173/hive/index.html')+'?state=3543&alliance=LUN';
// Generous budgets: they catch regressions (e.g. a render-per-event storm), not micro-tuning.
const MAX_RENDERS_PER_MOVE=Number(process.env.HIVE_MAX_RENDERS_PER_MOVE || 2);
const MAX_AVG_RENDER_MS=Number(process.env.HIVE_MAX_AVG_RENDER_MS || 40);

(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.HIVE_CHROMIUM_PATH?{executablePath:process.env.HIVE_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE);
 // Seed a deterministic demo plan for this workspace, then reload so the planner boots from it.
 await page.evaluate(()=>{const d=Hive.demo();d.settings.state='3543';d.settings.alliance='LUN';localStorage.setItem(HiveEmbed.key,JSON.stringify(d))});
 await page.reload();
 await page.waitForFunction(()=>typeof state!=='undefined'&&state.members.some(m=>m.slot));

 // Instrument the global render to count calls and time spent (wraps whatever renderMap currently is).
 await page.evaluate(()=>{const inner=renderMap;window.__renders={n:0,ms:0};renderMap=function(){const t=performance.now();inner.apply(this,arguments);__renders.n++;__renders.ms+=performance.now()-t}});

 async function cityTarget(){return page.evaluate(()=>{
  const vp=document.querySelector('#mapViewport').getBoundingClientRect();
  const cands=state.members.filter(m=>m.slot&&!m.locked).map(m=>({m,s:state.slots.find(s=>s.id===m.slot)})).filter(x=>x.s);
  for(const {m,s} of cands){const p=point(s.x+1,s.y+1),x=vp.left+p.x,y=vp.top+p.y;
   if(x>vp.left+40&&x<vp.right-40&&y>vp.top+40&&y<vp.bottom-40)return{id:m.id,slot:{x:s.x,y:s.y},x,y}}
  return null})}
 let t=await cityTarget();
 if(!t){await page.evaluate(()=>{const m=state.members.find(m=>m.slot&&!m.locked),s=state.slots.find(s=>s.id===m.slot),p=point(s.x+1,s.y+1);camera.x+=view.w/2-p.x;camera.y+=view.h/2-p.y;renderMap()});t=await cityTarget()}
 assert.ok(t,'a movable city must be visible in the phone viewport');

 // 1) Tap selects the city.
 await page.mouse.click(t.x,t.y);await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>selectedMapItem?.id),t.id,'tap selects the city');
 // Selecting can open a details panel that resizes the viewport, so re-measure the city on screen.
 const sel=await page.evaluate(id=>{const vp=document.querySelector('#mapViewport').getBoundingClientRect(),m=state.members.find(m=>m.id===id),s=state.slots.find(s=>s.id===m.slot),p=point(s.x+1,s.y+1);return{x:vp.left+p.x,y:vp.top+p.y}},t.id);t.x=sel.x;t.y=sel.y;

 // 2) Drag it to the nearest free, valid on-screen position (found with the planner's own pure
 //    Hive.moveCity rule, which copies state and throws on invalid drops). Count renders per move.
 const dest=await page.evaluate(({id,slot})=>{
  const vp=document.querySelector('#mapViewport').getBoundingClientRect();
  for(let r=1;r<=8;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){
   if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=slot.x+dx,y=slot.y+dy;
   try{Hive.moveMapItem(state,{kind:'member',id},x,y)}catch{continue}
   const p=point(x+1,y+1),sx=vp.left+p.x,sy=vp.top+p.y;
   if(sx>vp.left+40&&sx<vp.right-40&&sy>vp.top+40&&sy<vp.bottom-40)return{x,y,sx,sy}}
  return null},{id:t.id,slot:t.slot});
 assert.ok(dest,'a free valid destination is visible near the city');
 const before=await page.evaluate(()=>({...__renders}));const STEPS=20;
 await page.mouse.move(t.x,t.y);await page.mouse.down();
 for(let i=1;i<=STEPS;i++)await page.mouse.move(t.x+(dest.sx-t.x)*i/STEPS,t.y+(dest.sy-t.y)*i/STEPS);
 const during=await page.evaluate(()=>({...__renders,drag:mapDrag&&{x:mapDrag.x,y:mapDrag.y,started:mapDrag.started}}));
 await page.mouse.up();await page.waitForTimeout(200);
 const renders=during.n-before.n,avg=renders?(during.ms-before.ms)/renders:0;
 assert.ok(during.drag?.started,"drag armed on the selected city (not a map pan)");console.log(`city drag: ${renders} renders for ${STEPS} moves, avg ${avg.toFixed(2)}ms/render`);

 const after=await page.evaluate(id=>{const m=state.members.find(m=>m.id===id),s=state.slots.find(s=>s.id===m.slot);return s?{x:s.x,y:s.y}:null},t.id);
 assert.ok(after,'city keeps a slot after the drop');
 assert.deepEqual(after,{x:dest.x,y:dest.y},'drop moves the city to the release point');

 // 3) Undo restores the original position (Undo button or Ctrl+Z equivalent exposed by the planner).
 const undone=await page.evaluate(id=>{document.querySelector('#undoBtn')?.click();const m=state.members.find(m=>m.id===id),s=state.slots.find(s=>s.id===m.slot);return s?{x:s.x,y:s.y}:null},t.id);
 assert.deepEqual(undone,t.slot,'undo restores the original city position');

 // 4) Locked cities do not move.
 await page.evaluate(id=>{commit(()=>{state.members.find(m=>m.id===id).locked=true});renderMap()},t.id);
 await page.mouse.click(t.x,t.y);await page.waitForTimeout(400);
 await page.mouse.move(t.x,t.y);await page.mouse.down();for(let i=1;i<=10;i++)await page.mouse.move(t.x+i*4,t.y+i*3);await page.mouse.up();
 const locked=await page.evaluate(id=>{const m=state.members.find(m=>m.id===id),s=state.slots.find(s=>s.id===m.slot);return{x:s.x,y:s.y}},t.id);
 assert.deepEqual(locked,t.slot,'locked city stays put');

 // 5) Persistence: reload keeps the lock and position.
 await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state.members.length>0);
 assert.equal(await page.evaluate(id=>state.members.find(m=>m.id===id).locked,t.id),true,'lock persists after reload');

 // Budgets last, so correctness failures are reported first.
 assert.ok(renders/STEPS<=MAX_RENDERS_PER_MOVE,`render storm: ${renders} renders for ${STEPS} pointermoves (budget ${MAX_RENDERS_PER_MOVE}/move)`);
 assert.ok(avg<=MAX_AVG_RENDER_MS,`slow render: avg ${avg.toFixed(1)}ms (budget ${MAX_AVG_RENDER_MS}ms)`);
 assert.deepEqual(errors,[],'no page errors');
 await browser.close();console.log('hive city drag: ok');
})().catch(e=>{console.error(e);process.exit(1)});
