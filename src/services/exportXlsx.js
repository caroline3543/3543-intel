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
 *   - Prep scores
 *
 * Called from DataPanel via exportWorkbook(data, options).
 */

import * as XLSX from 'xlsx';
import { JOINER_COVERAGE_EVENTS } from '../utils/constants.js';

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

// ── Sheet 1: Roster ────────────────────────────────────────────
function buildRosterSheet(players) {
  const headers = [
    'Username', 'Nickname', 'Alliance', 'Furnace',
    'Infantry', 'Lancer', 'Marksman',
    'Role(s)', 'Joiner Heroes',
    'Availability', 'Discord', 'Country', 'Languages',
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
      yesNo(p.availability?.present),
      yesNo(p.availability?.discord),
      cell(p.country || '', style),
      cell((p.languages || []).join(', '), style),
      cell(p.fid || '', style),
      cell('', style),   // reliability — calculated in Intel tab, not stored
      cell(p.profileLastUpdated ? new Date(p.profileLastUpdated).toLocaleDateString() : '', style),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [18, 14, 10, 9, 9, 9, 9, 22, 30, 12, 10, 16, 20, 12, 12, 14]);
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  autoFilter(ws, `A1:P1`);
  return ws;
}

// ── Sheet 2: Event Attendance ──────────────────────────────────
function buildEventSheet(event, players, includeJoiners) {
  const snapMap = Object.fromEntries((event.snapshots || []).map(s => [s.playerId, s]));
  const eventPlayers = event.participantIds?.length > 0
    ? players.filter(p => event.participantIds.includes(p.id))
    : players;

  // Base columns
  const baseHeaders = [
    'Username', 'Alliance', 'Furnace',
    'Showed Up', 'Late', 'Left Early', 'No-show',
    'On Discord', 'Joined Rallies', 'Followed Plan', 'Ignored Orders',
    'Performance', 'Notes',
  ];

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
    const perf  = snap?.performanceTag || '';
    const perfLabel = perf === 'strong' ? '⭐ Strong' : perf === 'reliable' ? '✓ Reliable' : perf === 'issue' ? '⚠ Issue' : perf === 'noshow' ? '✗ No-show' : perf === 'improving' ? '↑ Improving' : '';

    const base = [
      cell(p.username || '', style),
      cell(p.allianceTag || '', style),
      cell(p.furnaceLevel || '', style),
      yesNo(snap?.attendance?.attended),
      yesNo(snap?.attendance?.late),
      yesNo(snap?.attendance?.leftEarly),
      yesNo(snap?.attendance?.noShow),
      yesNo(snap?.voice?.joined),
      yesNo(snap?.combat?.joinedRallies),
      yesNo(snap?.combat?.followedOrders),
      yesNo(snap?.combat?.wentRogue ? true : false),
      cell(perfLabel, style),
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

  // Summary row
  const total     = eventPlayers.length;
  const attended  = Object.values(snapMap).filter(s => s.attendance?.attended === true).length;
  const noShow    = Object.values(snapMap).filter(s => s.attendance?.noShow).length;
  const discord   = Object.values(snapMap).filter(s => s.voice?.joined === true).length;

  rows.push([]);
  rows.push([
    cell('SUMMARY', SUBHEADER_STYLE),
    cell('', SUBHEADER_STYLE),
    cell('', SUBHEADER_STYLE),
    cell(`${attended}/${total} showed up`, SUBHEADER_STYLE),
    cell('', SUBHEADER_STYLE),
    cell('', SUBHEADER_STYLE),
    cell(`${noShow} no-shows`, SUBHEADER_STYLE),
    cell(`${discord} on Discord`, SUBHEADER_STYLE),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const baseWidths = [18, 10, 9, 11, 8, 11, 9, 11, 14, 14, 14, 14, 24];
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

// ── Sheet 4: Prep Scores ───────────────────────────────────────
function buildScoresSheet(prepScores, players) {
  const headers = ['Member', 'Alliance', 'Prep Points', 'Target', 'Gap to Target', '% Complete', 'On Roster', 'Notes', 'Last Updated'];
  const rows = [headers.map(hdr)];

  const sorted = [...prepScores].sort((a, b) => (b.prepScore || 0) - (a.prepScore || 0));

  sorted.forEach((entry, i) => {
    const style    = i % 2 === 0 ? ROW_STYLE : ALT_ROW_STYLE;
    const onRoster = players.some(p => p.id === entry.playerId || p.username === entry.playerName);
    const gap      = entry.targetScore && entry.prepScore != null ? entry.targetScore - entry.prepScore : null;
    const pct      = entry.targetScore && entry.prepScore != null
      ? Math.min(100, Math.round((entry.prepScore / entry.targetScore) * 100))
      : null;

    rows.push([
      cell(entry.playerName || '', style),
      cell(entry.allianceTag || '', style),
      cell(entry.prepScore ?? '', { ...style, numFmt: '#,##0' }),
      cell(entry.targetScore ?? '', { ...style, numFmt: '#,##0' }),
      cell(gap != null ? gap : '', { ...style, numFmt: '#,##0' }),
      cell(pct != null ? `${pct}%` : '', pct >= 100 ? YES_STYLE : pct >= 50 ? GOLD_STYLE : NO_STYLE),
      cell(onRoster ? '✓' : '', onRoster ? YES_STYLE : style),
      cell(entry.notes || '', style),
      cell(entry.lastUpdated ? new Date(entry.lastUpdated).toLocaleDateString() : '', style),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [18, 10, 14, 14, 14, 12, 10, 24, 14]);
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  autoFilter(ws, 'A1:I1');
  return ws;
}

// ── Cover sheet ────────────────────────────────────────────────
function buildCoverSheet(data) {
  const now      = new Date().toLocaleString();
  const alliance = data.settings?.allianceName || data.settings?.allianceTag || 'Alliance';
  const rows = [
    [cell('SUNFIRE COMMAND', { font: { bold: true, sz: 18, name: 'Arial', color: { rgb: 'F5A623' } } })],
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
    [cell('• Prep Scores', ROW_STYLE), cell('SvS prep points and targets', ROW_STYLE)],
    [cell('• [Event sheets]', ROW_STYLE), cell('One sheet per event — attendance, Discord, performance', ROW_STYLE)],
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
export function exportWorkbook(data) {
  const wb = XLSX.utils.book_new();

  // 1. Cover sheet
  const coverWs = buildCoverSheet(data);
  XLSX.utils.book_append_sheet(wb, coverWs, 'Overview');

  // 2. Full roster
  const rosterWs = buildRosterSheet(data.players || []);
  XLSX.utils.book_append_sheet(wb, rosterWs, 'Roster');

  // 3. Joiner coverage
  const joinerWs = buildJoinerCoverageSheet(data.players || []);
  if (joinerWs) XLSX.utils.book_append_sheet(wb, joinerWs, 'Joiner Coverage');

  // 4. Prep scores
  if ((data.prepScores || []).length > 0) {
    const scoresWs = buildScoresSheet(data.prepScores, data.players || []);
    XLSX.utils.book_append_sheet(wb, scoresWs, 'Prep Scores');
  }

  // 5. One sheet per event (most recent first)
  const sortedEvents = [...(data.events || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  sortedEvents.forEach(event => {
    const includeJoiners = JOINER_COVERAGE_EVENTS.includes(event.type);
    const eventWs = buildEventSheet(event, data.players || [], includeJoiners);
    // Sheet name max 31 chars, strip special chars
    const sheetName = (event.name || event.type || 'Event')
      .replace(/[\\/:*?[\]]/g, '')
      .slice(0, 28);
    XLSX.utils.book_append_sheet(wb, eventWs, sheetName);
  });

  // 6. Generate filename
  const alliance  = data.settings?.allianceTag || 'export';
  const dateStr   = new Date().toISOString().slice(0, 10);
  const filename  = `sunfire-${alliance}-${dateStr}.xlsx`;

  // 7. Write and download
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true });
}
