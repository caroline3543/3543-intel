import {accessContext, respond, sameOrigin} from '../server/access.js';
import {gameApiConfig} from '../server/gameApi.js';
import {WORKSPACE_ID} from '../shared/workspace.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return respond(res, 405, {error:'Method not allowed'});
  const access = accessContext(req);
  if (!access) return respond(res, 401, {error:'Sign in to refresh memberships.'});
  if (access.role !== 'leader' || access.workspaceId !== WORKSPACE_ID) {
    return respond(res, 403, {error:'Leader access is required.'});
  }
  if (req.method === 'POST' && !sameOrigin(req)) {
    return respond(res, 403, {error:'Open this website directly to refresh memberships.'});
  }
  const config = gameApiConfig();
  if (!config) return respond(res, 503, {error:'Membership refresh is unavailable in this environment.'});
  const {base, key, token} = config;
  try {
    const response = await fetch(base + '/functions/v1/caroline3573-workspace', {
      method:'POST',
      headers:{'Content-Type':'application/json', apikey:key, Authorization:'Bearer ' + key, 'x-caroline-site-key':token},
      body:JSON.stringify({
        workspaceId:WORKSPACE_ID, role:access.role, action:'membership-refresh', start:req.method === 'POST'
      }),
      signal:AbortSignal.timeout(10000)
    });
    if (!response.ok) throw Error('Refresh backend unavailable');
    const {refresh} = await response.json();
    if (refresh !== null && (typeof refresh?.id !== 'string' || !Number.isInteger(refresh.queued))) {
      throw Error('Invalid refresh status');
    }
    return respond(res, 200, {refresh});
  } catch {
    return respond(res, 502, {error:'Could not reach membership refresh. Check again before retrying.'});
  }
}
