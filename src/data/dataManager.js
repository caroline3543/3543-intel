/**
 * dataManager.js
 *
 * Barrel file — re-exports all data functions so existing
 * import paths work unchanged.
 */

// Storage
export { saveToStorage as saveData, loadFromStorage as loadData, exportToFile as exportData, importFromFile as importData, mergeImportedData as mergeData } from '../services/exportImportService.js';

// Schemas
export { newPlayer, newEvent, newSnapshot, newSvsPlan, newRally, newReinforcement, newAssignment, newMarchEntry, newPrepEntry } from './playerSchema.js';

// Metrics
export { calcMetrics, autoSuggestPlayers } from './metrics.js';

// Matching / batch
export { normalizeName, nameSimilarity } from '../utils/normalize.js';
export { resolveBatchRows as resolveBatchNames, mergePlayerObjects } from '../services/batchAddService.js';

// Timing
export { calcSendTime, calcImpactTime, parseHMS, formatHMS, secsToHuman, getRallyWarnings, getCounterWarnings } from '../services/svsTimingService.js';

// Constants
export { EVENT_TYPES, STRATEGY_TYPES, TEAM_ROLES } from '../utils/constants.js';

// Joiner meta
export { JOINER_HEROES, JOINER_META, buildCoverageReport, getMetaSuggestion } from './joinerMeta.js';
