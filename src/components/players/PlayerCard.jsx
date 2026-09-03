import { C } from '../../utils/constants.js';
import { roleColor } from '../../utils/roles.js';
import { fmtDate } from '../../utils/dates.js';
import { calcMetrics } from '../../data/metrics.js';

function initials(n) {
  return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
}

export function PlayerCard({ player, roles = [], onClick, onDelete, events, missingCount, troopPower, onToggleRallyLead, onOpenFields }) {
  const dn      = player.username||player.alias||'Unknown';
  const rc      = roleColor(player.roles?.[0], roles);
  const metrics = calcMetrics(player, events||[]);
  const joiners = (player.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).map(jh=>jh.hero);
  const isRallyLead = player.roles?.includes('Rally Lead');

  return (
    <div onClick={onClick} style={{ background:C.card, borderRadius:12, padding:'14px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12, cursor:'pointer', WebkitTapHighlightColor:'transparent', userSelect:'none', opacity:player.blacklisted?0.6:1 }}>

      {/* Avatar */}
      <div style={{ width:46, height:46, borderRadius:'50%', flexShrink:0, background:rc+'33', border:`2px solid ${rc}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:17, color:C.white }}>
        {initials(dn)}
      </div>

      <div style={{ flex:1, minWidth:0 }}>

        {/* Row 1 — name */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dn}</div>
          {player.blacklisted && (
            <span title={player.blacklistReason || ''} style={{ fontSize:11, color:C.red, fontWeight:700, padding:'1px 7px', borderRadius:8, background:C.red+'18', flexShrink:0 }}>⚠ Blacklisted</span>
          )}
          {missingCount > 0 && (
            <button
              onClick={e => { e.stopPropagation(); onOpenFields?.(); }}
              title="Open Field Registry"
              style={{ fontSize:11, color:C.gold, fontWeight:700, padding:'1px 7px', borderRadius:8, background:C.gold+'18', border:'none', flexShrink:0, cursor:'pointer', WebkitTapHighlightColor:'transparent' }}
            >⚠ {missingCount} missing</button>
          )}
        </div>

        {/* Row 2 — alliance · furnace · troop power · reliability */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
          {player.allianceTag && <span style={{ fontSize:12, color:C.icy, fontWeight:600 }}>[{player.allianceTag}]</span>}
          {player.furnaceLevel && <span style={{ fontSize:12, color:C.gold, fontWeight:700 }}>{player.furnaceLevel}</span>}
          {troopPower != null && <span style={{ fontSize:12, color:C.gold, fontWeight:700 }}>💪 {troopPower.toLocaleString()}</span>}
          {player.country && <span style={{ fontSize:12, color:C.muted }}>{player.country}</span>}
          {metrics && (
            <span style={{ fontSize:11, fontWeight:700, marginLeft:'auto', color:metrics.reliabilityScore>=70?C.green:metrics.reliabilityScore>=40?C.gold:C.red }}>
              {metrics.reliabilityScore}pts
            </span>
          )}
        </div>

        {/* Row 3 — troops + joiner heroes (secondary info) */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {[['🛡️',player.troops?.infantry,C.inf],['⚔️',player.troops?.lancer,C.lan],['🏹',player.troops?.marksman,C.mar]].map(([i,t,c],idx) => (
            <span key={idx} style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:8, background:(t?c:C.muted)+'18', color:t?c:C.muted }}>
              {i} {t||'—'}
            </span>
          ))}
          {joiners.slice(0,2).map(h => (
            <span key={h} style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:8, background:C.gold+'18', color:C.gold }}>
              ✓ {h}
            </span>
          ))}
          {joiners.length>2 && <span style={{ fontSize:11, color:C.muted }}>+{joiners.length-2} heroes</span>}
        </div>

      </div>

      {/* One-tap Rally Lead toggle — no need to open the profile just
          to flag someone as a leader */}
      <button
        onClick={e => { e.stopPropagation(); onToggleRallyLead?.(); }}
        title={isRallyLead ? 'Rally Lead — tap to remove' : 'Tap to make Rally Lead'}
        style={{ width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:isRallyLead?C.gold+'22':'none', border:`1.5px solid ${isRallyLead?C.gold:C.border}`, color:isRallyLead?C.gold:C.muted+'88', fontSize:16, cursor:'pointer', flexShrink:0 }}
      >👑</button>

      {/* Delete */}
      <button
        onClick={e=>{e.stopPropagation();onDelete(player.id);}}
        style={{ background:'none', border:'none', color:C.red+'66', fontSize:20, cursor:'pointer', padding:'8px 4px', flexShrink:0, lineHeight:1 }}
      >✕</button>
    </div>
  );
}
