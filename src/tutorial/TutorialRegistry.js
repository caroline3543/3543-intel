/**
 * TutorialRegistry
 *
 * All tutorial steps are defined here.
 * Add new features by adding entries to the relevant mode array.
 * App.jsx and TutorialOverlay read from this file.
 */

export const TUTORIAL_STEPS = {
  beginner: [
    {
      id: 'welcome',
      title: 'Welcome to Sunfire Command',
      body: 'Your command center for Whiteout Survival SvS. Manage your roster, coordinate battle plans, track attendance, and analyze performance — all from your phone.',
      why: 'Alliance coordination without a central tool leads to missed rallies, wrong timing, and confusion.',
      how: 'Use this app before and during every SvS. Officers update it in real time.',
      when: 'Set up your roster before the season starts.',
    },
    {
      id: 'roster',
      title: '👥 Roster — Your Player Database',
      body: 'Add every player in your alliance. Each profile stores username, troop tiers, joiner heroes, role, and availability.',
      why: "Knowing your players' stats lets you assign the right people to the right jobs.",
      how: 'Tap ＋ to add a player, or use ⚡ Batch Add to add many at once.',
      when: 'Build your roster before every SvS. Update it when players upgrade.',
    },
    {
      id: 'batch',
      title: '⚡ Batch Add — Fast Roster Entry',
      body: 'Paste a list of names and the app walks you through tiers, heroes, and availability for all of them. Detects duplicates automatically.',
      why: 'Entering players one by one is slow. Batch Add gets your roster ready in minutes.',
      how: 'Tap ⚡ Batch → type or paste names → review → set tiers and heroes.',
      when: 'Before each SvS to register who\'s participating.',
    },
    {
      id: 'battle',
      title: '⚔️ Battle — Strategy Planning',
      body: 'Build battle plans, add rallies and reinforcements, assign teams, and run Live Mode during the battle with large countdowns.',
      why: 'Uncoordinated rallies waste power. Plans ensure everyone knows their role.',
      how: 'Tap Battle → New Battle Plan → add rallies and reinforcements.',
      when: 'Build the plan 30 minutes before SvS. Switch to Live Mode at start.',
    },
    {
      id: 'events',
      title: '📋 Events — Track Every Battle',
      body: 'Create an event for each SvS, Foundry, or Canyon Clash. Track who attended, who was on Discord, who performed well, and who no-showed.',
      why: 'Tracking events builds historical data for rewarding reliable players.',
      how: 'Events → New Event → fill in details → track players during the event.',
      when: 'Create before it starts. Mark attendance during the battle.',
    },
    {
      id: 'scores',
      title: '📈 Scores — Prep Score Tracking',
      body: "Track each player's SvS prep score, target, and progress. Batch update by pasting a list. History is saved on each update.",
      why: 'Prep scores determine event eligibility. Tracking them helps enforce requirements.',
      how: 'Scores → Add or Batch → paste Name, Alliance, Score, Target per line.',
      when: 'After the prep tracking deadline each season.',
    },
    {
      id: 'intel',
      title: '📊 Intel — Alliance Performance',
      body: 'Reliability scores, attendance leaderboard, at-risk players, joiner hero coverage, and the Rally Joiner Registry all live here.',
      why: 'Data helps leaders make fair decisions about roles, rewards, and roster management.',
      how: 'Review Intel after each SvS. Check leaderboard before assigning rally leads.',
      when: 'After each event and before each season.',
    },
    {
      id: 'export',
      title: '📦 Export Your Data',
      body: 'Tap 📦 in the top right to download all your data as a JSON file. Import it back later or share with another officer.',
      why: 'Backups protect your work. Sharing keeps officers in sync.',
      how: 'Tap 📦 → Download JSON. Keep the file safe.',
      when: 'After building your roster. After each major event.',
    },
  ],

  advanced: [
    {
      id: 'counter',
      title: '⚔️ Counter Rally Planning',
      body: 'After the enemy rally launches, mark their impact time and calculate when your counter must launch to land seconds after.',
      why: 'A counter too early gets blocked. Too late and the enemy reinforces.',
      how: 'Battle → plan → Counter Rally strategy → add enemy rally → add counter → check warnings.',
      when: 'The moment an enemy rally is spotted.',
    },
    {
      id: 'warnings',
      title: 'Rally Sync Warnings',
      body: 'The app automatically warns when rallies are >10s apart, when the strongest rally arrives first, or when a counter is mistimed.',
      why: 'Sync failures let the enemy reinforce between your rallies.',
      how: 'Warnings appear in red at the top of your plan automatically.',
      when: 'Check before marking a plan Live.',
    },
    {
      id: 'reinf',
      title: '🏰 Reinforcement Calculator',
      body: 'Enter target arrival time and march duration — the app calculates exact send time. Example: target 12:00:00, march 40s → send at 11:59:20.',
      why: 'Wrong reinforcement timing blocks your solo attacker.',
      how: 'Battle → plan → Reinforcements tab → fill in each row.',
      when: 'During castle switch planning.',
    },
    {
      id: 'live',
      title: '🔴 Live Battle Mode',
      body: 'Large countdown to target impact. One-tap buttons to confirm each rally launched, each reinforcement sent, each team confirmed.',
      why: 'During battle you need speed. Live Mode removes all clutter.',
      how: 'Battle → open plan → tap Live Mode.',
      when: 'The moment SvS starts.',
    },
    {
      id: 'registry',
      title: '🦸 Rally Joiner Registry',
      body: 'Track who owns each joiner hero at Skill 5. View coverage gaps, check for stacking, and get meta formation recommendations by generation.',
      why: 'Joiner hero data is essential for correct team assignments.',
      how: 'Intel → Rally Joiner Registry → tap a hero card to see owners or add players.',
      when: 'Before each SvS. After any hero events.',
    },
    {
      id: 'suggest',
      title: '⚡ Auto-Suggest Assignments',
      body: 'Filter by required heroes, Discord, furnace level, reliability — the app ranks your players by suitability and lets you assign them directly.',
      why: 'Picking teams from memory misses better candidates.',
      how: 'Battle → open plan → Auto-Suggest → set filters → assign from results.',
      when: 'Building teams 1–2 hours before SvS.',
    },
  ],

  discovery: [
    {
      id: 'registry2',
      title: '🆕 Rally Joiner Registry',
      body: 'Replaces the old Hero Ownership entry. Track joiner heroes by generation, check coverage gaps, stacking warnings, and meta tables.',
      why: "The old system didn't connect hero data to team planning. This one does.",
      how: 'Intel → Rally Joiner Registry.',
      when: 'Any time hero data changes.',
    },
    {
      id: 'modular',
      title: '🆕 Modular Architecture',
      body: 'The app has been refactored into focused modules. Services, components, and data are now separated so each feature is easier to update independently.',
      why: 'Large monolithic files made bugs hard to isolate and features hard to add.',
      how: 'No change to how you use the app.',
      when: 'Ongoing — future updates will be faster and safer.',
    },
  ],
};
