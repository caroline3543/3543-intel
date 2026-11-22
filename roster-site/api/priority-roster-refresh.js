import {accessContext, respond, sameOrigin} from '../server/access.js';
import {gameApiConfig} from '../server/gameApi.js';
import {preparePriorityRefresh} from '../server/priorityRosterRefresh.js';
import {WORKSPACE_ID} from '../shared/workspace.js';
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
  async function call(name, body, timeout = 9000) {
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
  try {
    const [current, rosters] = await Promise.all([
      workspaceCall('read'),
      Promise.allSettled(PRIORITY_ALLIANCES.map(tag => call('caroline3573',{action:'alliance',state:3573,tag})))
    ]);
    const snapshots = new Map(PRIORITY_ALLIANCES.flatMap((tag, i) => {
      const result = rosters[i];
      return result.status === 'fulfilled' && result.value.status === 200 ? [[tag,result.value.data]] : [];
    }));
    let baseWorkspace = current;
    for (let attempt=0; attempt<2; attempt++) {
      if (baseWorkspace.status !== 200 || !Array.isArray(baseWorkspace.data?.data?.players)) break;
      const result = preparePriorityRefresh(baseWorkspace.data.data, snapshots);
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
