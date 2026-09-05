import { uid } from '../utils/dates.js';

export function newPlayer(overrides = {}) {
  return {
    id:                 uid(),
    fid:                '',
    username:           '',
    alias:              '',
    allianceTag:        '',
    country:            '',
    timezone:           '',
    languages:          [],
    furnaceLevel:       null,
    infantryCampLevel:  null,
    lancerCampLevel:    null,
    marksmanCampLevel:  null,
    troops: {
      infantry:  null,
      lancer:    null,
      marksman:  null,
    },
    // Single source of truth for joiner heroes
    joinerHeroes:       [],   // [{ hero, skillLevel, verified, updatedAt }]
    roles:              [],
    allianceRank:       null, // 'R5'|'R4'|'R3'|'R2'|'R1'|null — mutually exclusive, unlike roles (which are multi-select)
    teamAssignment:     null,
    blacklisted:        false, // excludes from Battle Plan leader/joiner selection — roster entry and history are kept, not hidden
    blacklistReason:    '',
    notes:              '',
    profileLastUpdated: null,
    createdAt:          Date.now(),
    eventHistory:       [],
    leaderProfile:      newLeaderProfile(),
    ...overrides,
  };
}

/**
 * One reusable "Rally Leader Profile" per player — separate from the
 * roster's "Rally Lead" role tag (which is just a quick filter/badge).
 * `role` here is the formal designation this spec asks for; a player
 * can be a Leader, Substitute, Both, or Neither independent of whether
 * they also happen to have the "Rally Lead" role tag on their roster
 * profile — the two are related but not the same field, and existing
 * Rally Leader picker grouping in RallySlotCard.jsx is untouched.
 */
