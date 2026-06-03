/**
 * svsTimingService
 * All timing functions work in seconds or HH:MM:SS strings.
 */

export function parseHMS(hms) {
  if (!hms) return 0;
  const parts = hms.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(hms) || 0;
}

export function formatHMS(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function secsToHuman(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}

/**
 * Calculate exact send time given a target arrival and march duration.
 * targetArrivalHMS: "HH:MM:SS"
 * marchSeconds: number
 */
export function calcSendTime(targetArrivalHMS, marchSeconds) {
  const secs = parseHMS(targetArrivalHMS) - marchSeconds;
  return formatHMS(Math.max(0, secs));
}

/**
 * Calculate impact time given a launch time and march duration.
 */
export function calcImpactTime(launchHMS, marchSeconds) {
  return formatHMS(parseHMS(launchHMS) + marchSeconds);
}

/**
 * Recalculate impact times on all rallies that have launchTime + marchDuration.
 */
export function recalcRallies(rallies) {
  return rallies.map(r => {
    if (r.launchTime && r.marchDuration > 0) {
      return { ...r, impactTime: calcImpactTime(r.launchTime, r.marchDuration) };
    }
    return r;
  });
}

/**
 * Recalculate send times on all reinforcements.
 */
export function recalcReinforcements(reinfs) {
  return reinfs.map(r => {
    if (r.targetArrivalTime && r.marchDuration > 0) {
      return { ...r, sendTime: calcSendTime(r.targetArrivalTime, r.marchDuration) };
    }
    return r;
  });
}

/**
 * Detect rally synchronization issues.
 * Returns array of warning strings.
 */
export function getRallyWarnings(rallies) {
  const warnings = [];
  if (rallies.length < 2) return warnings;

  const impacts = rallies
    .filter(r => r.impactTime)
    .map(r => ({ ...r, secs: parseHMS(r.impactTime) }))
    .sort((a, b) => a.secs - b.secs);

  if (impacts.length > 1) {
    const spread = impacts[impacts.length - 1].secs - impacts[0].secs;
    if (spread > 10) warnings.push(`Rallies spread ${spread}s apart — may not land together`);
    if (spread > 30) warnings.push('⚠️ Severe sync issue — rallies >30s apart');
  }

  const strong = impacts.find(r => r.isStrong);
  if (strong && impacts[0]?.id !== strong.id) {
    warnings.push('⚠️ Strongest rally not arriving last — enemy may reinforce');
  }

  return warnings;
}

/**
 * Detect counter rally timing issues.
 */
export function getCounterWarnings(enemyImpactHMS, counterImpactHMS) {
  const warnings = [];
  if (!enemyImpactHMS || !counterImpactHMS) return warnings;
  const diff = parseHMS(counterImpactHMS) - parseHMS(enemyImpactHMS);
  if (diff < 0)              warnings.push('⚠️ Counter arrives BEFORE enemy impact — will be blocked');
  if (diff >= 0 && diff < 3) warnings.push(`Counter arrives ${diff}s after enemy — very tight`);
  if (diff > 10)             warnings.push(`⚠️ Counter arrives ${diff}s late — enemy may reinforce castle`);
  return warnings;
}

/**
 * Detect stacking (same hero used 3+ times in a joiner list).
 */
export function detectStacking(joinerList) {
  const counts = {};
  joinerList.forEach(h => { if (h) counts[h] = (counts[h] || 0) + 1; });
  return Object.entries(counts)
    .filter(([, n]) => n >= 3)
    .map(([hero, count]) => ({ hero, count, risk: count >= 4 ? 'high' : 'medium' }));
}
