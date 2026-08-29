/**
 * xlsxDataSheets.js
 *
 * The plain, round-trip-safe sheets appended to the export workbook —
 * one row per record, one column per raw field, nested arrays/objects
 * JSON-encoded per cell. These exist purely so importFromXlsxFile()
 * (xlsxImportService.js) can read a spreadsheet back into real records.
 *
 * Deliberately separate from the polished report sheets in
 * exportXlsx.js (Roster, Event, Joiner Coverage, Prep Scores) — those
 * are for reading, not re-importing, and already lose information on
 * the way out (no id column, joiner heroes collapsed to a display
 * string, etc). Kept in its own file to stay under the 200-line
 * service limit given how much exportXlsx.js already holds.
 */

import * as XLSX from 'xlsx';

function cell(value) {
  const v = value ?? '';
  return { v, t: typeof v === 'number' ? 'n' : 's' };
}

function jsonCell(value) {
  return cell(value == null ? '' : JSON.stringify(value));
}

export function buildRosterDataSheet(players) {
  const headers = [
    'id','fid','username','alias','allianceTag','country','timezone','languages',
    'furnaceLevel','infantryCampLevel','lancerCampLevel','marksmanCampLevel','troops',
    'joinerHeroes','roles','teamAssignment','notes',
    'profileLastUpdated','createdAt','eventHistory',
  ];
  const rows = [headers.map(cell)];
  (players || []).forEach(p => {
    rows.push([
      cell(p.id), cell(p.fid), cell(p.username), cell(p.alias), cell(p.allianceTag),
      cell(p.country), cell(p.timezone), jsonCell(p.languages),
      cell(p.furnaceLevel), cell(p.infantryCampLevel), cell(p.lancerCampLevel), cell(p.marksmanCampLevel),
      jsonCell(p.troops), jsonCell(p.joinerHeroes), jsonCell(p.roles),
      cell(p.teamAssignment), cell(p.notes),
      cell(p.profileLastUpdated), cell(p.createdAt), jsonCell(p.eventHistory),
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = headers.map(() => ({ wch: 16 }));
  return ws;
}

export function buildEventsDataSheet(events) {
  const headers = [
    'id','type','name','allianceTag','date','time','status',
    'participantIds','notes','createdAt','updatedAt','snapshots',
  ];
  const rows = [headers.map(cell)];
  (events || []).forEach(e => {
    rows.push([
      cell(e.id), cell(e.type), cell(e.name), cell(e.allianceTag), cell(e.date), cell(e.time), cell(e.status),
      jsonCell(e.participantIds), cell(e.notes), cell(e.createdAt), cell(e.updatedAt), jsonCell(e.snapshots),
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = headers.map(() => ({ wch: 16 }));
  return ws;
}

export function buildPlansDataSheet(svsPlans) {
  const headers = [
    'id','name','allianceTag','date','status','notes','postBattleNotes',
    'rallySlots','createdAt','updatedAt',
  ];
  const rows = [headers.map(cell)];
  (svsPlans || []).forEach(p => {
    rows.push([
      cell(p.id), cell(p.name), cell(p.allianceTag), cell(p.date), cell(p.status),
      cell(p.notes), cell(p.postBattleNotes), jsonCell(p.rallySlots), cell(p.createdAt), cell(p.updatedAt),
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = headers.map(() => ({ wch: 16 }));
  return ws;
}

export function buildRolesDataSheet(customRoles) {
  const headers = ['id','name','color','icon','builtin','updatedAt'];
  const rows = [headers.map(cell)];
  // Only custom roles are ever exported/imported — the built-in Rally
  // Lead role is hardcoded (see utils/roles.js), never round-tripped.
  (customRoles || []).filter(r => !r.builtin).forEach(r => {
    rows.push([cell(r.id), cell(r.name), cell(r.color), cell(r.icon), cell(false), cell(r.updatedAt)]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = headers.map(() => ({ wch: 16 }));
  return ws;
}
