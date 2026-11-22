import {availableBudget, MINUTE_LIMIT} from './automaticMembershipPolicy.js';
import {verifiedPlayerLocation} from './verifiedPlayerLocation.js';

const MAX_BATCH = 20;

function retryDelay(attempt, retryAfter, now) {
  const seconds = Number(retryAfter);
  const delay = Number.isFinite(seconds) ? seconds : (Date.parse(retryAfter ?? '') - now) / 1000;
  return Math.min(3600, Math.max(60 * 2 ** Math.min(attempt, 5), Math.ceil(delay) || 0));
}

export function parseManualPlayerBatch(payload, fids, now = Date.now()) {
  const entries = new Map();
  const wanted = new Set(fids);
  const data = payload?.data ?? payload;
  if (data?.ok !== false && Array.isArray(data?.players)) {
    for (const record of data.players) {
      const fid = String(record?.player?.chief_id ?? record?.player?.fid ?? record?.chief_id ?? '');
      if (wanted.has(fid)) entries.set(fid, entries.has(fid) ? null : record);
    }
  }
  const listed = key => new Set(Array.isArray(data?.[key]) ? data[key].map(entry =>
    String(entry?.chief_id ?? entry?.fid ?? entry?.id ?? entry)) : []);
  const pending = listed('pending'), notFound = listed('not_found'), failed = listed('failed');
  return new Map(fids.map(fid => {
    const record = entries.get(fid);
    if (!record) return [fid, {
      outcome: entries.has(fid) ? 'duplicate_provider_record' : pending.has(fid) ? 'provider_pending' :
        notFound.has(fid) ? 'player_not_found' : failed.has(fid) ? 'provider_failed' : 'invalid_response'
    }];
    const base = record.player;
    const ids = [base?.chief_id, base?.fid, record.chief_id].filter(id => id != null);
    if (!base || !ids.length || ids.some(id => String(id) !== fid)) return [fid, {outcome:'invalid_response'}];
    const result = {validPlayer:true, retryAfter:record.retry_after};
    const alliance = base.alliance;
    if (!Object.hasOwn(base, 'alliance') || (alliance !== null && !/^[A-Za-z0-9_]{1,20}$/.test(typeof alliance?.abbr === 'string' ? alliance.abbr.trim() : '')) ||
        !/^[1-9]\d*$/.test(String(base.kid ?? record.kid ?? ''))) {
      return [fid, {...result, outcome:'missing_membership'}];
    }
    try {
      return [fid, {...result, outcome:'verified', observation:verifiedPlayerLocation(record, fid, now)}];
    } catch {
      return [fid, {...result, outcome:'freshness_unverified'}];
    }
  }));
}

/** Shares the scheduled worker's account-wide PostgreSQL credit reservation. */
export async function processManualMembershipBatch({store, api, clock = Date.now}) {
  if (!await store.hasManualWork()) return 'idle';
  let usage;
  try { usage = await api.usage(); }
  catch { return 'usage_unavailable'; }
  if (!Number.isSafeInteger(usage?.used) || usage.used < 0 ||
      !Number.isSafeInteger(usage?.minuteUsed) || usage.minuteUsed < 0 || usage.minuteUsed > MINUTE_LIMIT) return 'usage_unavailable';
  const limit = Math.min(MAX_BATCH, availableBudget({used:usage.used}), MINUTE_LIMIT - usage.minuteUsed);
  if (limit <= 0) return 'budget_exhausted';
  const jobs = await store.leaseManual(limit);
  if (!jobs.length) return 'idle';

  const reserved = await store.reserveCredits({
    credits:jobs.length, providerUsed:usage.used, providerMinuteUsed:usage.minuteUsed, now:new Date(clock()).toISOString()
  });
  if (!reserved) {
    await store.deferManual(jobs);
    return 'budget_exhausted';
  }

  const requestId = await store.beginManualRequest(jobs);
  let response;
  try { response = await api.verifyBatch(jobs.map(job => job.fid)); }
  catch { response = {status:null, transportFailed:true}; }
  await store.recordManualHttp(requestId, response);
  const ok = response.status >= 200 && response.status < 300;
  const results = ok ? parseManualPlayerBatch(response.body, jobs.map(job => job.fid), clock()) : null;
  for (const job of jobs) {
    const result = results?.get(job.fid) ?? {
      outcome:response.status === 429 ? 'rate_limited' : response.transportFailed ? 'transport_failed' : 'provider_http_failed',
      retryAfter:response.retryAfter
    };
    const retry = result.outcome === 'verified' || result.outcome === 'player_not_found'
      ? null : retryDelay(job.attempts, result.retryAfter ?? response.retryAfter, clock());
    try {
      await store.endManualItem(job, result, retry);
    } catch {
      // The membership and its success receipt are one transaction. A failed
      // write gets its own outcome and can never increase the persisted count.
      await store.endManualItem(job, {...result, outcome:'persistence_failed'}, retryDelay(job.attempts, null, clock()));
    }
  }
  return 'processed';
}

export function createManualMembershipStore(query, queue) {
  return {
    reserveCredits:params => queue.reserveCredits(params),
    async hasManualWork() {
      const [row] = await query(`update membership_3573.manual_refresh_runs set last_worker_at=clock_timestamp()
        where completed_at is null returning id`);
      return Boolean(row?.id);
    },
    leaseManual:limit => query('select * from membership_3573.lease_manual_refresh($1)', [limit]),
    deferManual:jobs => query(`update membership_3573.refresh_jobs
      set status='pending',due_at=now()+interval '1 minute',lease_token=null,lease_until=null
      where status='leased' and lease_token=any(($1::text)::uuid[])`, [leaseTokens(jobs)]),
    async beginManualRequest(jobs) {
      const [row] = await query('select membership_3573.begin_manual_request($1,($2::text)::uuid[]) as id',
        [jobs[0].manual_run_id, leaseTokens(jobs)]);
      if (!row?.id) throw Error('Manual request could not be recorded');
      return row.id;
    },
    recordManualHttp:(id, {status, transportFailed = false}) => query(`update membership_3573.manual_refresh_requests
      set http_status=$2,transport_failed=$3 where id=$1`, [id, status, transportFailed]),
    async endManualItem(job, result, retry) {
      const {observation} = result;
      const [row] = await query('select membership_3573.end_manual_item($1,$2,$3,$4,$5,$6,$7,$8,$9) as outcome',
        [job.id, job.lease_token, result.outcome, result.validPlayer === true, Boolean(observation), retry,
          observation?.state ?? null, observation?.tag ?? null, observation?.at ?? null]);
      return row?.outcome;
    }
  };
}

function leaseTokens(jobs) {
  // postgres.js serializes typed array parameters differently from JSON.
  return '{' + jobs.map(job => job.lease_token).join(',') + '}';
}
