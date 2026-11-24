import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import postgres from 'postgres';
import {createMembershipQueueAdapter} from '../src/services/automaticMembershipQueueAdapter.js';
import {createManualMembershipStore,processManualMembershipBatch} from '../src/services/manualMembershipRefresh.js';
import refreshHandler from '../roster-site/api/membership-refresh.js';
import {sessionToken} from '../roster-site/server/access.js';

const database=process.env.MEMBERSHIP_TEST_DATABASE_URL;
if(!database)throw Error('Set MEMBERSHIP_TEST_DATABASE_URL to an isolated localhost PostgreSQL database');
const address=new URL(database);
if(address.hostname!=='127.0.0.1'||address.pathname!=='/membership_test')throw Error('Fixture database must be local membership_test');
const sql=postgres(database,{max:4,prepare:false});
const query=async(statement,params=[])=>Array.from(await sql.unsafe(statement,params));
const queue=createMembershipQueueAdapter({query});
const store=createManualMembershipStore(query,queue);
const origin=process.env.STATE_3573_PREVIEW_URL||'http://127.0.0.1:4177';
const server=process.env.STATE_3573_PREVIEW_URL?null:
  spawn('./node_modules/.bin/vite',['preview','roster-site','--host','127.0.0.1','--port','4177','--strictPort'],{stdio:'inherit'});
const serverFetch=globalThis.fetch;
const fixtureApi='https://isolated-fixture.invalid';
const date=new Date(Date.now()-30000).toISOString();
const fids=Array.from({length:649},(_,index)=>String(800000001+index));
const tags=['ARC','HOT','RKG','WAR','LUN','FARM',''];
const fixture={players:fids.map((fid,index)=>({
  id:fid,fid,username:'Test player '+String(index+1).padStart(3,'0'),stateId:'3573',
  allianceTag:tags[index%tags.length],cityPower:1000000,furnaceLevel:'FC6',
  ...(index>=569?{membershipLastSuccessfulAt:date}:{}),
  ...(index===0?{notes:'Keep manual notes'}:{})
})),events:[],customRoles:[],settings:{stateId:'3573',lastApiRefresh:{at:date,count:362,scope:'HOT, ARC, RKG, LUN'}}};
const config={SESSION_SECRET:'isolated-browser-fixture-secret-with-adequate-length',ACCESS_PASSWORD_HASH:'fixture:hash',
  GAME_API_URL:fixtureApi,GAME_API_PUBLIC_KEY:'fixture',GAME_SITE_TOKEN:'fixture',
  VERCEL_ENV:'preview',STATE_3573_PREVIEW_API_ORIGIN:fixtureApi};
Object.assign(process.env,config);
const cookie='__Host-caroline_access='+sessionToken(config);
const readWorkspace=async()=>{
  const [row]=await sql`select data,revision from public.caroline_workspaces where id='3573-leaders'`;
  return {data:row.data,revision:Number(row.revision)};
};
const refreshStatus=async(start=false)=>(await sql`select public.caroline_3573_manual_refresh(${start}) as refresh`)[0].refresh;
globalThis.fetch=async(url,options)=>{
  if(String(url)===fixtureApi+'/functions/v1/caroline3573-workspace'){
    const input=JSON.parse(options.body);
    assert.equal(input.workspaceId,'3573-leaders');
    assert.equal(input.action,'membership-refresh');
    return Response.json({refresh:await refreshStatus(input.start)});
  }
  return serverFetch(url,options);
};
let browser;
const errors=[];
let initialized=false;
const requestFids=new Set();
let usageDay=0;
const api={
  usage:async()=>({used:usageDay,minuteUsed:0}),
  verifyBatch:async(ids)=>{
    usageDay+=ids.length;
    for(const id of ids)requestFids.add(id);
    const lookups=ids.filter(fid=>fid!==fids[3]).map(fid=>{
      const index=fids.indexOf(fid);
      const tag=index===0?'FARM':index===1?'':tags[index%tags.length];
      const membership=index===2?{}:{alliance:tag?{abbr:tag}:null};
      return {ok:true,fresh:true,chief_id:fid,cached_at:date,player:{chief_id:fid,kid:3573,...membership}};
    });
    return {status:200,body:{players:lookups,not_found:ids.filter(fid=>fid===fids[3])}};
  }
};

