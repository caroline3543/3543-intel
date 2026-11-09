import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {serviceAccountToken,readTalSheet} from '../roster-site/api/tal-sheet.js';
const email='tal-reader@example.iam.gserviceaccount.com';
test('Google Sheets rejects missing server credentials without exposing a token',async()=>{
 await assert.rejects(()=>serviceAccountToken(null),/not configured/);
 await assert.rejects(()=>readTalSheet({credential:null,fetcher:async()=>{throw Error('unexpected network call');}}),/not configured/);
});
test('service account token and read-only batchGet use precise source ranges',async()=>{
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const credential=JSON.stringify({client_email:email,private_key:privateKey.export({type:'pkcs8',format:'pem'}),token_uri:'https://oauth2.googleapis.com/token'});
 const requests=[];
 const fakeFetch=async (url,options)=>{
  requests.push({url:String(url),options});
  if(String(url).includes('/token'))return {ok:true,json:async()=>({access_token:'fake-token',expires_in:300})};
  return {ok:true,json:async()=>({valueRanges:[
   {values:[['Player ID','Username','Selection','Registration'],['12345','A','Selected','Verified']]},
   {values:[['Player ID','Username']]},{values:[['State','Player ID']]},
   {values:[['Username','Player ID']]},{values:[['Username','Player ID']]},
   {values:[['Username','Player ID']]},{values:[['Player ID','Game language']]}
  ]})};
 };
 const result=await readTalSheet({credential,fetcher:fakeFetch});
 assert.equal(result.spreadsheetId,'1iHHBMYDu2FF3HjNTzas8VoyzUQz7_3L__ZS48EDXMdY');
 assert.equal(result.sheets.Players.values[1][0],'12345');
 assert.equal(requests.length,2);
 assert.equal(requests[1].options.headers.Authorization,'Bearer fake-token');
 assert.match(requests[1].url,/values:batchGet/);
 assert.ok(!JSON.stringify(result).includes('fake-token'));
 assert.ok(!JSON.stringify(result).includes('PRIVATE KEY'));
});
test('incorrect sheet headers cannot be imported as live data',async()=>{
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const credential={client_email:'other@example.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'}),token_uri:'https://oauth2.googleapis.com/token'};
 const fake=async(url)=>String(url).includes('/token')
   ? {ok:true,json:async()=>({access_token:'another-token',expires_in:300})}
   : {ok:true,json:async()=>({valueRanges:[{values:[['Username','No Player ID']]}]})};
 await assert.rejects(()=>readTalSheet({credential,fetcher:fake}),/headers have changed/);
});
