import { useState } from 'react';
import { C, FC_BADGE_IMAGES } from '../../utils/constants.js';
import { roleColor } from '../../utils/roles.js';
import { fmtDate } from '../../utils/dates.js';
import { calcMetrics } from '../../data/metrics.js';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal.jsx';

function initials(n) {
  return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
}

export function PlayerCard({ player, roles = [], onClick, onDelete, events, missingCount, troopPower, onToggleRallyLead, onOpenFields, bulkMode, isSelected }) {
  const dn      = player.username||player.alias||'Unknown';
  const rc      = roleColor(player.roles?.[0], roles);
  const metrics = calcMetrics(player, events||[]);
  const joiners = (player.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).map(jh=>jh.hero);
  const isRallyLead = player.roles?.includes('Rally Lead');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div onClick={onClick} style={{ background:isSelected?C.gold+'18':C.card, borderRadius:12, padding:'14px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12, cursor:'pointer', WebkitTapHighlightColor:'transparent', userSelect:'none', opacity:player.blacklisted?0.6:1, border:`1px solid ${isSelected?C.gold:C.border}`, boxShadow:'0 1px 3px rgba(0,0,0,0.35)' }}>

      {bulkMode && (
        <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${isSelected?C.gold:C.border}`, background:isSelected?C.gold:'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {isSelected && <span style={{ fontSize:13, color:C.bg, fontWeight:700 }}>✓</span>}
        </div>
      )}

      {/* Avatar */}
      <div style={{ width:46, height:46, borderRadius:'50%', flexShrink:0, background:rc+'33', border:`2px solid ${rc}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:17, color:C.white }}>
        {initials(dn)}
      </div>

      <div style={{ flex:1, minWidth:0 }}>

        {/* Row 1 — name + overall furnace badge together */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dn}</div>
          {player.furnaceLevel && (
            FC_BADGE_IMAGES[player.furnaceLevel] ? (
              <img src={FC_BADGE_IMAGES[player.furnaceLevel]} alt={player.furnaceLevel} title={player.furnaceLevel}
                style={{ width:22, height:22, flexShrink:0 }}/>
            ) : (
              <span style={{ fontSize:11, fontWeight:700, padding:'1px 7px', borderRadius:8, background:C.gold+'18', color:C.gold, flexShrink:0 }}>{player.furnaceLevel}</span>
            )
          )}
          {player.blacklisted && (
            <span title={player.blacklistReason || ''} style={{ fontSize:11, color:C.red, fontWeight:700, padding:'1px 7px', borderRadius:8, background:C.red+'18', flexShrink:0 }}>⚠ Blacklisted</span>
          )}
          {missingCount > 0 && (
            <button
              onClick={e => { e.stopPropagation(); onOpenFields?.(); }}
              title="Open Player Information"
              style={{ fontSize:11, color:C.gold, fontWeight:700, padding:'1px 7px', borderRadius:8, background:C.gold+'18', border:'none', flexShrink:0, cursor:'pointer', WebkitTapHighlightColor:'transparent' }}
            >⚠ {missingCount} missing</button>
          )}
        </div>

        {/* Row 2 — alliance · troop power · reliability (furnace moved up next to the name) */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
          {player.allianceTag && <span style={{ fontSize:12, color:C.icy, fontWeight:600 }}>[{player.allianceTag}]</span>}
          {troopPower != null && <span style={{ fontSize:12, color:C.gold, fontWeight:700 }}>💪 {troopPower.toLocaleString()}</span>}
          {player.country && <span style={{ fontSize:12, color:C.muted }}>{player.country}</span>}
          {metrics && (
            <span style={{ fontSize:11, fontWeight:700, marginLeft:'auto', color:metrics.reliabilityScore>=70?C.green:metrics.reliabilityScore>=40?C.gold:C.red }}>
              {metrics.reliabilityScore}pts
            </span>
          )}
        </div>

        {/* Row 2.5 — role/capability labels (Rally Lead, Substitute Rally Lead,
            Helios Infantry/Lancer/Marksman, and any custom alliance roles) */}
        {(player.roles?.length > 0 || player.leaderProfile?.role === 'substitute' || player.leaderProfile?.role === 'both') && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
            {(player.leaderProfile?.role === 'substitute' || player.leaderProfile?.role === 'both') && !player.roles?.includes('Rally Lead') && (
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:8, background:C.gold+'14', color:C.gold }}>Substitute Rally Lead</span>
            )}
            {player.roles?.map(r => (
              <span key={r} style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:8, background:r==='Rally Lead'?C.gold+'18':C.section, color:r==='Rally Lead'?C.gold:C.icy }}>{r}</span>
            ))}
            {['infantry','lancer','marksman'].filter(k => player.troops?.[k]?.startsWith('Helios')).map(k => (
              <span key={k} style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:8, background:C.section, color:k==='infantry'?C.inf:k==='lancer'?C.lan:C.mar }}>
                Helios {k.charAt(0).toUpperCase()+k.slice(1)}
              </span>
            ))}
          </div>
        )}

        {/* Rally leader hero/skill/widget detail intentionally removed
            from this card — it now lives only in ProfileView's
            per-player detail (opened by tapping the card), not inline
            on every list row. */}

        {/* Row 3 — troop tier mismatches. Own row, independent of
            joiner heroes below, so its presence/absence never shifts
            based on unrelated data. Only rendered at all when at least
            one troop DIFFERS from the overall furnace badge already
            shown by the name; omitted entirely otherwise — never shows
            three redundant matching icons. Each icon keeps its normal
            type color (shield/sword/bow) always; a mismatch adds a
            small gold dot rather than recoloring the whole chip, so
            the type-color coding is never erased by the warning state. */}
        {(() => {
          const troopEntries = [['🛡️','infantry',player.troops?.infantry,C.inf],['⚔️','lancer',player.troops?.lancer,C.lan],['🏹','marksman',player.troops?.marksman,C.mar]];
          const hasFurnace = !!player.furnaceLevel;
          const mismatches = hasFurnace ? troopEntries.filter(([,,t]) => t && t !== player.furnaceLevel) : [];
          if (!hasFurnace || mismatches.length === 0) return null;
          return (
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
              {mismatches.map(([icon, key, t, tc]) => (
                <span key={key} title={`Differs from overall furnace level (${player.furnaceLevel})`}
                  style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:8, background:tc+'18', color:tc }}>
                  {icon} {t}
                  <span style={{ width:6, height:6, borderRadius:'50%', background:C.gold, flexShrink:0 }}/>
                </span>
              ))}
            </div>
          );
        })()}

        {/* Row 4 — joiner heroes. Own row, always the same structure
            when present (first 2 heroes as pills, "+N heroes" beyond
            that); omitted entirely when there are none. */}
        {joiners.length > 0 && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {joiners.slice(0,2).map(h => (
              <span key={h} style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:8, background:C.gold+'18', color:C.gold }}>
                ✓ {h}
              </span>
            ))}
            {joiners.length>2 && <span style={{ fontSize:11, color:C.muted }}>+{joiners.length-2} heroes</span>}
          </div>
        )}

      </div>

      {!bulkMode && (
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          {/* One-tap Rally Lead toggle — no need to open the profile just
              to flag someone as a leader. NOTE: this toggles the "Rally
              Lead" role tag specifically, not Alliance Rank (R1-R5,
              a separate field with no card control yet) — the
              aria-label below describes what it actually does rather
              than the "Set alliance rank" wording from the original
              request, since the crown icon isn't tied to that field
              and a mismatched label would make screen-reader use worse,
              not better. Flagging this in case Alliance Rank should
              also get its own control here. */}
          <button
            onClick={e => { e.stopPropagation(); onToggleRallyLead?.(); }}
            title={isRallyLead ? 'Rally Lead — tap to remove' : 'Tap to make Rally Lead'}
            aria-label={isRallyLead ? 'Remove Rally Lead status' : 'Set as Rally Lead'}
            style={{ width:44, height:44, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:isRallyLead?C.gold+'22':'none', border:`1.5px solid ${isRallyLead?C.gold:C.border}`, color:isRallyLead?C.gold:C.muted+'88', fontSize:17, cursor:'pointer', flexShrink:0 }}
          >👑</button>

          {/* Overflow menu — a direct one-tap ✕ was too easy to hit by
              accident in a long list. ⋮ opens a small menu; the actual
              delete still requires confirming in DeleteConfirmModal. */}
          <div style={{ position:'relative', flexShrink:0 }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              aria-label="More options"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              style={{ width:44, height:44, borderRadius:10, background:menuOpen?C.section:'none', border:'none', color:C.muted, fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
            >⋮</button>
            {menuOpen && (
              <div style={{ position:'absolute', top:'100%', right:0, marginTop:4, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.5)', zIndex:20, overflow:'hidden', minWidth:160 }}>
                <button
                  onClick={() => { setMenuOpen(false); setConfirmingDelete(true); }}
                  style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'12px 14px', background:'none', border:'none', color:C.red, fontSize:14, fontWeight:600, cursor:'pointer', textAlign:'left', whiteSpace:'nowrap' }}
                >🗑 Remove player</button>
              </div>
            )}
          </div>

          {confirmingDelete && (
            <DeleteConfirmModal
              message={`Remove ${dn} from the roster? This cannot be undone.`}
              onConfirm={() => { setConfirmingDelete(false); onDelete(player.id); }}
              onCancel={() => setConfirmingDelete(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
