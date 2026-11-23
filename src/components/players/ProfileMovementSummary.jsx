import { C } from '../../utils/constants.js';
import { ProfileSection } from './ProfileParts.jsx';

// Only show recorded changes. An unsuccessful API lookup is not movement evidence.
export function ProfileMovementSummary({ player }) {
  const movements = (player.allianceHistory || [])
    .filter(entry => entry && entry.from !== entry.to)
    .sort((a, b) => {
      const aTime = Date.parse(a.at || '');
      const bTime = Date.parse(b.at || '');
      return (Number.isFinite(bTime) ? bTime : -Infinity) - (Number.isFinite(aTime) ? aTime : -Infinity);
    })
    .slice(0, 4);
  return <ProfileSection title="Alliance movements">
    {movements.length === 0
      ? <p style={{ fontSize: 13, color: C.icy, margin: 0 }}>No confirmed alliance movements recorded.</p>
      : movements.map((movement, index) => <div key={movement.id || `${movement.at || 'unknown'}:${index}`}
          style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, color: C.white, overflowWrap: 'anywhere' }}>
            {movement.from || 'No alliance'} → {movement.to || 'No alliance'}
          </span>
          <time dateTime={movement.at || undefined} style={{ fontSize: 12, color: C.icy, whiteSpace: 'nowrap' }}>
            {movement.at && Number.isFinite(Date.parse(movement.at))
              ? new Date(movement.at).toLocaleDateString()
              : 'Date unknown'}
          </time>
        </div>)}
  </ProfileSection>;
}
