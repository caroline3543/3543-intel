import { bulkCandidates, normaliseBulkName } from '../components/bulkImportModel.js';
import { eventAssignments, isParticipant, plannerSlot, prepareEventRoles, suspiciousPowerChange } from '../../../src/services/eventPlanner.js';

export const roleName = role => ({ join: 'Combatant', sub: 'Substitute', out: 'Not participating', '': 'Unassigned' })[role] ?? 'Unassigned';
export const assignmentLabel = assignment => assignment
  ? [assignment.alliance, 'Legion ' + assignment.legion, roleName(assignment.role)].join(' · ')
  : 'Unassigned';

const exactName = value => String(value ?? '').trim().normalize('NFC');
const playerFields = player => [player.name, player.playerId, player.fid, player.id, ...(player.searchFields ?? [])];

export function screenshotMatches(name, players, alliance) {
  if (!name) return { candidates: [], player: null };
  const exact = players.filter(player => playerFields(player).some(field => exactName(field) === exactName(name)));
  const suggestions = bulkCandidates(name, players, alliance);
  const candidates = [...new Map([...exact, ...suggestions].map(player => [player.id, player])).values()].slice(0, 8);
  const key=normaliseBulkName(name);
  const equivalent=key ? players.filter(player=>playerFields(player).some(field=>normaliseBulkName(field)===key)) : [];
  const visualKey=value=>normaliseBulkName(value).replace(/0/g,'o').replace(/[1l]/g,'i');
  const visual=visualKey(name);
  const lookalikes=visual ? players.filter(player=>playerFields(player).some(field=>visualKey(field)===visual)) : [];
  const safe=exact.length===1 && equivalent.length===1 && equivalent[0].id===exact[0].id && lookalikes.length===1;
  return { candidates, player: safe ? exact[0] : null };
}

export { suspiciousPowerChange };

export function prepareScreenshotImport(storage, context, rows, mode) {
  const { kind, alliance, legion, expectedOccurrenceId } = context;
  const target = plannerSlot(storage, kind, alliance, legion);
  if (target.occurrenceId !== expectedOccurrenceId) return { error: 'The selected event changed. Scan again for the current event.' };
  if (!['powers', 'roles', 'both'].includes(mode)) return { error: 'Choose an import mode.' };
  if (new Set(rows.map(row => row.id)).size !== rows.length) return { error: 'Each player can be confirmed once per legion.' };
  const assignments = eventAssignments(storage, kind);
  const powers = [], roleChanges = [], changes = [];
  for (const row of rows) {
    if (mode !== 'roles' && row.power !== null) {
      if (!Number.isSafeInteger(row.power) || row.power < 0) return { error: 'Enter a valid troop power.' };
      const previousPower = target.powerByPlayer?.[row.id] ?? row.previousPower;
      if (suspiciousPowerChange(previousPower, row.power) && (row.powerApproval?.previous !== previousPower || row.powerApproval?.next !== row.power)) return { error: 'Confirm the unusually large troop power change before importing.' };
      if (previousPower !== row.power) {
        powers.push({ id: row.id, value: row.power, ...(row.powerApproval ? {powerApproval:row.powerApproval} : {}) });
        changes.push({ id: row.id, name: row.name, power: row.power, previousPower });
      }
    }
    const expectedRole = target.registrations[row.id] || '';
    if (mode === 'powers' || row.role == null || row.role === expectedRole) continue;
    const elsewhere = (assignments.get(row.id) ?? []).filter(item => item.alliance !== alliance || item.legion !== legion);
    const moveFrom = isParticipant(row.role) ? elsewhere[0] : undefined;
    const before = moveFrom ?? (expectedRole ? { alliance, legion, role: expectedRole } : null);
    const after = { alliance, legion, role: row.role };
    roleChanges.push({ id: row.id, role: row.role, expectedRole, ...(moveFrom ? { moveFrom } : {}) });
    changes.push({ id: row.id, name: row.name, before, after, destructive: Boolean(moveFrom || !row.role || (row.alliance && row.alliance !== alliance)) });
  }
  if (roleChanges.length) {
    const { error } = prepareEventRoles(storage, context, roleChanges);
    if (error) return { error };
  }
  if (!powers.length && !roleChanges.length) return { error: 'Choose at least one change to import.' };
  return { changes, action: { ...context, powers, ...(roleChanges.length ? { roleChanges } : {}), screenshotImport: true } };
}
