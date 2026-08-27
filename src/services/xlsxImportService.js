/**
 * xlsxImportService.js
 *
 * Reads the plain "…Data" sheets written by exportWorkbook() (see
 * exportXlsx.js) — one row per record, raw fields, nested
 * arrays/objects JSON-encoded per cell. Kept separate from
 * exportImportService.js (which owns localStorage + JSON import/export
 * + the merge logic shared by both formats) to stay under the
 * 200-line service limit.
 */

export function importFromXlsxFile(file) {
  return new Promise(async (resolve, reject) => {
    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'binary' });
          const sheet = (name) => {
            const ws = wb.Sheets[name];
            if (!ws) return [];
            return XLSX.utils.sheet_to_json(ws, { defval: null });
          };
          const parseJsonCell = (v, fallback) => {
            if (v == null || v === '') return fallback;
            try { return JSON.parse(v); } catch { return fallback; }
          };

          const players = sheet('Roster Data').map(row => ({
            id: row.id, fid: row.fid || '', username: row.username || '', alias: row.alias || '',
            allianceTag: row.allianceTag || '', country: row.country || '', timezone: row.timezone || '',
            languages: parseJsonCell(row.languages, []),
            furnaceLevel: row.furnaceLevel || null,
            infantryCampLevel: row.infantryCampLevel || null,
            lancerCampLevel: row.lancerCampLevel || null,
            marksmanCampLevel: row.marksmanCampLevel || null,
            troops: parseJsonCell(row.troops, { infantry:null, lancer:null, marksman:null }),
            joinerHeroes: parseJsonCell(row.joinerHeroes, []),
            roles: parseJsonCell(row.roles, []),
            availability: parseJsonCell(row.availability, { present:'available', timing:'unknown', lateBy:null, earlyBy:null, discord:'unknown' }),
            teamAssignment: row.teamAssignment || null,
            notes: row.notes || '',
            eventAvailability: parseJsonCell(row.eventAvailability, {}),
            profileLastUpdated: row.profileLastUpdated || null,
            createdAt: row.createdAt || Date.now(),
            eventHistory: parseJsonCell(row.eventHistory, []),
          })).filter(p => p.id);

          const events = sheet('Events Data').map(row => ({
            id: row.id, type: row.type || 'SvS', name: row.name || '', allianceTag: row.allianceTag || '',
            date: row.date || '', time: row.time || '12:00', status: row.status || 'upcoming',
            participantIds: parseJsonCell(row.participantIds, []),
            notes: row.notes || '',
            createdAt: row.createdAt || new Date().toISOString(),
            updatedAt: row.updatedAt || new Date().toISOString(),
            snapshots: parseJsonCell(row.snapshots, []),
          })).filter(e => e.id);

          const svsPlans = sheet('Plans Data').map(row => ({
            id: row.id, name: row.name || '', allianceTag: row.allianceTag || '',
            date: row.date || '', status: row.status || 'draft', notes: row.notes || '',
            postBattleNotes: row.postBattleNotes || '',
            rallySlots: parseJsonCell(row.rallySlots, []),
            createdAt: row.createdAt || new Date().toISOString(),
            updatedAt: row.updatedAt || new Date().toISOString(),
          })).filter(p => p.id);

          const customRoles = sheet('Roles Data').map(row => ({
            id: row.id, name: row.name || '', color: row.color || '', icon: row.icon || '🏷️',
            builtin: !!row.builtin,
            updatedAt: row.updatedAt || new Date().toISOString(),
          })).filter(r => r.id && !r.builtin); // never import the built-in Rally Lead row as a custom role

          resolve({ players, events, svsPlans, customRoles });
        } catch (err) {
          reject(new Error('Could not read this spreadsheet — make sure it was exported from this app.'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    } catch (err) {
      reject(new Error('Spreadsheet import is unavailable right now.'));
    }
  });
}
