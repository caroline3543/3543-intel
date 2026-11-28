export const rosterExtractionPrompt = `Transcribe these Whiteout Survival Foundry or Canyon Clash registration screenshots in screenshot order. Return one tab-separated row per visible player in a plain text code block with this header:
Username	Troop power	Legion	Registration	Player ID
Copy usernames exactly, including decorations and non-Latin characters. Write troop power as the full integer, with no abbreviations. Legion is 1 or 2 as displayed. Registration is Combatant, Substitute, Unassigned, or Other legion, only when visible. Include Player ID only when the screenshot explicitly shows it. Leave unreadable or absent fields blank. Include repeated rows so the organiser can reconcile them. Do not infer identities, fill missing values, or add commentary inside the block.`;

const invisible = /[\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu;
const clean = value => String(value ?? '').replace(invisible, '').trim();
const key = value => clean(value).toLowerCase().replace(/[_ -]+/gu, '');
const columns = new Map(Object.entries({
  username: 'name', name: 'name', player: 'name', trooppower: 'power', power: 'power',
  legion: 'legion', registration: 'registration', status: 'registration',
  registrationstatus: 'registration', role: 'registration', playerid: 'fid', fid: 'fid',
}));
const roles = new Map(Object.entries({
  combatant: 'combatant', join: 'combatant', participant: 'combatant',
  substitute: 'substitute', sub: 'substitute', unassigned: 'unassigned',
  notparticipating: 'unassigned', otherlegion: 'other-legion', unknown: 'unknown',
}));

function csv(line) {
  const cells = [];
  const field = /(?:"((?:[^"]|"")*)"|([^",]*))([,]|$)/gy;
  for (let end = 0;;) {
    field.lastIndex = end;
    const match = field.exec(line);
    if (!match) throw Error('Invalid CSV quoting.');
    cells.push(match[1] === undefined ? match[2] : match[1].replace(/""/g, '"'));
    if (!match[3]) return cells;
    end = field.lastIndex;
  }
}

function fields(line, delimiter, header) {
  if (delimiter === '\t' || delimiter === '|') return line.split(delimiter);
  if (delimiter === ',') {
    const cells = csv(line);
    if (!header && cells.length > 2 && !line.includes('"') && /^\d{1,3}$/u.test(clean(cells[1]))
      && cells.slice(2).every(cell => /^\d{3}$/u.test(clean(cell)))) return [cells[0], cells.slice(1).map(clean).join(',')];
    if (!header && cells.length > 2 && !line.includes('"') && /^\d{3}$/u.test(clean(cells[2]))) {
      throw Error('Quote comma-grouped troop power or use tabs when adding more columns.');
    }
    return cells;
  }
  const match = line.match(/^(.+?)(?:\s+[—–-]\s+|\s+)([0-9]+(?:(?:[, \u00A0\u202F])[0-9]{3})*)$/u);
  return match ? match.slice(1) : [line];
}

export function parseRosterPaste(text, defaultLegion) {
  const rows = [], errors = [];
  let header, delimiter, legion = defaultLegion, registration = '';
  const lines = String(text ?? '').split(/\r?\n/u);
  for (const [index, raw] of lines.entries()) {
    const line = raw.replace(invisible, '').replace(/^\s+/u, '').replace(/[ \u00A0]+$/u, '');
    if (!line.trim() || /^\x60\x60\x60(?:tsv|csv|text)?\s*$/iu.test(line)) continue;
    const heading = line.trim().match(/^(?:#{1,6}\s*)?(?:Legion\s*([12])\s*[:–—-]?\s*)?(Combatants?|Substitutes?|Unassigned)?\s*:?$/iu);
    if (heading && (heading[1] || heading[2])) {
      if (heading[1]) { legion = Number(heading[1]); registration = ''; }
      if (heading[2]) registration = heading[2].toLowerCase().replace(/s$/u, '');
      continue;
    }
    try {
      const body = line.replace(/^(?:[-*•]|\d+[.)])\s+/u, '');
      const separated = delimiter ?? (body.includes('\t') ? '\t' : body.includes('|') ? '|' : body.includes(',') && (!/\d,\d{3}(?:,\d{3})*$/u.test(body) || /^[^,]+,\s*\d{1,3}(?:,\d{3})+$/u.test(body)) ? ',' : null);
      let values = fields(body, separated, header).map(clean);
      // An unquoted two-column CSV can end in a comma-grouped number.
      if (!separated && values.length === 1 && body.includes(',')) values = fields(body, ',', header).map(clean);
      const mapped = values.map(value => columns.get(key(value)));
      if (mapped.length > 1 && mapped.includes('name') && mapped.every(Boolean)) {
        if (new Set(mapped).size !== mapped.length) throw Error('Header contains duplicate columns.');
        header = mapped;
        delimiter = separated;
        continue;
      }
      const layout = header ?? ['name', 'power', 'legion', 'registration', 'fid'];
      if (values.length > layout.length) throw Error('Unexpected columns. Use the extraction header to specify column order.');
      const row = Object.fromEntries(layout.map((field, i) => [field, values[i] ?? '']));
      if (!row.name || (!row.power && !row.registration && !registration && !row.fid)) throw Error('Include a username and its power, registration or player ID.');
      if (!header && values.length === 2 && !row.power) throw Error('Troop power is empty.');
      const powerValue = row.power || '';
      if (powerValue && !/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,3}(?:[ \u00A0\u202F]\d{3})+)$/u.test(powerValue)) throw Error('Troop power must be a whole number with clear thousands grouping.');
      const power = powerValue ? Number(powerValue.replace(/[,\s]/gu, '')) : null;
      if (power !== null && !Number.isSafeInteger(power)) throw Error('Troop power is too large.');
      const legionText = row.legion || '';
      if (legionText && !/^(?:Legion\s*)?[12]$/iu.test(legionText)) throw Error('Legion must be 1 or 2.');
      const status = row.registration || registration;
      if (status && !roles.has(key(status))) throw Error('Registration status is unknown.');
      if (row.fid && (!/^\d+$/u.test(row.fid) || /^0+$/u.test(row.fid))) throw Error('Player ID must be a nonzero number.');
      rows.push({ rowId: 'paste:' + (index + 1), name: row.name, power, legion: legionText ? Number(legionText.at(-1)) : legion,
        registration: roles.get(key(status)) ?? 'unknown', fid: row.fid || null, source: 'paste', evidence: [] });
    } catch (error) {
      errors.push({ line: index + 1, message: error.message });
    }
  }
  return { rows, errors };
}