try{
  const [{count}]=await sql`select count(*)::integer as count from public.caroline_workspaces`;
  assert.equal(count,0,'Fixture requires an empty, isolated database');
  initialized=true;
  await sql`insert into public.caroline_workspaces (id,data) values ('3573-leaders',${sql.json(fixture)})`;
  if(server)for(let i=0;i<80;i++){
    try{if((await fetch(origin)).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
  for(const width of [390,1280]){
    const context=await browser.newContext({viewport:{width,height:844}});
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/**',async route=>{
      const request=route.request(), url=new URL(request.url());
      if(url.pathname==='/api/session')return route.fulfill({status:200,json:{authenticated:true,role:'leader'}});
      if(url.pathname==='/api/transfers')return route.fulfill({status:200,json:{events:[]}});
      if(url.pathname==='/api/workspace'){
        assert.equal(request.method(),'GET','Browser must not write the verified roster');
        const workspace=await readWorkspace();
        return route.fulfill({status:200,json:{...workspace,role:'leader'}});
      }
      if(url.pathname==='/api/priority-roster-refresh'){
        assert.equal(request.method(),'POST');
        return route.fulfill({status:200,json:{succeeded:['ARC','HOT','RKG','WAR','LUN'],unavailable:[],found:465,missing:0,queued:0}});
      }
      if(url.pathname==='/api/membership-refresh'){
        const response={
          code:500,setHeader(){},status(code){this.code=code;return this;},
          json(data){return {status:this.code,json:data};}
        };
        const result=await refreshHandler({
          method:request.method(),headers:{cookie,host:url.host,origin:'https://'+url.host}
        },response);
        return route.fulfill(result);
      }
      return route.fulfill({status:503,json:{error:'Lookup disabled in fixture'}});
    });
    await page.goto(origin);
    await page.getByText('649 active players',{exact:true}).waitFor();
    const tour=page.getByRole('dialog',{name:/Load your alliances/i});
    if(await tour.isVisible())await tour.getByRole('button',{name:'Skip'}).click();
    const chips=page.getByRole('group',{name:'Filter by alliance'});
    assert.deepEqual((await chips.getByRole('button').allTextContents()).slice(1,6).map(text=>text.split(' · ')[0]),tags.slice(0,5));
    assert.equal(await page.getByText(/accounts? need membership review/).count(),0);
    await page.getByLabel('More workspace actions').click();
    if(width===390){
      await page.getByText('569 active players without a verified refresh in the past 72 hours').waitFor();
      await page.getByRole('button',{name:'Refresh priority alliances',exact:true}).first().click();
      await page.getByText(/5 of 5 alliance lists refreshed/).waitFor();
      const [a,b]=await Promise.all([refreshStatus(true),refreshStatus(true)]);
      assert.equal(a.id,b.id,'Simultaneous organisers must see one persisted job');
      // Drain the persisted queue while the browser is closed. Backoff is
      // accelerated in this isolated fixture, and the budget function still runs.
      await context.close();
      for(let tick=0;tick<45;tick++){
        await processManualMembershipBatch({store,api});
        const status=await refreshStatus();
        if(status.completedAt)break;
        await sql`update membership_3573.refresh_jobs set due_at=now()-interval '1 hour' where manual_run_id is not null and status='pending' and attempts>0`;
        await sql`delete from membership_3573.minute_reservations`;
      }
      const summary=await refreshStatus();
      assert.ok(summary.completedAt);
      assert.equal(requestFids.size,649);
      assert.deepEqual([
        summary.requestsAttempted,summary.httpSucceeded,summary.playerAttempts,summary.validPlayers,
        summary.validMembership,summary.persisted,summary.updated,summary.unchanged,summary.missing,summary.failed
      ],[33,33,653,648,647,567,2,645,1,1]);
      const persisted=await readWorkspace();
      assert.equal(persisted.data.players[0].allianceTag,'FARM');
      assert.equal(persisted.data.players[0].allianceHistory.length,1);
      assert.equal(persisted.data.players[0].notes,'Keep manual notes');
      assert.equal(persisted.data.players[1].allianceTag,'');
      assert.equal(persisted.data.players[2].membershipLastSuccessfulAt,undefined);
      console.log('Refresh evidence', JSON.stringify(summary));
      continue;
    }
    await page.getByText('Move & transfer verification complete',{exact:true}).waitFor();
    await page.getByText('2 active players without a verified refresh in the past 72 hours').waitFor();
    await page.getByText('2 changed · 645 unchanged').waitFor();
    await page.getByText('1 missing membership · 1 failed').waitFor();
    await page.getByText('Refresh details',{exact:true}).click();
    await page.getByText('567 saved to the shared roster').waitFor();
    await page.getByLabel('More workspace actions').click();
    await chips.getByRole('button',{name:/More/}).click();
    await page.getByRole('button',{name:/^FARM ·/}).click();
    await page.getByText('Test player 001',{exact:true}).click();
    await page.getByRole('dialog',{name:'Player profile: Test player 001'}).getByText(/^Membership verified (just now|\d+ (minute|hour|day)s? ago)$/).waitFor();
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS mobile and desktop browser, background completion, and PostgreSQL-to-roster visibility');
}finally{
  if(browser)await browser.close();
  if(server)server.kill('SIGTERM');
  if(initialized){
    await sql`delete from membership_3573.manual_refresh_runs`;
    await sql`delete from membership_3573.refresh_usage`;
    await sql`delete from membership_3573.minute_reservations`;
    await sql`delete from public.caroline_workspaces where id='3573-leaders'`;
  }
  await sql.end();
}
