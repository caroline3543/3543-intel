import {accessContext, respond, sameOrigin} from '../server/access.js';
import {gameApiConfig} from '../server/gameApi.js';
import {preparePriorityRefresh} from '../server/priorityRosterRefresh.js';
import {WORKSPACE_ID} from '../shared/workspace.js';
import {setTimeout as delay} from 'node:timers/promises';
import {PRIORITY_ALLIANCES} from '../../src/services/state3573Alliances.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return respond(res,405,{error:'Method not allowed'});
  const access = accessContext(req);
  if (!access || access.role !== 'leader' || access.workspaceId !== WORKSPACE_ID) {
    return respond(res,401,{error:'Leader access is required.'});
  }
  if (!sameOrigin(req)) return respond(res,403,{error:'Open this website directly to refresh.'});
  const config = gameApiConfig();
  if (!config) return respond(res,503,{error:'Alliance refresh is unavailable in this environment.'});
  const {base, key, token} = config;
  async function call(name, body, timeout) {
    const response = await fetch(base + '/functions/v1/' + name, {
      method:'POST', signal:AbortSignal.timeout(timeout),
      headers:{'Content-Type':'application/json', apikey:key, Authorization:'Bearer '+key, 'x-caroline-site-key':token},
      body:JSON.stringify(body)
    });
    return {status:response.status, data:await response.json()};
  }
  const workspaceCall = (action, fields = {}) => call('caroline3573-workspace', {
    action, workspaceId:WORKSPACE_ID, role:access.role, actor:access.actor, ...fields
  },12000);
  async function fetchRoster(tag) {
    const lookup = wait => call('caroline3573', {action:'alliance', state:3573, tag, wait}, (wait + 15) * 1000);
    const initial = await lookup(25);
    const payload = initial.data?.data;
    const retryAfter = Number(payload?.retry_after);
    if (initial.status === 200 && payload?.fresh === false &&
        ['queued', 'running'].includes(payload.refresh) &&
        Number.isFinite(retryAfter) && retryAfter >= 0 && retryAfter <= 5) {
      await delay(retryAfter * 1000);
      return lookup(10);
    }
    return initial;
  }
  try {
    const [current, rosters] = await Promise.all([
      workspaceCall('read'),
      Promise.allSettled(PRIORITY_ALLIANCES.map(fetchRoster))
    ]);
    const snapshots = new Map(PRIORITY_ALLIANCES.flatMap((tag, i) => {
      const result = rosters[i];
      return result.status === 'fulfilled' && result.value.status === 200 ? [[tag,result.value.data]] : [];
    }));
    let baseWorkspace = current;
    for (let attempt=0; attempt<2; attempt++) {
      if (baseWorkspace.status !== 200 || !Array.isArray(baseWorkspace.data?.data?.players)) break;
      const result = preparePriorityRefresh(baseWorkspace.data.data, snapshots);
      if (attempt === 0 && result.unavailable.length) {
        const unavailable = Object.fromEntries(result.unavailable.map(tag => {
          const outcome = rosters[PRIORITY_ALLIANCES.indexOf(tag)];
          if (outcome.status === 'rejected') return [tag, 'request_failed'];
          const {status, data} = outcome.value;
          if (status !== 200) return [tag, `http_${status}`];
          return [tag, data?.data?.fresh === false ? 'stale' : 'unverified_roster'];
        }));
        console.warn(JSON.stringify({event:'priority_roster_refresh_incomplete', unavailable}));
      }
      if (!result.succeeded.length) {
        return respond(res,502,{error:'No fresh, complete alliance lists came back. Please try again.'});
      }
      const saved = await workspaceCall('priority-roster-refresh',{
        revision:baseWorkspace.data.revision, data:result.workspace, missing:result.missing
      });
      if (saved.status === 200 && Number.isInteger(saved.data?.queued)) {
        return respond(res,200,{succeeded:result.succeeded,unavailable:result.unavailable,found:result.found,missing:result.missing.length,queued:saved.data.queued});
      }
      if (saved.status !== 409 || attempt === 1) break;
      baseWorkspace = await workspaceCall('read');
    }
  } catch { /* Report a safe error without provider or workspace data. */ }
  return respond(res,502,{error:'The alliance lists could not be saved. Please try again.'});
}
