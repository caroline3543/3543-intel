import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSheetsAuthorizationUrl, redeemGoogleCode, SHEETS_SCOPE } from '../src/services/googleSheetsOAuth.js';

const args={clientId:'123.apps.googleusercontent.com',redirectUri:'https://example.com/auth/callback',state:'A'.repeat(48)};
test('builds OAuth consent URL with secure server-side callback',()=>{
  const url=new URL(buildSheetsAuthorizationUrl(args));
  assert.equal(url.origin,'https://accounts.google.com');
  assert.equal(url.searchParams.get('scope'),SHEETS_SCOPE);
  assert.equal(url.searchParams.get('response_type'),'code');
  assert.equal(url.searchParams.get('access_type'),'offline');
  assert.equal(url.searchParams.get('state'),args.state);
});
test('rejects unsafe redirects or weak CSRF state',()=>{
  assert.throws(()=>buildSheetsAuthorizationUrl({...args,redirectUri:'http://example.com/callback'}));
  assert.throws(()=>buildSheetsAuthorizationUrl({...args,state:'weak'}));
});
test('exchanges code on backend without leaking client secret into URL',async()=>{
  const tokens=await redeemGoogleCode({code:'one-time-code',clientId:args.clientId,clientSecret:'server-secret',redirectUri:args.redirectUri,
    fetchImpl:async(url,opts)=>{
      assert.equal(url,'https://oauth2.googleapis.com/token');
      assert.equal(opts.method,'POST');
      assert.match(opts.body,/grant_type=authorization_code/);
      assert.match(opts.body,/client_secret=server-secret/);
      return {ok:true,json:async()=>({access_token:'temporary',refresh_token:'private'})};
    }});
  assert.equal(tokens.access_token,'temporary');
});
