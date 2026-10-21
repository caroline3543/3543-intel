#!/usr/bin/env node
// Runs the Playwright browser suites (tests/*Browser.cjs) at iPhone size (390×844, touch).
// - Hive planner tests that only need static files get a tiny built-in static server (public/).
// - App-level tests need the Vite dev server; it is started automatically when node_modules exists.
// Synthetic fixtures only: no real sessions, no provider calls, no production data.
// Env: HIVE_PLAYWRIGHT_PATH / HIVE_CHROMIUM_PATH to point at a local Playwright install.
//   npm run test:browser            npm run test:browser -- hiveCityDrag   (filter by name)
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {readdirSync,existsSync} from 'node:fs';
import {join,extname,normalize} from 'node:path';
import {spawn} from 'node:child_process';

const ROOT=new URL('..',import.meta.url).pathname;
const filter=process.argv[2]||'';
const STATIC_ONLY=new Set(['hiveCityDragBrowser.cjs']); // need only public/, not the React app
const files=readdirSync(join(ROOT,'tests')).filter(f=>f.endsWith('Browser.cjs')&&f.includes(filter)).sort();
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};

const pub=join(ROOT,'public');
const server=createServer(async(req,res)=>{try{const u=decodeURIComponent(new URL(req.url,'http://x').pathname),p=normalize(join(pub,u));if(!p.startsWith(pub))throw 0;
 res.writeHead(200,{'Content-Type':types[extname(p)]||'application/octet-stream'});res.end(await readFile(p))}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));

let vite=null;
const needsApp=files.some(f=>!STATIC_ONLY.has(f));
if(needsApp){
 if(!existsSync(join(ROOT,'node_modules/.bin/vite'))){console.error('App-level browser tests need `npm ci` first (vite missing).');}
 else{vite=spawn(join(ROOT,'node_modules/.bin/vite'),['--port','5173','--strictPort','--host','127.0.0.1'],{cwd:ROOT,stdio:['ignore','pipe','pipe']});
  await new Promise((ok,bad)=>{const t=setTimeout(()=>bad(Error('vite did not start in 60s')),60000);vite.stdout.on('data',d=>{if(/Local:|ready in/.test(d))(clearTimeout(t),ok())});vite.on('exit',c=>bad(Error('vite exited '+c)))});}
}

const results=[];
for(const f of files){
 if(!STATIC_ONLY.has(f)&&!vite){results.push([f,'skipped (no vite)']);continue}
 const code=await new Promise(r=>{const c=spawn(process.execPath,[join(ROOT,'tests',f)],{stdio:'inherit',env:{...process.env,HIVE_STATIC_URL:'http://127.0.0.1:4173/hive/index.html',HIVE_BASE_URL:'http://127.0.0.1:5173/'}});c.on('exit',r)});
 results.push([f,code===0?'pass':'FAIL']);
}
server.close();vite?.kill();
console.log('\nBrowser suites:');for(const [f,s] of results)console.log(`  ${s.padEnd(18)} ${f}`);
// In CI (REQUIRE_APP=1) a skipped app suite is a failure, so missing setup can't pass silently.
process.exit(results.some(([,s])=>s==='FAIL'||(process.env.REQUIRE_APP&&s.startsWith('skipped')))?1:0);
