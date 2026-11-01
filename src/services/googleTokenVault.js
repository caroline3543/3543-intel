// Server-only token handling. Browser code must never import this module.
function decode64url(text) {
  const normalized = text.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
function encode64url(bytes) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function keyFromBase64(secret) {
  const material = decode64url(secret);
  if (material.length !== 32) throw new Error('Invalid 256-bit token encryption key');
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt','decrypt']);
}
export async function sealGoogleToken(token, keyBase64) {
  if (typeof token !== 'string' || !token) throw new Error('Empty refresh token');
  const key = await keyFromBase64(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(token));
  return JSON.stringify({v:1,iv:encode64url(iv),ciphertext:encode64url(new Uint8Array(cipher))});
}
export async function openGoogleToken(sealed, keyBase64) {
  const data = JSON.parse(sealed);
  if (data?.v !== 1) throw new Error('Unsupported encrypted credential version');
  const iv = decode64url(data.iv);
  if (iv.length !== 12) throw new Error('Invalid credential IV');
  const key = await keyFromBase64(keyBase64);
  const bytes = await crypto.subtle.decrypt({name:'AES-GCM',iv},key,decode64url(data.ciphertext));
  return new TextDecoder().decode(bytes);
}
export async function refreshGoogleAccessToken({encryptedRefreshToken,encryptionKey,clientId,clientSecret,fetchImpl=fetch}) {
  const refreshToken = await openGoogleToken(encryptedRefreshToken,encryptionKey);
  const response = await fetchImpl('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'}).toString(),
  });
  if (!response.ok) {
    const error = new Error('Google token refresh failed');
    error.status = response.status;
    throw error;
  }
  const result = await response.json();
  if (typeof result.access_token !== 'string' || !result.access_token) throw new Error('Invalid token response');
  return {accessToken:result.access_token,expiresIn:Number(result.expires_in)||3600,
    rotatedRefreshToken:result.refresh_token ? await sealGoogleToken(result.refresh_token,encryptionKey) : null};
}
