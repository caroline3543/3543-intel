export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function fmtDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return null; }
}

export function fmtDateShort(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return iso; }
}

export function numFmt(n) {
  if (n == null || n === '') return '—';
  return Number(n).toLocaleString();
}
