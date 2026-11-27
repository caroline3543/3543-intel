import {chromium} from 'playwright';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {sharedData,validateWorkspace} from '../roster-site/shared/workspace.js';

const initial=sharedData({players:[{id:'hermes',username:'HΞRMΞS',allianceTag:'HOT'}]});
let remote={revision:1,data:initial},offline=false;
const server=await createServer({root:process.cwd(),configFile:false,server:{host:'127.0.0.1',port:4192,strictPort:true},plugins:[{name:'isolated-workspace-test',configureServer(s){s.middlewares.use('/api/workspace',async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 try{
 if(req.method==='POST'){
 if(offline){res.statusCode=503;res.end(JSON.stringify({error:'Test network failure'}));return;}
 let body='';for await(const chunk of req)body+=chunk;
 const input=JSON.parse(body);const data=input.encoded?JSON.parse(gunzipSync(Buffer.from(input.encoded,'base64')).toString()):input.data;
 validateWorkspace(data);
 if(input.revision!==remote.revision){res.statusCode=409;res.end(JSON.stringify({...remote,conflict:true}));return;}
 remote={revision:remote.revision+1,data};
 }
 res.end(JSON.stringify(remote));
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}
 });s.middlewares.use('/alias-test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Isolated alias persistence test</title>');});}}]});
let browser;
try{
 await server.listen();browser=await chromium.launch({headless:true});
 async function device(){
 const context=await browser.newContext();const page=await context.newPage();await page.goto('http://127.0.0.1:4192/alias-test');
 await page.evaluate(async()=>{
 const {createSharedWorkspace,workspaceCache,workspaceRequest}=await import('/roster-site/src/sharedWorkspace.js');
 const {createScreenshotMatcher}=await import('/roster-site/src/foundry/screenshotImportPlan.js');
 const controller=createSharedWorkspace({initial:{players:[]},cache:workspaceCache(),request:workspaceRequest});
 window.client=controller;
 window.matchAlias=()=>createScreenshotMatcher(controller.getState().local.players.map(p=>({...p,name:p.username,alliance:p.allianceTag})),'HOT')('HERMES').player?.id??null;
 await controller.initialize();
 });
 return {context,page};
 }
 const a=await device(),b=await device();
 assert.equal(await b.page.evaluate(()=>window.matchAlias()),null);
 offline=true;
 await a.page.evaluate(async()=>{await window.client.update(prev=>({...prev,players:prev.players.map(p=>({...p,ocrAliases:['HERMES']}))}));await window.client.sync();});
 assert.ok(await a.page.evaluate(()=>window.client.getState().issue));
 await b.page.evaluate(()=>window.client.sync());
 assert.equal(await b.page.evaluate(()=>window.matchAlias()),null);
 offline=false;
 await a.page.evaluate(()=>window.client.sync());
 assert.deepEqual(remote.data.players[0].ocrAliases,['HERMES']);
 await b.page.evaluate(()=>window.client.sync());
 assert.equal(await b.page.evaluate(()=>window.matchAlias()),'hermes');
 await a.context.close();await b.context.close();
 const c=await device();assert.equal(await c.page.evaluate(()=>window.matchAlias()),'hermes');
 await c.context.close();
 console.log('PASS: independent Chromium contexts, real HTTP and IndexedDB, failed save/retry, fresh browser retrieval');
}finally{await browser?.close();await server.close();}
