export const STATUSES = ['Planned', 'Ready', 'Launched', 'Confirmed', 'Completed', 'Failed', 'Cancelled'];
export const TERMINAL = ['Completed', 'Failed', 'Cancelled'];
export const uid = () => crypto.randomUUID();
export function utcTime(date, value) {
  const digits = value.replaceAll(':', '');
  if (!/^\d{4}(\d{2})?$/.test(digits)) throw Error('Use HHMM or HHMMSS');
  const h = +digits.slice(0, 2), m = +digits.slice(2, 4), s = +(digits.slice(4) || 0);
  if (h > 23 || m > 59 || s > 59) throw Error('Invalid UTC time');
  const stamp = Date.parse(`${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}Z`);
  if (!Number.isFinite(stamp)) throw Error('Select a UTC date');
  return stamp;
}
export function duration(value) {
  if (!/^\d+(:\d{1,2})?$/.test(String(value))) throw Error('Duration: use seconds or minutes:seconds');
  const parts = String(value).split(':');
  if (parts.length === 2 && +parts[1] > 59) throw Error('Seconds must be below 60');
  return parts.length === 1 ? +parts[0] : +parts[0] * 60 + +parts[1];
}
export const rallyStart = (impact, prep, travel) => impact - (prep + travel) * 1000;
export const rallyImpact = (start, prep, travel) => start + (prep + travel) * 1000;
export const clock = stamp => Number.isFinite(stamp) ? new Date(stamp).toISOString().slice(11,19) : 'Missing time';
export const countdown = (stamp, now) => {
  const seconds = Math.ceil((stamp - now) / 1000), n = Math.abs(seconds);
  return `${seconds < 0 ? 'Overdue ' : ''}${Math.floor(n/3600).toString().padStart(2,'0')}:${Math.floor(n%3600/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;
};
export function resolveEvents(events) {
  const map = new Map(events.map(e => [e.id,e])), visiting = new Set(), done = new Map();
  function resolve(id) {
    if (done.has(id)) return done.get(id);
    const e = map.get(id);
    if (!e || visiting.has(id)) throw Error('Missing or circular dependency');
    visiting.add(id);
    const parent = e.dependency?.mode === 'relative' ? resolve(e.dependency.parentId) : null;
    const plannedAt = parent ? (parent.actualAt ?? parent.plannedAt) + e.dependency.offsetSeconds * 1000 : e.plannedAt;
    const review = !!e.review || !!parent?.review || !!(e.captureDependent && parent && ['Failed','Cancelled'].includes(parent.status));
    const startAt = e.prep != null ? rallyStart(plannedAt,e.prep,e.travel) : parent && e.startAt != null ? e.startAt + plannedAt - e.plannedAt : e.startAt;
    const result = {...e, plannedAt, startAt, review};
    visiting.delete(id); done.set(id,result); return result;
  }
  return events.map(e=>resolve(e.id));
}
export function switching(counter, entry, enemy, buffer = 0, now = Date.now(), launch = null) {
  const missing = ![counter,entry,enemy].every(Number.isFinite);
  if (missing) return {warnings:['Critical timing input missing']};
  const window = (enemy-counter)/1000, margin = (enemy-entry)/1000, effective = margin-buffer;
  const warnings = [];
  if (entry < counter) warnings.push('Garrison arrives before projected capture');
  if (entry >= enemy) warnings.push('Garrison arrives at or after enemy follow-up');
  if (effective <= 1) warnings.push('Entry too close to next attack; safety is not established');
  if (Number.isFinite(launch) && launch < now) warnings.push('Required departure is overdue');
  return {window,margin,effective,warnings};
}
export function conflicts(events) {
  const active = events.filter(e => e.playerId && !TERMINAL.includes(e.status));
  return active.flatMap((a,i)=>active.slice(i+1).filter(b=>a.playerId===b.playerId && Math.max(a.startAt ?? a.plannedAt,b.startAt ?? b.plannedAt) <= Math.min(a.plannedAt,b.plannedAt)).map(b=>`${a.name} conflicts with ${b.name}`));
}
export function callout(e, players, templates = {}) {
  const player = players.find(p=>p.id===e.playerId)?.name || 'Unassigned';
  const evidence = e.actualAt != null ? 'CONFIRMED' : e.reportedAt != null ? 'REPORTED' : 'PLANNED';
  if (e.review || e.status==='Failed') return '❌ Counter failed or changed. Hold switching sequence. Await revised orders.';
  const defaults = {Rally:'⚔️ {player}: open {name}.',Garrison:'🏰 {player}: enter for {name}. Backup standby.',Enemy:'🚨 {name} incoming. Confirm garrison.',Reinforcement:'🏰 {player}: reinforce {name}.'};
  return `${evidence} · ${(templates[e.type] || defaults[e.type] || '{player}: {name}.').replaceAll('{player}',player).replaceAll('{name}',e.name)} ${clock(e.startAt ?? e.plannedAt)} UTC`;
}

export const actionTime = e => ['Launched','Confirmed'].includes(e.status) ? e.plannedAt : (e.startAt ?? e.plannedAt);
