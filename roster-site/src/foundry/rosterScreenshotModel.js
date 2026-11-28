export function readScreenshotLegion(text) {
  const headings = [...String(text).matchAll(/\bLegion\s*([12])\s+Combatants?\b/gi)];
  const legions = new Set(headings.map(match => Number(match[1])));
  return legions.size === 1 ? [...legions][0] : null;
}

export function readScreenshotPower(text) {
  let value = String(text).trim().replace(/\s+([KMB])$/i, '$1');
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(value)) value = value.replace(/\./g, ',');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+[KMB]|[KMB])?$/i.test(value)) return null;
  const multiplier = { K: 1e3, M: 1e6, B: 1e9 }[value.at(-1)?.toUpperCase()] ?? 1;
  const amount = Number(value.replace(/[,KMB]/gi, '')) * multiplier;
  // Compact power strings can produce insignificant floating-point error.
  const rounded = Math.round(amount);
  return Number.isSafeInteger(rounded) && Math.abs(amount - rounded) < 0.00001 ? rounded : null;
}

export function readScreenshotRow(text) {
  const [name = '', ...rest] = String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const otherLegion = Number(rest.join(' ').match(/\bLegion\s*([12])\s+dispatched\b/i)?.[1]) || null;
  const candidate = rest.find(line=>/^(?:[^\d\s]{1,2}\s+)?\d[\d,.]*(?:\s*[KMB])?\s*[|]?$/i.test(line)) ?? '';
  // The crossed-swords icon sometimes produces a leading OCR glyph.
  const powerText = candidate.match(/^(?:[^\d\s]{1,2}\s+)?(\d[\d,.]*(?:\s*[KMB])?)\s*[|]?$/i)?.[1];
  return {
    name: /^[\d,.]+$/.test(name) && !rest.length ? '' : name.replace(/\s+\|$/, ''),
    otherLegion,
    power: powerText !== undefined ? readScreenshotPower(powerText) : null,
  };
}

export function pickScreenshotRows(pixels, width, height) {
  const columns = [.43, .56, .69, .89].map(ratio => Math.floor(width * ratio));
  const hasFill = y => columns.filter(x => {
    const offset = (y * width + x) * 4;
    const [r, g, b] = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    return Math.abs(r - 167) < 16 && Math.abs(g - 194) < 13 && Math.abs(b - 236) < 13;
  }).length >= 2;
  const start = Math.round(height * .335);
  const end = Math.round(height * .747);
  const rows = [];
  let top = null, bottom = 0;
  function finish() {
    const span = bottom - top;
    if (span >= height * .007) {
      const partial = span < height * .065;
      rows.push({ top, bottom, ...(partial ? { partial } : {}) });
    }
    top = null;
  }
  for (let y = start; y < end; y++) {
    if (hasFill(y)) {
      top ??= y;
      bottom = y + 1;
    } else if (top !== null && y - bottom > height * .003) {
      finish();
    }
  }
  if (top !== null) finish();
  return rows;
}

// Cross-screenshot duplicates require compatible evidence and exact NFC
// spelling. A repeated name in one screenshot remains two independent rows.
export function combineScreenshotRows(screenshots, resolveIdentity = () => null) {
  const groups = new Map(), records = [];
  for (const [sourceIndex, screenshot] of screenshots.entries()) {
    for (const [rowIndex, row] of screenshot.rows.entries()) {
      const evidence = { sourceIndex, bounds: row.bounds };
      const rowId = sourceIndex + ':' + rowIndex;
      const identity=resolveIdentity(row.name);
      const key=identity ? 'id:'+identity : row.name ? 'name:'+row.name.normalize('NFC') : '';
      const list = groups.get(key) ?? [];
      const compatible = key && list.find(existing =>
        !existing.sources.includes(sourceIndex) &&
        row.power !== null && existing.power === row.power &&
        (!existing.registration || existing.registration === 'unknown' || !row.registration ||
          row.registration === 'unknown' || existing.registration === row.registration) &&
        (!existing.otherLegion || !row.otherLegion || existing.otherLegion === row.otherLegion));
      if (compatible) {
        compatible.power ??= row.power;
        if (!compatible.registration || compatible.registration === 'unknown') compatible.registration = row.registration;
        if (row.otherLegion) compatible.otherLegion = row.otherLegion;
        const alternatives = [...new Set([...(compatible.powerConflict ?? []), ...(row.powerConflict ?? [])])];
        if (alternatives.length > 1) compatible.powerConflict = alternatives;
        compatible.sources.push(sourceIndex);
        compatible.evidence.push(evidence);
        compatible.observedNames=[...new Set([...(compatible.observedNames??[compatible.name]),row.name])];
        compatible.nameAlternatives=[...new Set([...(compatible.nameAlternatives??[]),...(row.nameAlternatives??[])])];
        compatible.voted ||= row.voted;
        compatible.battleRequest ||= row.battleRequest;
      } else {
        const record = { ...row, rowId, sources: [sourceIndex], evidence: [evidence] };
        list.push(record);
        records.push(record);
      }
      groups.set(key, list);
    }
  }
  for (const [key, list] of groups) {
    if (key && list.length > 1) list.forEach(row => { row.conflict = true; });
  }
  return records;
}

