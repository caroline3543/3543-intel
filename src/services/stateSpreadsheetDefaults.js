import {normalizeStateId} from './stateWorkspaceService.js';
const PREFIX='wos_google_sheet_default_v1:';
export function normalizeSpreadsheetId(value){
 const raw=String(value??'').trim();
 const match=raw.match(/(?:https?:\/\/)?docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/i);
 const id=match?match[1]:raw;
 if(!/^[A-Za-z0-9_-]{15,200}$/.test(id))throw Error('Enter a valid Google Sheets link or spreadsheet ID.');
 return id;
}
export function readStateSheet(stateId,storage=globalThis.localStorage){
 try{return storage.getItem(PREFIX+normalizeStateId(stateId))||'';}catch{return '';}
}
export function saveStateSheet(stateId,value,storage=globalThis.localStorage){
 const id=normalizeSpreadsheetId(value);
 storage.setItem(PREFIX+normalizeStateId(stateId),id);
 return id;
}
export function clearStateSheet(stateId,storage=globalThis.localStorage){
 storage.removeItem(PREFIX+normalizeStateId(stateId));
}
