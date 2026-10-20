import { uid } from '../utils/dates.js';

export const NOTICE_CATEGORIES = ['Notice', 'To-Do', 'Info'];

// Only "Notice" has a real in-game limit (alliance notices cap at 300
// characters) — To-Do and Info aren't posted through that surface, so
// they're left uncapped.
export const NOTICE_CHAR_LIMIT = 300;
export const NOTICE_CHAR_LIMIT_CATEGORY = 'Notice';

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
    // To-Do only — a real, sticky completion flag. Notice/Info instead
    // derive "checked" from postedDates including today (see
    // noticeCycleService.js's postedToday) — checking one of those off
    // means "I posted this today", which naturally un-checks itself
    // tomorrow with no separate reset needed.
    completed: false,
    // Manual multi-part linking, for a message too long for the 300
    // char limit — every part shares the same linkedGroupId and has
    // its own linkedPartLabel ("Part 1", "Part 2"...). Officer-
    // authored, not auto-split.
    linkedGroupId:   null,
    linkedPartLabel: '',
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
    ...overrides,
  };
}