export function newLeaderProfile(overrides = {}) {
  return {
    role:      'none', // 'leader' | 'substitute' | 'both' | 'none'
    teams:     [],      // newLeaderTeam()[]
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * One "team" = a saved offense or defense rally setup for a specific
 * leader: the 3 heroes THEY use to lead with (deliberately separate
 * from Priority Joiner Heroes — see battleConstants.js's
 * LEADER_HERO_OPTIONS vs CUSTOM_HERO_OPTIONS), a widget count (0–10)
 * per lead hero, their preferred ratio, and their recommended 4
 * priority joiner heroes. A profile starts with zero teams; more can
 * be added later (roughly 1–2 per offense/defense, not hard-capped).
 */
export function newLeaderTeam(overrides = {}) {
  return {
    id:                   uid(),
    type:                 'offense', // 'offense' | 'defense'
    leadHeroes:           ['', '', ''],
    widgets:              {},        // { [heroName]: 0-10 }
    ratio:                '',
    priorityJoinerHeroes: ['', '', '', ''],
    notes:                '',
    updatedAt:            new Date().toISOString(),
    ...overrides,
  };
}

export function newEvent(overrides = {}) {
  return {
    id:             uid(),
    type:           'SvS Castle Battle',
    name:           '',
    allianceTag:    '',
    date:           new Date().toISOString().slice(0, 10),
    time:           '12:00',
    status:         'upcoming',
    // 1 | 2 | null — Foundry/Canyon Clash run as two separate same-day
    // events (see TROOP_POWER_EVENTS in constants.js), so this lives on
    // the event itself, set once at creation in EventSheet.jsx — not a
    // per-participant tag inside the roster (that's what it used to be,
    // on the snapshot; moved here since the events are the thing that's
    // actually split, not the people in them).
    legion:         null,
    participantIds: [],
    notes:          '',
    createdAt:      new Date().toISOString(),
    updatedAt:      new Date().toISOString(),
    snapshots:      [],
    ...overrides,
  };
}

export function newSnapshot(playerId, playerProfile, eventId) {
  return {
    snapshotId:  uid(),
    eventId,
    playerId,
    createdAt:   new Date().toISOString(),
    profileSnapshot: {
      username:     playerProfile.username     || '',
      alias:        playerProfile.alias        || '',
      allianceTag:  playerProfile.allianceTag  || '',
      furnaceLevel: playerProfile.furnaceLevel || null,
      troops:       { ...(playerProfile.troops || {}) },
      roles:        [...(playerProfile.roles || [])],
      joinerHeroes: [...(playerProfile.joinerHeroes || [])],
    },
    // Pre-event RSVP — set while the event is still upcoming. Never
    // used for reliabilityScore (see metrics.js) — only a prediction.
    // Note: there is no separate "participating" toggle in the UI —
    // being added to the event's participantIds at all IS the
    // participation signal, set automatically on add (see
    // EventsTab.jsx). `participating` itself still exists here because
    // Battle Plan's isAttending() (battleConstants.js) reads it as the
    // hard eligibility filter for Rally Leader/Priority Joiner picks.
    rsvp: {
      participating:    false,
      onTime:           false,
      willBeLate:       false,
      willLeaveEarly:   false,
      willJoinDiscord:  false,
      presentWholeTime: false,
      substitute:       false,
    },
    // Post-event actuals — set after the event has happened. This is
    // the ONLY data reliabilityScore is computed from.
    attendance: {
      attended:           null,
      noShow:             false,
      excused:            false, // only meaningful when noShow is true — a sanctioned absence, not a discipline flag
      joinedLateNoNotice: false,
    },
    voice: {
      joined: false,
    },
    // Set only for Foundry/Canyon Clash events (see TROOP_POWER_EVENTS
    // in constants.js) — shown next to the player's name in that
    // event's participant list, and charted over time in ProfileView.
    troopPower: null,
    notes: '',
  };
}

export function newSvsPlan(overrides = {}) {
  return {
    id:              uid(),
    name:            '',
    allianceTag:     '',
    date:            new Date().toISOString().slice(0, 10),
    status:          'draft',
    notes:           '',
    postBattleNotes: '',
    eventId:         null,   // links this plan to a tracked Event — required before joiner/leader eligibility can be shown (see battleConstants.js's isAttending)
    checklist:       {},     // { [checklistItemId]: boolean } — per-plan checked state against the alliance-wide Leadership Checklist (see utils/checklist.js)
    rallySlots:      [],   // new structure — replaces rallies/reinforcements
    createdAt:       new Date().toISOString(),
    updatedAt:       new Date().toISOString(),
    ...overrides,
  };
}

export function newRallySlot(overrides = {}) {
  return {
    id:           uid(),
    type:         'Main Rally',
    allianceTag:  null,     // restricts leader + joiner eligibility to this alliance only, if set
    target:       null,     // 'turret' | 'castle' | null — SvS/Castle Battle events only (see JOINER_COVERAGE_EVENTS in constants.js); which structure this rally is aimed at
    leaderId:     null,
    leaderName:   '',
    rallyDuration: 3,
    ratio:        '60/40/0',
    troopReqs:    { infantry:null, lancer:null, marksman:null },
    leaderRallyHeroes: [],  // heroes the rally leader uses to lead (e.g. Jeronimo, Mia, Greg)
    requestedHeroes: [],
    joiners:      [newJoinerSlot(), newJoinerSlot(), newJoinerSlot(), newJoinerSlot()],
    notes:        '',
    testRallies:  [],       // real-battle results logged against this formation — see newTestRallyEntry
    ...overrides,
  };
}

/**
 * A single logged real-battle result against a formation — who the
 * leader fought, what the enemy's ratio/heroes/joiners were, and the
 * outcome. Builds real data over time for formations flagged as
 * unverified in joinerMeta.js.
 */
export function newTestRallyEntry(overrides = {}) {
  return {
    id:           uid(),
    opponent:     '',   // who they went against
    enemyRatio:   '',
    enemyHeroes:  '',
    enemyJoiners: '',
    result:       '',   // free text — win/loss, points, whatever the leader wants to note
    notes:        '',
    createdAt:    new Date().toISOString(),
    ...overrides,
  };
}

export function newJoinerSlot(overrides = {}) {
  return {
    id:        uid(),
    playerId:  null,
    playerName:'',
    heroName:  '',     // specific hero they must bring
    confirmed: false,  // marked unavailable mid-battle
    replacedBy:null,   // { playerId, playerName, heroName } if swapped
    ...overrides,
  };
}

// Legacy schemas kept for backward compat
export function newRally(overrides = {}) {
  return {
    id: uid(), label:'', leadPlayerId:null, leadName:'', allianceTag:'',
    launchTime:'', marchDuration:0, impactTime:'', isStrong:true,
    isCounter:false, isDecoy:false, order:1, notes:'', status:'planned',
    ...overrides,
  };
}

export function newReinforcement(overrides = {}) {
  return {
    id:                uid(),
    playerId:          null,
    playerName:        '',
    allianceTag:       '',
    targetArrivalTime: '',
    marchDuration:     0,
    sendTime:          '',
    arrivalWindow:     5,
    status:            'pending',
    notes:             '',
    ...overrides,
  };
}

export function newAssignment(overrides = {}) {
  return {
    id:          uid(),
    playerId:    null,
    playerName:  '',
    allianceTag: '',
    teamRole:    '',
    marchTime:   null,
    confirmed:   false,
    notes:       '',
    ...overrides,
  };
}

export function newMarchEntry(overrides = {}) {
  return {
    id:           uid(),
    playerId:     null,
    playerName:   '',
    castleMarch:  null,
    turretMarch:  null,
    centerMarch:  null,
    usesSpeedup:  false,
    teleportRow:  null,
    notes:        '',
    ...overrides,
  };
}

export function newPrepEntry(overrides = {}) {
  return {
    id:           uid(),
    playerId:     null,
    playerName:   '',
    allianceTag:  '',
    prepScore:    null,
    targetScore:  null,
    lastUpdated:  new Date().toISOString(),
    notes:        '',
    history:      [],
    ...overrides,
  };
}
