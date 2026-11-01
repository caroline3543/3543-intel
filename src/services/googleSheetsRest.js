/**
 * Server-side Google Sheets REST adapter.
 * Inject a short-lived access token obtained by a trusted backend OAuth service.
 * NEVER import this module from a browser component or expose refresh tokens.
 */
const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SHEET_ID = /^[a-zA-Z0-9_-]{15,200}$/;
const MAX_RANGES = 100;

export function assertSpreadsheetId(id) {
  if (typeof id !== 'string' || !SHEET_ID.test(id)) throw new Error('Invalid spreadsheet ID');
  return id;
}

export function makeSheetRange(title, a1 = 'A1:ZZ') {
  if (typeof title !== 'string' || !title || title.length > 100) throw new Error('Invalid worksheet title');
  if (!/^[A-Z]+[1-9]\d*(?::[A-Z]+[1-9]\d*)?$/.test(a1) &&
      !/^[A-Z]+[1-9]\d*:[A-Z]+$/.test(a1)) throw new Error('Invalid A1 range');
  return `'${title.replace(/'/g, "''")}'!${a1}`;
}

async function request(fetchImpl, token, url, options = {}) {
  if (typeof token !== 'string' || !token) throw new Error('Missing Google access token');
  const response = await fetchImpl(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (!response.ok) {
    // Do not leak Google response bodies; these might contain private spreadsheet data.
    const error = new Error(`Google Sheets request failed (${response.status})`);
    error.status = response.status;
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }
  return response.json();
}

export function createGoogleSheetsClient({ accessToken, fetchImpl = fetch }) {
  return {
    async metadata(spreadsheetId) {
      const id = assertSpreadsheetId(spreadsheetId);
      const query = '?fields=spreadsheetId,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))';
      return request(fetchImpl, accessToken, `${API}/${encodeURIComponent(id)}${query}`);
    },
    async readRanges(spreadsheetId, ranges) {
      const id = assertSpreadsheetId(spreadsheetId);
      if (!Array.isArray(ranges) || !ranges.length || ranges.length > MAX_RANGES ||
          ranges.some(r => typeof r !== 'string' || !/^'([^']|'')+'![A-Z0-9:]+$/.test(r))) {
        throw new Error('Invalid read ranges');
      }
      const query = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE' });
      for (const range of ranges) query.append('ranges', range);
      return request(fetchImpl, accessToken, `${API}/${encodeURIComponent(id)}/values:batchGet?${query}`);
    },
    async writeRanges(spreadsheetId, changes) {
      const id = assertSpreadsheetId(spreadsheetId);
      if (!Array.isArray(changes) || !changes.length || changes.length > MAX_RANGES ||
        changes.some(c => !c || typeof c.range !== 'string' ||
          !/^'([^']|'')+'![A-Z]+[1-9]\d*$/.test(c.range) ||
          !Array.isArray(c.values) || c.values.length !== 1 ||
          !Array.isArray(c.values[0]) || c.values[0].length !== 1)) {
        throw new Error('Expected 1–100 single-cell updates with valid ranges');
      }
      return request(fetchImpl, accessToken, `${API}/${encodeURIComponent(id)}/values:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ valueInputOption: 'RAW', data: changes }),
      });
    },
  };
}
