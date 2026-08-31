// Generic get/assign/unassign helpers for any player attribute reachable
// by a dot-path (e.g. 'languages', 'troops.infantry'). Powers
// FieldRegistry.jsx — the same tap-to-assign pattern the old Joiner
// Registry used for heroes, generalized across any profile field so new
// fields don't need their own bespoke service.
//
// Array fields (multi:true, e.g. languages) ADD on assign and remove a
// single entry on unassign — a player can hold several values.
// Single-value fields (multi:false, e.g. troops.infantry) REPLACE on
// assign and clear to null on unassign — a player can only hold one tier
// per troop type, so moving them to a new value naturally drops them
// from wherever they were before (no separate "remove" step needed).

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

// Immutable nested set — clones only the objects along the path so
// unrelated nested fields (e.g. troops.lancer while writing troops.infantry)
// aren't accidentally shared/mutated.
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const clone = { ...obj };
  let cursor = clone;
  let source = obj;
  for (const k of keys) {
    source = source?.[k] || {};
    cursor[k] = { ...source };
    cursor = cursor[k];
  }
  cursor[last] = value;
  return clone;
}

export function getFieldValue(player, path) {
  return getPath(player, path);
}

// Every distinct value currently in use for this field across the roster,
// merged with the field's predefined option list. This is how "new
// options" work without any separate custom-values storage: once an
// officer assigns a brand-new value to even one player, it's "in use"
// and will show up as its own card on every future render.
export function getAllFieldValues(players, path, predefined, multi) {
  const inUse = new Set();
  players.forEach(p => {
    const v = getPath(p, path);
    if (multi) {
      (v || []).forEach(x => x && inUse.add(x));
    } else if (v) {
      inUse.add(v);
    }
  });
  const merged = [...predefined];
  inUse.forEach(v => { if (!merged.includes(v)) merged.push(v); });
  return merged;
}

export function getPlayersWithFieldValue(players, path, value, multi) {
  return players.filter(p => {
    const v = getPath(p, path);
    return multi ? (v || []).includes(value) : v === value;
  });
}

export function getFieldValueCounts(players, path, values, multi) {
  const counts = {};
  values.forEach(v => { counts[v] = 0; });
  players.forEach(p => {
    const v = getPath(p, path);
    if (multi) {
      (v || []).forEach(x => { if (x in counts) counts[x]++; });
    } else if (v != null && v in counts) {
      counts[v]++;
    }
  });
  return counts;
}

export function assignFieldValue(player, path, value, multi) {
  if (multi) {
    const current = getPath(player, path) || [];
    if (current.includes(value)) return player;
    return setPath(player, path, [...current, value]);
  }
  return setPath(player, path, value);
}

export function unassignFieldValue(player, path, value, multi) {
  if (multi) {
    const current = getPath(player, path) || [];
    return setPath(player, path, current.filter(v => v !== value));
  }
  return setPath(player, path, null);
}
