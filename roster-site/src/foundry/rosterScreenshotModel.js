export function readScreenshotLegion(text) {
  const headings = [...String(text).matchAll(/\bLegion\s*([12])\s+Combatants?\b/gi)];
  const legions = new Set(headings.map(match => Number(match[1])));
  return legions.size === 1 ? [...legions][0] : null;
}

export function readScreenshotPower(text) {
  const value = String(text).trim().replace(/\s+([KMB])$/i, '$1');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+[KMB]|[KMB])?$/i.test(value)) return null;
  const multiplier = { K: 1e3, M: 1e6, B: 1e9 }[value.at(-1)?.toUpperCase()] ?? 1;
  const amount = Number(value.replace(/[,KMB]/gi, '')) * multiplier;
  // Compact power strings can produce insignificant floating-point error.
  const rounded = Math.round(amount);
  return Number.isSafeInteger(rounded) && Math.abs(amount - rounded) < 0.00001 ? rounded : null;
}

export function readScreenshotRow(text) {
  const [name = '', ...rest] = String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (rest.some(line => /\bLegion\s*[12]\s+dispatched\b/i.test(line))) return null;
  const candidate = rest[0] ?? '';
  // The crossed-swords icon sometimes produces a leading OCR glyph.
  const powerText = candidate.match(/^(?:[^\d\s]{1,2}\s+)?(\d[\d,.]*(?:\s*[KMB])?)\s*[|]?$/i)?.[1];
  return {
    name: /^[\d,.]+$/.test(name) && !rest.length ? '' : name.replace(/\s+\|$/, ''),
    power: powerText !== undefined ? readScreenshotPower(powerText) : null,
  };
}

export function pickScreenshotRows(results, width, height) {
  // Look for the common blue row fill at several columns. Requiring agreement
  // rejects rank headers, empty space, and most text and decorations.
  const columns = [.43, .56, .69, .89].map(ratio => Math.floor(width * ratio));
  const hasFill = y => columns.filter(x => {
    const offset = (y * width + x) * 4;
    const [r, g, b] = [results[offset], results[offset + 1], results[offset + 2]];
    return Math.abs(r - 167) < 16 && Math.abs(g - 194) < 13 && Math.abs(b - 236) < 13;
  }).length >= 2;
  const end = Math.round(height * .8);
  const rows = [];
  let top = null, bottom = 0;
  for (let y = Math.round(height * .33); y < end; y++) {
    if (hasFill(y)) {
      top ??= y;
      bottom = y + 1;
    } else if (top !== null && y - bottom > height * .003) {
      if (bottom - top >= height * .025) rows.push({ top, bottom });
      top = null;
    }
  }
  if (top !== null && bottom - top >= height * .025) rows.push({ top, bottom });
  return rows;
}
