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
