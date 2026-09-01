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
    teamAssignment:     null,
    notes:              '',
    profileLastUpdated: null,
    createdAt:          Date.now(),
    eventHistory:       [],
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
