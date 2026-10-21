#!/usr/bin/env node
// Ratcheted JS type check (no TypeScript migration — see CONSTITUTION.md "TypeScript: not yet").
// Type-checks pure layers (services, utils, data) with checkJs and fails only if the error count
// grows past scripts/quality-baseline.json → typecheckErrors. Files that opt in with `// @ts-check`
// on line 1 must have ZERO errors. Missing-module errors (TS2307) are ignored so results match
// with or without node_modules. Requires `tsc` on PATH or `npx typescript`.
//   npm run typecheck            npm run typecheck -- --update-baseline
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const ROOT=new URL('..',import.meta.url).pathname;
const BASELINE_PATH=join(ROOT,'scripts/quality-baseline.json');
const baseline=JSON.parse(readFileSync(BASELINE_PATH,'utf8'));
const dir=mkdtempSync(join(tmpdir(),'typecheck-'));
const cfg=join(dir,'tsconfig.json');
writeFileSync(cfg,JSON.stringify({compilerOptions:{allowJs:true,checkJs:true,noEmit:true,target:'ES2022',module:'ESNext',moduleResolution:'Bundler',skipLibCheck:true,strict:false,lib:['ES2022','DOM'],types:[]},
 include:['src/services/**/*.js','src/utils/**/*.js','src/data/**/*.js'].map(g=>join(ROOT,g))}));

const tsc=process.env.TSC||'tsc';
let r=spawnSync(tsc,['-p',cfg,'--pretty','false'],{encoding:'utf8'});
if(r.error){r=spawnSync('npx',['--yes','typescript@6.0.3','tsc','-p',cfg,'--pretty','false'],{encoding:'utf8'});}
if(r.error){console.error('typecheck: tsc not available');process.exit(2)}
const lines=(r.stdout+r.stderr).split('\n').filter(l=>/error TS\d+/.test(l)&&!/TS2307/.test(l));
const optIn=lines.filter(l=>{const f=l.split('(')[0];try{return readFileSync(f.startsWith('/')?f:join(ROOT,f),'utf8').startsWith('// @ts-check')}catch{return false}});

if(process.argv.includes('--update-baseline')){writeFileSync(BASELINE_PATH,JSON.stringify({...baseline,typecheckErrors:lines.length},null,2)+'\n');console.log(`typecheck baseline set to ${lines.length}`);process.exit(0)}
if(optIn.length){console.error('Files with // @ts-check must be clean:\n'+optIn.join('\n'));process.exit(1)}
if(lines.length>baseline.typecheckErrors){console.error(lines.join('\n'));console.error(`\ntypecheck FAILED: ${lines.length} errors > baseline ${baseline.typecheckErrors}. Fix the new ones (listed above).`);process.exit(1)}
console.log(`typecheck passed: ${lines.length} legacy errors (baseline ${baseline.typecheckErrors}).`+(lines.length<baseline.typecheckErrors?' Shrank — run with --update-baseline.':''));
