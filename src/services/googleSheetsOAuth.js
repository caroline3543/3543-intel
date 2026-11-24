/**
 * Google OAuth URL composition for a trusted server.
 * Call only after authenticating a user and persisting a one-time,
 * short-lived CSRF state tied to that user.
 */
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export function buildSheetsAuthorizationUrl({ clientId, redirectUri, state }) {
  if (typeof clientId !== 'string' || !/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId))
    throw new Error('Invalid Google OAuth client ID');
  let url;
  try { url = new URL(redirectUri); } catch { throw new Error('Invalid OAuth redirect URI'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search)
    throw new Error('Redirect URI must be an HTTPS callback URL without query or fragment');
  if (typeof state !== 'string' || !/^[a-zA-Z0-9_-]{32,256}$/.test(state))
    throw new Error('OAuth state must be an opaque, high-entropy nonce');
  const auth = new URL(AUTH_URL);
  const params = auth.searchParams;
  params.set('client_id', clientId);
  params.set('redirect_uri', url.toString());
  params.set('response_type', 'code');
  params.set('scope', SHEETS_SCOPE);
  params.set('access_type', 'offline');
  params.set('state', state);
  params.set('include_granted_scopes', 'true');
  return auth.toString();
}

export async function redeemGoogleCode({ code, clientId, clientSecret, redirectUri, fetchImpl = fetch }) {
  if (typeof code !== 'string' || !code.trim()) throw new Error('Missing authorization code');
  if (!clientSecret || !clientId) throw new Error('Missing server-side OAuth configuration');
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString(),
  });
  if (!response.ok) throw new Error(`Google code exchange failed (${response.status})`);
  const tokens = await response.json();
  if (!tokens || typeof tokens.access_token !== 'string') throw new Error('Invalid token response');
  return tokens; // Caller MUST encrypt refresh_token and never expose return value to browser.
}
