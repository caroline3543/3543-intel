#!/usr/bin/env node
// Enforces CONSTITUTION.md / CLAUDE.md rules that a machine can check.
// Hard rules fail immediately. Legacy debt is ratcheted against scripts/quality-baseline.json:
// it may shrink, never grow. Run: npm run check:rules   (add --update-baseline after paying debt down)
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=new URL('..',import.meta.url).pathname;
const BASELINE_PATH=join(ROOT,'scripts/quality-baseline.json');
const baseline=JSON.parse(readFileSync(BASELINE_PATH,'utf8'));
const update=process.argv.includes('--update-baseline');
const fails=[],notes=[];

function walk(dir,out=[]){for(const n of readdirSync(dir)){const p=join(dir,n);statSync(p).isDirectory()?walk(p,out):out.push(p)}return out}
const src=walk(join(ROOT,'src')).filter(f=>/\.(jsx?|mjs)$/.test(f));
const rel=f=>relative(ROOT,f);
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`])\/\/.*$/gm,'$1'); // ignore comments

// ── Hard rules ──────────────────────────────────────────────────
for(const f of src){
 const code=strip(readFileSync(f,'utf8'));
 if(/\bwindow\.(confirm|alert|prompt)\s*\(|(^|[^.\w])(confirm|alert)\s*\(/m.test(code))fails.push(`${rel(f)}: window.confirm/alert/prompt is banned — use DeleteConfirmModal or inline two-step confirmation`);
 if(/from\s+['"](react-router|react-router-dom|@mui\/|@radix-ui\/|tailwindcss|styled-components|@emotion\/)/.test(code))fails.push(`${rel(f)}: banned UI/router library import`);
 if(/import\s+['"][^'"]+\.(css|scss|sass|less)['"]/.test(code))fails.push(`${rel(f)}: CSS file import — inline styles with C.* tokens only`);
}

// Secrets must never be committed. Only VITE_ public client config may ship to the browser.
let tracked=[];try{tracked=execFileSync('git',['ls-files'],{cwd:ROOT,encoding:'utf8'}).split('\n').filter(Boolean)}catch{notes.push('git unavailable: secret scan limited to src/')}
for(const t of tracked){
 if(/(^|\/)\.env(\.[\w-]+)?$/.test(t)&&t!=='.env.production'&&!t.endsWith('.example'))fails.push(`${t}: env file is tracked — remove it and rotate any keys it held`);
 if(/package-lock\.json$|\.(png|jpe?g|gif|webp|ico)$/.test(t))continue;
 let txt='';try{txt=readFileSync(join(ROOT,t),'utf8')}catch{continue}
 if(/sb_secret_[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}.*service_role|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bkss_[A-Za-z0-9]{12,}/.test(txt))fails.push(`${t}: looks like a committed secret (Supabase secret/service key, private key or MightPulse key)`);
 if(t==='.env.production'&&/^(?!VITE_|#)\w+=/m.test(txt))fails.push('.env.production: only VITE_* public client values are allowed here');
}

// ── Ratchets (legacy debt may shrink, never grow) ───────────────
const hex=src.filter(f=>f.endsWith('.jsx')).reduce((n,f)=>n+(strip(readFileSync(f,'utf8')).match(/['"`]#[0-9A-Fa-f]{6}\b/g)||[]).length,0);
const limits=[[/\/hooks\//,150],[/\/services\//,200],[/\.jsx$/,300]];
const oversize={};
for(const f of src){const lim=limits.find(([re])=>re.test(f))?.[1];if(!lim)continue;const n=readFileSync(f,'utf8').split('\n').length;if(n>lim)oversize[rel(f)]=n}

if(update){
 writeFileSync(BASELINE_PATH,JSON.stringify({...baseline,hardcodedHexInJsx:hex,oversizeFiles:oversize},null,2)+'\n');
 console.log(`baseline updated: ${hex} hardcoded hex, ${Object.keys(oversize).length} oversize files`);process.exit(0);
}
if(hex>baseline.hardcodedHexInJsx)fails.push(`hardcoded hex colours in .jsx grew ${baseline.hardcodedHexInJsx} → ${hex}; use C.* tokens from utils/constants.js`);
else if(hex<baseline.hardcodedHexInJsx)notes.push(`hardcoded hex shrank to ${hex} — run with --update-baseline to lock it in`);
for(const [f,n] of Object.entries(oversize)){
 const was=baseline.oversizeFiles[f];
 if(was===undefined)fails.push(`${f}: ${n} lines exceeds the size limit (components 300, hooks 150, services 200) — split it`);
 else if(n>was)fails.push(`${f}: already over the limit and grew ${was} → ${n} lines — split it before adding more`);
}

notes.forEach(n=>console.log('note:',n));
if(fails.length){console.error('Constitution check FAILED:\n- '+fails.join('\n- '));process.exit(1)}
console.log(`Constitution check passed (${src.length} source files, ${hex} legacy hex, ${Object.keys(oversize).length} legacy oversize files).`);
