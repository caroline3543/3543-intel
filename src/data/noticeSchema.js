import { uid } from '../utils/dates.js';

export const NOTICE_CATEGORIES = ['Notice', 'To-Do', 'Info'];

export function newNotice(overrides = {}) {
  return {
    id:         uid(),
    title:      '',
    category:   'Notice', // 'Notice' | 'To-Do' | 'Info'
    body:       '',       // the actual message — this is what gets copied as a code block
    tags:       [],        // free-form, e.g. ['SvS', 'Foundry'] — searchable, not filtered by chip in v1
    // Every date this notice was actually copied-to-post. This history
    // (cross-referenced against settings.cycleAnchorDate) is the WHOLE
    // learning mechanism — nobody tags a notice "this belongs on day
    // 3", the app just watches when it actually gets used.
    postedDates: [],
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
    ...overrides,
  };
}
