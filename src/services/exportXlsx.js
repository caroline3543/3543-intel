/**
 * exportXlsx.js
 *
 * Generates .xlsx exports using SheetJS (xlsx library).
 * Runs entirely in the browser — no server required.
 * Compatible with Excel, Google Sheets, and Numbers.
 *
 * Export types:
 *   - Full roster
 *   - Event attendance (+ joiner coverage for SvS/Castle events)
 *   - Battle plan records
 *
 * Called from DataPanel via exportWorkbook(data, options).
 */

import * as XLSX from 'xlsx';
import { JOINER_COVERAGE_EVENTS, SHOWS_RSVP_TYPES } from '../utils/constants.js';
import { buildRosterDataSheet, buildEventsDataSheet, buildPlansDataSheet, buildRolesDataSheet } from './xlsxDataSheets.js';

// ── Styling helpers ────────────────────────────────────────────
const HEADER_STYLE = {
  font:      { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 11 },
  fill:      { patternType: 'solid', fgColor: { rgb: '0A2744' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    bottom: { style: 'thin', color: { rgb: '2A4A64' } },
    right:  { style: 'thin', color: { rgb: '2A4A64' } },
  },
};

const SUBHEADER_STYLE = {
  font:      { bold: true, name: 'Arial', sz: 10, color: { rgb: 'F5A623' } },
  fill:      { patternType: 'solid', fgColor: { rgb: '1E3A52' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

const ALT_ROW_STYLE = {
  fill: { patternType: 'solid', fgColor: { rgb: 'F0F4F8' } },
  font: { name: 'Arial', sz: 10 },
};

const ROW_STYLE = {
  font: { name: 'Arial', sz: 10 },
};

const YES_STYLE = {
  font: { bold: true, color: { rgb: '1A7A3A' }, name: 'Arial', sz: 10 },
};

const NO_STYLE = {
  font: { bold: true, color: { rgb: 'CC2200' }, name: 'Arial', sz: 10 },
};

const GOLD_STYLE = {
  font: { bold: true, color: { rgb: 'B87A00' }, name: 'Arial', sz: 10 },
};

function cell(value, style = ROW_STYLE) {
  return { v: value ?? '', t: typeof value === 'number' ? 'n' : 's', s: style };
}

function hdr(value) { return cell(value, HEADER_STYLE); }
function sub(value) { return cell(value, SUBHEADER_STYLE); }

function yesNo(value) {
  if (value === true  || value === 'yes'       || value === 'available') return cell('✓', YES_STYLE);
  if (value === false || value === 'no'        || value === 'unavailable') return cell('✗', NO_STYLE);
  if (value === 'late' || value === 'early')    return cell(value === 'late' ? '🕐 Late' : '🚪 Early', GOLD_STYLE);
  return cell('—', { font: { color: { rgb: '999999' }, name: 'Arial', sz: 10 } });
}

function setColWidths(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

function applyStyle(ws, range, style) {
  const { s, e } = XLSX.utils.decode_range(range);
  for (let r = s.r; r <= e.r; r++) {
    for (let c = s.c; c <= e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: '', t: 's' };
      ws[addr].s = style;
    }
  }
}

function autoFilter(ws, range) {
  ws['!autofilter'] = { ref: range };
}

// Excel worksheet names must be unique (and ≤31 chars). Two events
// sharing a name — same-day Legion 1/2 events before the auto-name
// included Legion, or two manually-renamed Custom events — used to
// throw "Worksheet with name X already exists!" and abort the whole
// export. This disambiguates instead of crashing, regardless of why
// the names collided.
function uniqueSheetName(rawName, used) {
  const base = (rawName || 'Event').replace(/[\\/:*?[\]]/g, '').slice(0, 28) || 'Event';
  if (!used.has(base)) return base;
  let n = 2;
  let candidate;
  do {
    const suffix = ` (${n})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    n++;
  } while (used.has(candidate));
  return candidate;
}

// ── Sheet 1: Roster ────────────────────────────────────────────
function buildRosterSheet(players) {
  const headers = [
    'Username', 'Nickname', 'Alliance', 'Furnace',
    'Infantry', 'Lancer', 'Marksman',
    'Role(s)', 'Joiner Heroes',
    'Country', 'Languages',
    'Player ID', 'Reliability', 'Last Updated',
  ];

  const rows = [headers.map(hdr)];

  players.forEach((p, i) => {
    const joiners = (p.joinerHeroes || []).filter(jh => jh.skillLevel >= 5).map(jh => jh.hero).join(', ');
    const style   = i % 2 === 0 ? ROW_STYLE : ALT_ROW_STYLE;

    rows.push([
      cell(p.username || '', style),
      cell(p.alias || '', style),
      cell(p.allianceTag || '', style),
      cell(p.furnaceLevel || '', style),
      cell(p.troops?.infantry || '', style),
      cell(p.troops?.lancer || '', style),
      cell(p.troops?.marksman || '', style),
      cell((p.roles || []).join(', '), style),
      cell(joiners, style),
      cell(p.country || '', style),
      cell((p.languages || []).join(', '), style),
      cell(p.fid || '', style),
      cell('', style),   // reliability — calculated in Intel tab, not stored
      cell(p.profileLastUpdated ? new Date(p.profileLastUpdated).toLocaleDateString() : '', style),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [18, 14, 10, 9, 9, 9, 9, 22, 30, 16, 20, 12, 12, 14]);
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  autoFilter(ws, `A1:N1`);
  return ws;
}

// ── Sheet 2: Event Attendance ──────────────────────────────────
function buildEventSheet(event, players, includeJoiners) {
  const snapMap = Object.fromEntries((event.snapshots || []).map(s => [s.playerId, s]));
  // Explicit roster, no fallback — an event with nobody added yet
  // exports as empty, not the entire player base. See EventsTab.jsx;
  // the old "empty participantIds = show everyone" behavior was
  // retired app-wide and this export had been left out of sync with it.
  const eventPlayers = players.filter(p => (event.participantIds || []).includes(p.id));
  const isUpcoming = event.status === 'upcoming';
  const showsRsvp = SHOWS_RSVP_TYPES.includes(event.type);

  // Base columns differ by phase — RSVP (a prediction) for upcoming
  // events, post-event actuals otherwise. Never both at once. RSVP
  // behavior predictions (on time / late / early / Discord / whole
  // time) only apply to the two SvS/Castle types — every other event
  // type only ever records intention to participate during the
  // registration period, matching SHOWS_RSVP_TYPES everywhere else.
  const baseHeaders = isUpcoming
    ? (showsRsvp
        ? ['Username', 'Alliance', 'Furnace', 'Participating', 'On Time', 'Will Be Late', 'Will Leave Early', 'Will Join Discord', 'Present Whole Time', 'Notes']
        : ['Username', 'Alliance', 'Furnace', 'Participating', 'Notes'])
    : ['Username', 'Alliance', 'Furnace', 'Attended', 'No-show', 'Late (No Notice)', 'Joined Voice', 'Notes'];

  // Joiner columns — added for SvS / Castle events
  const joinerHeroList = includeJoiners
    ? [...new Set(players.flatMap(p => (p.joinerHeroes || []).filter(jh => jh.skillLevel >= 5).map(jh => jh.hero)))]
        .sort()
    : [];

  const allHeaders = includeJoiners ? [...baseHeaders, ...joinerHeroList] : baseHeaders;
  const rows = [allHeaders.map(hdr)];

  // Subheader row for joiner section
  if (includeJoiners && joinerHeroList.length > 0) {
    const subRow = baseHeaders.map(() => cell(''));
    joinerHeroList.forEach(h => subRow.push(sub('Skill 5?')));
    rows.push(subRow);
  }

  eventPlayers.forEach((p, i) => {
    const snap  = snapMap[p.id];
    const style = i % 2 === 0 ? ROW_STYLE : ALT_ROW_STYLE;

    const base = isUpcoming
      ? (showsRsvp
          ? [
              cell(p.username || '', style),
              cell(p.allianceTag || '', style),
              cell(p.furnaceLevel || '', style),
              yesNo(snap?.rsvp?.participating),
              yesNo(snap?.rsvp?.onTime),
              yesNo(snap?.rsvp?.willBeLate),
              yesNo(snap?.rsvp?.willLeaveEarly),
              yesNo(snap?.rsvp?.willJoinDiscord),
              yesNo(snap?.rsvp?.presentWholeTime),
              cell(snap?.notes || '', style),
            ]
          : [
              cell(p.username || '', style),
              cell(p.allianceTag || '', style),
              cell(p.furnaceLevel || '', style),
              yesNo(snap?.rsvp?.participating),
              cell(snap?.notes || '', style),
            ])
      : [
          cell(p.username || '', style),
          cell(p.allianceTag || '', style),
          cell(p.furnaceLevel || '', style),
          yesNo(snap?.attendance?.attended),
          yesNo(snap?.attendance?.noShow),
          yesNo(snap?.attendance?.joinedLateNoNotice),
          yesNo(snap?.voice?.joined),
          cell(snap?.notes || '', style),
        ];

    if (includeJoiners) {
      const playerJoiners = new Set(
        (p.joinerHeroes || []).filter(jh => jh.skillLevel >= 5).map(jh => jh.hero)
      );
      joinerHeroList.forEach(hero => {
        base.push(playerJoiners.has(hero) ? cell('✓', YES_STYLE) : cell('', style));
      });
    }

    rows.push(base);
  });

  // Summary row — filtered to CURRENT participantIds membership. Same
  // fix as EventsTab.jsx's evSum(): removing someone only strips them
  // from participantIds, their snapshot object isn't deleted, so
  // counting raw snapshot values here let a removed person's stale
  // "participating: true" keep inflating the numerator past the
  // (correctly filtered) total — the literal "15/14 participating" bug.
  const total = eventPlayers.length;
  const idSet = new Set(event.participantIds || []);
  const activeSnaps = Object.values(snapMap).filter(s => idSet.has(s.playerId));
  rows.push([]);
  if (isUpcoming) {
    const participating = activeSnaps.filter(s => s.rsvp?.participating).length;
    rows.push([
      cell('SUMMARY', SUBHEADER_STYLE),
      cell('', SUBHEADER_STYLE),
      cell('', SUBHEADER_STYLE),
      cell(`${participating}/${total} participating`, SUBHEADER_STYLE),
    ]);
  } else {
    const attended = activeSnaps.filter(s => s.attendance?.attended === true).length;
    const noShow   = activeSnaps.filter(s => s.attendance?.noShow).length;
    const discord  = activeSnaps.filter(s => s.voice?.joined === true).length;
    rows.push([
      cell('SUMMARY', SUBHEADER_STYLE),
      cell('', SUBHEADER_STYLE),
      cell('', SUBHEADER_STYLE),
      cell(`${attended}/${total} attended`, SUBHEADER_STYLE),
      cell(`${noShow} no-shows`, SUBHEADER_STYLE),
      cell('', SUBHEADER_STYLE),
      cell(`${discord} joined voice`, SUBHEADER_STYLE),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const baseWidths = isUpcoming
    ? (showsRsvp ? [18, 10, 9, 13, 9, 12, 14, 14, 16, 24] : [18, 10, 9, 13, 24])
    : [18, 10, 9, 11, 9, 15, 11, 24];
  const joinerWidths = joinerHeroList.map(() => 10);
  setColWidths(ws, [...baseWidths, ...joinerWidths]);
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  return ws;
}

// ── Sheet 3: Joiner Coverage ───────────────────────────────────
function buildJoinerCoverageSheet(players) {
  const allJoiners = [...new Set(
    players.flatMap(p => (p.joinerHeroes || []).filter(jh => jh.skillLevel >= 5).map(jh => jh.hero))
  )].sort();

  if (allJoiners.length === 0) return null;

  const headers = ['Username', 'Alliance', 'Furnace', 'Role(s)', ...allJoiners, 'Total Heroes'];
  const rows = [headers.map(hdr)];

  players.forEach((p, i) => {
    const style = i % 2 === 0 ? ROW_STYLE : ALT_ROW_STYLE;
    const owned = new Set((p.joinerHeroes || []).filter(jh => jh.skillLevel >= 5).map(jh => jh.hero));
    const count = owned.size;

    const row = [
      cell(p.username || '', style),
      cell(p.allianceTag || '', style),
      cell(p.furnaceLevel || '', style),
      cell((p.roles || []).join(', '), style),
      ...allJoiners.map(h => owned.has(h) ? cell('✓', YES_STYLE) : cell('', style)),
      cell(count, count >= 3 ? YES_STYLE : count >= 1 ? GOLD_STYLE : NO_STYLE),
    ];
    rows.push(row);
  });

  // Coverage totals row
  rows.push([]);
  const totalsRow = [
    cell('COVERAGE', SUBHEADER_STYLE),
    cell('', SUBHEADER_STYLE),
    cell('', SUBHEADER_STYLE),
    cell('', SUBHEADER_STYLE),
    ...allJoiners.map(h => {
      const count = players.filter(p =>
        (p.joinerHeroes || []).some(jh => jh.hero === h && jh.skillLevel >= 5)
      ).length;
      return cell(count, count === 0 ? NO_STYLE : count < 3 ? GOLD_STYLE : YES_STYLE);
    }),
    cell('', SUBHEADER_STYLE),
  ];
  rows.push(totalsRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const baseWidths = [18, 10, 9, 22];
  const heroWidths = allJoiners.map(() => 10);
  setColWidths(ws, [...baseWidths, ...heroWidths, 12]);
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  autoFilter(ws, `A1:${XLSX.utils.encode_col(headers.length - 1)}1`);
  return ws;
}

// ── Cover sheet ────────────────────────────────────────────────
function buildCoverSheet(data) {
  const now      = new Date().toLocaleString();
  const alliance = data.settings?.allianceName || data.settings?.allianceTag || 'Alliance';
  const rows = [
    [cell('CAROLINE', { font: { bold: true, sz: 18, name: 'Arial', color: { rgb: 'F5A623' } } })],
    [cell(alliance, { font: { bold: true, sz: 14, name: 'Arial', color: { rgb: 'FFFFFF' } } })],
    [],
    [cell('Exported:', SUBHEADER_STYLE), cell(now, ROW_STYLE)],
    [cell('Members:', SUBHEADER_STYLE), cell(data.players?.length || 0, ROW_STYLE)],
    [cell('Events:', SUBHEADER_STYLE), cell(data.events?.length || 0, ROW_STYLE)],
    [cell('State:', SUBHEADER_STYLE), cell(data.settings?.stateId || '', ROW_STYLE)],
    [],
    [cell('Sheets in this file:', SUBHEADER_STYLE)],
    [cell('• Roster', ROW_STYLE), cell('All members and their combat stats', ROW_STYLE)],
    [cell('• Joiner Coverage', ROW_STYLE), cell('Hero Skill 5 ownership across the alliance', ROW_STYLE)],
    [cell('• [Event sheets]', ROW_STYLE), cell('One sheet per event — attendance, Discord, performance', ROW_STYLE)],
    [],
    [cell('This file also contains hidden "…Data" sheets (Roster Data, Events Data, etc.) with one row per record. These are how this app reads a spreadsheet back in — leave them alone unless you know what you\'re doing.', { font: { italic: true, sz: 9, name: 'Arial', color: { rgb: '888888' } } })],
    [],
    [cell('Note: SvS and Castle events include joiner coverage columns in their attendance sheet.', { font: { italic: true, sz: 9, name: 'Arial', color: { rgb: '888888' } } })],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 22 }, { wch: 60 }];

  // Dark background for the whole cover
  applyStyle(ws, 'A1:B2', {
    fill: { patternType: 'solid', fgColor: { rgb: '0A1628' } },
  });

  return ws;
}

// ── Main export function ───────────────────────────────────────
// options lets a caller (e.g. a future DataPanel.jsx checklist) export
// only part of the data instead of always generating everything:
//   includeRoster – Roster + Roster Data + Joiner Coverage + Roles Data
//   includeEvents – event attendance sheets + Events Data
//   includePlans  – Plans Data (battle plan records)
//   eventId       – when set, scopes BOTH events and plans to just that
//                   one event (plans via plan.eventId) — "battle plans
//                   due a specific event only"
// Calling exportWorkbook(data) with no options exports everything, same
// as before this option support existed.
export function exportWorkbook(data, options = {}) {
  const {
    includeRoster = true,
    includeEvents = true,
    includePlans  = true,
    eventId       = null,
  } = options;

  const wb = XLSX.utils.book_new();

  // 1. Cover sheet
  const coverWs = buildCoverSheet(data);
  XLSX.utils.book_append_sheet(wb, coverWs, 'Overview');

  // 2. Full roster
  if (includeRoster) {
    const rosterWs = buildRosterSheet(data.players || []);
    XLSX.utils.book_append_sheet(wb, rosterWs, 'Roster');

    const joinerWs = buildJoinerCoverageSheet(data.players || []);
    if (joinerWs) XLSX.utils.book_append_sheet(wb, joinerWs, 'Joiner Coverage');
  }

  // 3. One sheet per event (most recent first) — scoped to eventId if set
  const scopedEvents = eventId ? (data.events || []).filter(e => e.id === eventId) : (data.events || []);
  const sortedEvents = includeEvents ? [...scopedEvents].sort((a, b) => new Date(b.date) - new Date(a.date)) : [];
  const usedEventSheetNames = new Set(['Overview', 'Roster', 'Joiner Coverage', 'Roster Data', 'Events Data', 'Plans Data', 'Roles Data']);
  sortedEvents.forEach(event => {
    const includeJoiners = JOINER_COVERAGE_EVENTS.includes(event.type);
    const eventWs = buildEventSheet(event, data.players || [], includeJoiners);
    const sheetName = uniqueSheetName(event.name || event.type || 'Event', usedEventSheetNames);
    usedEventSheetNames.add(sheetName);
    XLSX.utils.book_append_sheet(wb, eventWs, sheetName);
  });

  // 4. Raw "…Data" sheets — one row per record, for re-importing this
  // file back into the app later (see xlsxImportService.js). Hidden by
  // default (Sheet > Unhide to see them) so they don't clutter the
  // view for someone just reading the report.
  const dataSheetNames = [];
  if (includeRoster) {
    const rosterDataWs = buildRosterDataSheet(data.players || []);
    XLSX.utils.book_append_sheet(wb, rosterDataWs, 'Roster Data');
    dataSheetNames.push('Roster Data');

    const rolesDataWs = buildRolesDataSheet(data.customRoles || []);
    XLSX.utils.book_append_sheet(wb, rolesDataWs, 'Roles Data');
    dataSheetNames.push('Roles Data');
  }

  if (includeEvents) {
    const eventsDataWs = buildEventsDataSheet(scopedEvents);
    XLSX.utils.book_append_sheet(wb, eventsDataWs, 'Events Data');
    dataSheetNames.push('Events Data');
  }

  if (includePlans) {
    // "Battle plans due a specific event only" — plans link to an
    // event via plan.eventId, so scoping by eventId filters here too.
    const scopedPlans = eventId ? (data.svsPlans || []).filter(p => p.eventId === eventId) : (data.svsPlans || []);
    const plansDataWs = buildPlansDataSheet(scopedPlans);
    XLSX.utils.book_append_sheet(wb, plansDataWs, 'Plans Data');
    dataSheetNames.push('Plans Data');
  }

  wb.Workbook = wb.Workbook || {};
  wb.Workbook.Sheets = wb.SheetNames.map(name => ({ Hidden: dataSheetNames.includes(name) ? 1 : 0 }));

  // 5. Generate filename
  const alliance  = data.settings?.allianceTag || 'export';
  const dateStr   = new Date().toISOString().slice(0, 10);
  const filename  = `alliance-manager-${alliance}-${dateStr}.xlsx`;

  // 6. Write and download
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true });
}
