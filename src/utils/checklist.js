import { uid } from './dates.js';

// ── checklist ──────────────────────────────────────────────────
// Alliance-wide Leadership Checklist items, mirroring roles.js's
// pattern exactly: a flat custom list, created/renamed/reordered/
// deleted by the alliance (see ChecklistManagerSheet.jsx). Unlike
// roles, no item is builtin — the list starts empty, same as custom
// roles do.
//
// Per-plan checked/unchecked state does NOT live here — it's stored
// directly on each plan (plan.checklist, an { [itemId]: boolean } map,
// see playerSchema.js's newSvsPlan). This file only defines the shared
// item list itself.

export function newChecklistItemDef(name) {
  return {
    id:        uid(),
    name:      name.trim(),
    updatedAt: new Date().toISOString(),
  };
}
