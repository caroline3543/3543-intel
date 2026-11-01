import test from 'node:test';
import assert from 'node:assert/strict';
import { sealGoogleToken, openGoogleToken, refreshGoogleAccessToken } from '../src/services/googleTokenVault.js';
const key=Buffer.alloc(32,7).toString('base64');
test('AES-GCM token vault encrypts and decrypts without plaintext',async()=>{
 const encrypted=await sealGoogleToken('secret-refresh',key);
 assert.equal(encrypted.includes('secret-refresh'),false);
 assert.equal(await openGoogleToken(encrypted,key),'secret-refresh');
 await assert.rejects(()=>openGoogleToken(encrypted,Buffer.alloc(32,8).toString('base64')));
});
test('refresh submits encrypted token only to the token endpoint',async()=>{
 const encrypted=await sealGoogleToken('refresh-secret',key);
 const result=await refreshGoogleAccessToken({encryptedRefreshToken:encrypted,encryptionKey:key,clientId:'id',clientSecret:'secret',fetchImpl:async(url,opts)=>{
  assert.equal(url,'https://oauth2.googleapis.com/token');
  assert.match(opts.body,/refresh_token=refresh-secret/);
  return {ok:true,json:async()=>({access_token:'new-access',expires_in:3600})};
 }});
 assert.equal(result.accessToken,'new-access');
 assert.equal(result.rotatedRefreshToken,null);
});
