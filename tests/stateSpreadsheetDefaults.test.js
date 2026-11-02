import test from 'node:test';
import assert from 'node:assert/strict';
import {readStateSheet,saveStateSheet,clearStateSheet,normalizeSpreadsheetId} from '../src/services/stateSpreadsheetDefaults.js';
test('State default sheets are isolated and persist as IDs',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const id='1fGK_RpX6KRWXeMLza0lxhjB8uBfJ5-m-MF4FHyVcqHc';
 saveStateSheet('3543','https://docs.google.com/spreadsheets/d/'+id+'/edit',storage);
 assert.equal(readStateSheet('3543',storage),id);
 assert.equal(readStateSheet('3573',storage),'');
 clearStateSheet('3543',storage);
 assert.equal(readStateSheet('3543',storage),'');
});
test('Invalid spreadsheet ID cannot be saved',()=>{
 assert.throws(()=>normalizeSpreadsheetId('not a url'),/valid Google Sheets/);
});

test('Sheets API refresh opens the existing reviewed alliance import workflow',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
 const sheets=readFileSync(new URL('../src/components/spreadsheets/SpreadsheetManager.jsx',import.meta.url),'utf8');
 assert.ok(app.includes('onPullApiData={()=>setAlliancePanel(true)}'));
 assert.ok(sheets.includes('onClick={onPullApiData}'));
 assert.ok(sheets.includes('Pull / refresh API player data'));
});

test('Spreadsheet preview allows selecting and adding state workspaces while keeping state-specific links',async()=>{const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../src/components/spreadsheets/SpreadsheetManager.jsx',import.meta.url),'utf8');const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');assert.ok(source.includes('Spreadsheet state'));assert.ok(source.includes('Add & select'));assert.ok(source.includes('onSelectSheetState?.(id)'));assert.ok(app.includes('saveToStorage(data,true);selectWorkspace(id)'));});

test('Cloud state defaults require authenticated owner and keep state association',async()=>{const {readFileSync}=await import('node:fs');const api=readFileSync(new URL('../supabase/functions/sheets-state-default/index.ts',import.meta.url),'utf8');const ui=readFileSync(new URL('../src/components/spreadsheets/SpreadsheetManager.jsx',import.meta.url),'utf8');assert.ok(api.includes('user?.id!==OWNER'));assert.ok(api.includes(".eq('state_id',state)"));assert.ok(ui.includes("stateDefaultRequest('GET')"));assert.ok(ui.includes("stateDefaultRequest('POST',{stateId,spreadsheetId:normalized})"));});

test('Sheets UX prioritizes state link and preview with clear manual update labels',async()=>{const {readFileSync}=await import('node:fs');const s=readFileSync(new URL('../src/components/spreadsheets/SpreadsheetManager.jsx',import.meta.url),'utf8');assert.ok(s.indexOf('Spreadsheet state')<s.indexOf('Spreadsheet link'));assert.ok(s.indexOf('Spreadsheet link')<s.indexOf('Update player records'));assert.ok(s.includes('Refresh Google worksheets'));assert.ok(s.includes('Create a new Google spreadsheet</summary>'));assert.ok(s.includes('Automatic app-to-Google updates are not enabled yet.'));});