// Read tick ink against the underlying button fill in the centre of each
// checkbox. A blue or green background establishes presence only.
export function classifyRosterCheckboxes(pixels, width, height, top, bottom) {
  function inspect(cx, blue) {
    const centre = (top + bottom) / 2;
    let tick = 0, fill = 0, total = 0;
    for (let y = Math.round(centre - height * .014); y < Math.round(centre + height * .014); y++) {
      for (let x = Math.round(width * (cx - .022)); x < Math.round(width * (cx + .022)); x++) {
        const i = (y * width + x) * 4;
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        total++;
        if (blue ? Math.abs(r - 108) < 21 && Math.abs(g - 139) < 20 && Math.abs(b - 185) < 18
          : Math.abs(r - 93) < 21 && Math.abs(g - 147) < 20 && Math.abs(b - 85) < 20) fill++;
        if (blue ? b > 207 && g > 147 && b - r > 80 && g - r > 60
          : g > 168 && g - r > 75 && g - b > 85) tick++;
      }
    }
    if (fill / total < .22) return null;
    if (tick / total >= .10) return true;
    return tick / total < .025 && fill / total > .48 ? false : null;
  }
  if (bottom - top < height * .065) return 'unknown';
  const combatant = inspect(.753, false);
  const substitute = inspect(.875, true);
  if (combatant === null || substitute === null || combatant && substitute) return 'unknown';
  return combatant ? 'combatant' : substitute ? 'substitute' : 'unassigned';
}

export function readRegistrationTotals(text){
 const read=label=>{const m=String(text).match(new RegExp('(?:'+label+')\\s*[:：]?\\s*(\\d+)\\s*/\\s*(\\d+)','i'));return m&&Number(m[1])<=Number(m[2])?{count:Number(m[1]),limit:Number(m[2])}:null;};
 return {combatant:read('Join|Combatants?'),substitute:read('Substitutes?')};
}
export function registrationCountReview(screenshots,rows){
 return ['combatant','substitute'].map(role=>{
  const values=[...new Set(screenshots.map(s=>s.totals?.[role]?.count).filter(Number.isInteger))];
  const detected=rows.filter(r=>r.registration===role&&!r.conflict).length;
  return {role,detected,expected:values.length===1?values[0]:null,conflict:values.length>1};
 });
}

 // Pasted rows use the same power parser and identity review as screenshots.
 // Never infer a registration from a name/power list.
export function parsePastedRoster(text) {
  const lines=String(text ?? '').split(/\r?\n/).map((line,index)=>({line:line.trim(),index})).filter(x=>x.line);
  if(lines.length>100) return {error:'Paste at most 100 readings at a time.',rows:[]};
  const rows=[];
  for(const {line,index} of lines){
    const match=line.match(/^(.+?)(?:\s*[—–\t]\s*|,\s*|\s+-\s+)(\d[\d,.]*(?:\s*[KMB])?)$/i);
    const power=match?readScreenshotPower(match[2]):null;
    if(!match||!match[1].trim()||power===null) return {error:'Check line '+(index+1)+': use Name, Troop Power.',rows:[]};
    rows.push({rowId:'paste:'+index,name:match[1].trim(),power,registration:'unknown',evidence:[],sources:[]});
  }
  return {rows,error:rows.length?'':'Paste at least one name and troop power.'};
}
