// Read-only, authenticated Google Sheets transport for State 3573 TAL.
// Configure GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON in the Vercel server environment.
// Grant that service account Viewer access to the spreadsheet.
// The connected Google Drive account in ChatGPT is NOT reused by the deployed app.
import {createSign} from 'node:crypto';
import {accessContext,respond} from '../server/access.js';

const SPREADSHEET_ID='1iHHBMYDu2FF3HjNTzas8VoyzUQz7_3L__ZS48EDXMdY';
const SOURCE_URL='https://docs.google.com/spreadsheets/d/'+SPREADSHEET_ID+'/edit';
const RANGES=[
  "'Players'!A1:AN250",
  "'Availability'!A1:L250",
  "'State Roster'!A1:V500",
  "'HOT - Legion 1'!A1:X100",
  "'ARC - Legion 2'!A1:I100",
  "'RKG - Legion 3'!A1:I100",
  "'Language Sources'!A1:E500",
];
let cachedToken=null;
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');

export async function serviceAccountToken(raw,fetcher=fetch,now=Date.now()) {
  if(!raw)throw Object.assign(new Error('Google Sheets access is not configured. Add service-account credentials on Vercel.'),{status:503});
  let account;
  try{account=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw Object.assign(new Error('Invalid Google Sheets credential format.'),{status:503});}
  if(!account.client_email||!account.private_key||!account.token_uri||!/^https:\/\/oauth2\.googleapis\.com\/token$/.test(account.token_uri))throw Object.assign(new Error('Google Sheets credentials are incomplete.'),{status:503});
  if(cachedToken?.account===account.client_email&&cachedToken.expires>now+60000)return cachedToken.value;
  const seconds=Math.floor(now/1000);
  const header=b64({alg:'RS256',typ:'JWT'});
  const payload=b64({iss:account.client_email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:account.token_uri,iat:seconds,exp:seconds+3600});
  const unsigned=header+'.'+payload;
  const sign=createSign('RSA-SHA256');sign.update(unsigned);sign.end();
  const assertion=unsigned+'.'+sign.sign(account.private_key,'base64url');
  const response=await fetcher(account.token_uri,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Object.assign(new Error('Google service-account authentication failed.'),{status:502});
  const result=await response.json();
  if(!result.access_token)throw Object.assign(new Error('Google did not return an access token.'),{status:502});
  cachedToken={account:account.client_email,value:result.access_token,expires:now+Math.min(3500000,(Number(result.expires_in)||3600)*1000)};
  return result.access_token;
}

export async function readTalSheet({credential=process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON,fetcher=fetch}={}) {
  const token=await serviceAccountToken(credential,fetcher);
  const url=new URL('https://sheets.googleapis.com/v4/spreadsheets/'+SPREADSHEET_ID+'/values:batchGet');
  for(const range of RANGES)url.searchParams.append('ranges',range);
  url.searchParams.set('valueRenderOption','UNFORMATTED_VALUE');
  const response=await fetcher(url.toString(),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
  if(!response.ok){
    if(response.status===403||response.status===404)throw Object.assign(new Error('The spreadsheet is not shared with the configured Google service account.'),{status:403});
    throw Object.assign(new Error('Google Sheets refresh failed ('+response.status+').'),{status:502});
  }
  const data=await response.json(),sheets={};
  for(let i=0;i<RANGES.length;i++){
    const title=RANGES[i].slice(1,RANGES[i].indexOf("'!"));
    sheets[title]={values:data.valueRanges?.[i]?.values||[]};
  }
  const headers=sheets.Players.values[0]||[];
  if(!headers.includes('Player ID')||!headers.includes('Selection')||!headers.includes('Registration'))
    throw Object.assign(new Error('The Players worksheet headers have changed. No data was imported.'),{status:409});
  return {spreadsheetId:SPREADSHEET_ID,url:SOURCE_URL,readAt:new Date().toISOString(),sheets};
}

export default async function handler(req,res) {
  const access=accessContext(req);
  if(!access)return respond(res,401,{error:'Sign in to the leader workspace.'});
  if(access.role!=='leader'||access.workspaceId!=='3573-leaders')return respond(res,403,{error:'Leader access is required.'});
  if(req.method!=='GET')return respond(res,405,{error:'Method not allowed.'});
  try{return respond(res,200,await readTalSheet());}
  catch(error){return respond(res,error.status||502,{error:error.message||'Unable to read TAL spreadsheet.'});}
}
