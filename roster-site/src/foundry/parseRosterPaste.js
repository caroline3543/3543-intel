export const rosterPasteHeader = 'Username\tTroop power\tLegion\tRegistration';

export const rosterExtractionPrompt = `Transcribe the attached Whiteout Survival Foundry or Canyon Clash registration screenshots into a tab-separated player list (TSV). Return exactly one plain-text code block with this header:
${rosterPasteHeader}

Extraction rules:
- Process screenshots in attachment order and players in visible top-to-bottom order.
- Include one row per visible player, including repeated players across screenshots. The importing application handles duplicate review.
- Exclude headings, summary counts and interface labels.

Username:
- Copy the displayed username exactly, preserving capitalisation, accents, superscripts, decorative symbols, spaces and non-Latin characters.
- Do not translate, normalise or simplify usernames.
- If any part of the username is unreadable, leave the username field empty. Still extract the remaining fields. Never present a partial username as a complete identity.

Troop power:
- Copy displayed troop power as full digits without commas, spaces or abbreviations. Do not confuse troop power with city power.
- If the complete value cannot be confidently read, leave the field empty.

Legion and registration:
- Use 1 or 2 for Legion, based on the displayed roster heading.
- Use only Combatant, Substitute, Unassigned or Other legion for registration, based on the individual player's visible status.
- Do not assume a player is a combatant simply because they appear under a legion tab.
- Leave uncertain values empty.

Output requirements:
- Every data row must contain exactly four fields separated by exactly three actual tab characters.
- Preserve empty fields, including leading and trailing tabs. Never shift values into another column when a field is missing.
- Do not use spaces as column separators or insert placeholders such as Unknown, N/A or question marks.
- Do not guess usernames.
- Before returning, silently verify every row has four fields, every populated troop power contains digits only, every populated Legion is 1 or 2, and every populated registration uses an allowed status.
- Return only the plain-text code block. No explanations or additional commentary.`;

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

const powerPattern = /^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,3}(?:[ \u00A0\u202F]\d{3})+)(?:\.\d+(?=\s*[KMB]$))?(?:\s*[KMB])?$/iu;

function pastePower(value) {
  if (!value) return null;
  if (!powerPattern.test(value)) throw Error('Troop power must be a whole number with clear thousands grouping.');
  const compact = value.replace(/[,\s]/gu, '').toUpperCase();
  const scale = {K:3,M:6,B:9}[compact.at(-1)] ?? 0;
  const [whole,fraction=''] = (scale ? compact.slice(0,-1) : compact).split('.');
  if (/[^0]/u.test(fraction.slice(scale))) throw Error('Troop power must resolve to a whole number.');
  const power = Number(whole+fraction.slice(0,scale).padEnd(scale,'0'));
  if (!Number.isSafeInteger(power)) throw Error('Troop power is too large.');
  return power;
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
  const match = line.match(/^(.+?)(?:\s*[—–]\s*|\s+-\s+|\s+)([0-9]+(?:(?:[, \u00A0\u202F])[0-9]{3})*(?:\.\d+)?(?:\s*[KMB])?)$/iu);
  return match ? match.slice(1) : [line];
}

export function parseRosterPaste(text, defaultLegion) {
  const rows = [], errors = [];
  let header, delimiter, legion = defaultLegion, registration = '';
  const lines = String(text ?? '').split(/\r?\n/u);
  for (const [index, raw] of lines.entries()) {
    const line = raw.replace(invisible, '').replace(/^[ \u00A0]+/u, '').replace(/[ \u00A0]+$/u, '');
    if (!line.trim() || /^\x60\x60\x60(?:tsv|csv|text)?\s*$/iu.test(line)) continue;
    const heading = line.trim().match(/^(?:#{1,6}\s*)?(?:Legion\s*([12])\s*[:–—-]?\s*)?(Combatants?|Substitutes?|Unassigned)?\s*:?$/iu);
    if (heading && (heading[1] || heading[2])) {
      if (heading[1]) { legion = Number(heading[1]); registration = ''; }
      if (heading[2]) registration = heading[2].toLowerCase().replace(/s$/u, '');
      continue;
    }
    try {
      const body = line.replace(/^(?:[-*•]|\d+[.)])\s+/u, '');
      const plain = fields(body, null, false);
      const explicitDash = plain.length===2 && /[—–]|\s-\s/u.test(body.slice(plain[0].length,body.length-plain[1].length));
      if (!delimiter && !explicitDash && !body.includes('\t') && !body.includes('|') && plain.length===2 && plain[1].includes(',') && !plain[0].endsWith(',')) {
        throw Error('Use a dash, tabs or quoted CSV to separate a name from comma-grouped power.');
      }
      const separated = delimiter ?? (explicitDash ? null : body.includes('\t') ? '\t' : body.includes('|') ? '|' : body.includes(',') && (!/\d,\d{3}(?:,\d{3})*$/u.test(body) || /^[^,]+,\s*\d{1,3}(?:,\d{3})+$/u.test(body)) ? ',' : null);
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
      if ((!row.name && !(row.power && (row.registration || registration || row.legion || header))) || (!row.power && !row.registration && !registration && !row.fid)) throw Error('Include a username and its power, registration or player ID, or a structured unread-name row with troop power.');
      if (!header && values.length === 2 && !row.power) throw Error('Troop power is empty.');
      const power = pastePower(row.power);
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
  if(rows.length>100)return {rows:[],errors:[{line:0,message:'Paste at most 100 player readings at a time.'}]};
  return { rows, errors };
}
