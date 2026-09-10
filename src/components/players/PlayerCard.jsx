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

        {/* Row 2.5 — role/capability labels (Rally Lead, Substitute Rally
            Lead, and any custom alliance roles). Helios status moved to
            a badge on the troop icon below instead of a text pill here —
            showing it in two places at once was redundant. */}
        {(player.roles?.length > 0 || player.leaderProfile?.role === 'substitute' || player.leaderProfile?.role === 'both') && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
            {(player.leaderProfile?.role === 'substitute' || player.leaderProfile?.role === 'both') && !player.roles?.includes('Rally Lead') && (
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:8, background:C.gold+'14', color:C.gold }}>Substitute Rally Lead</span>
            )}
            {player.roles?.map(r => (
              <span key={r} style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:8, background:r==='Rally Lead'?C.gold+'18':C.section, color:r==='Rally Lead'?C.gold:C.icy }}>{r}</span>
            ))}
          </div>
        )}

        {/* Rally leader hero/skill/widget detail intentionally removed
            from this card — it now lives only in ProfileView's
            per-player detail (opened by tapping the card), not inline
            on every list row. */}

        {/* Row 3 — troop tier notable states: Helios badge and/or level
            mismatch, kept as two INDEPENDENT signals that can coexist on
            one chip without merging:
              - Helios: a fact, never a warning. Small filled red square
                on the icon itself (matching the game's own hexagonal
                Helios badge language) — never amber, that color is
                reserved entirely for the mismatch case.
              - Mismatch: this troop's tier differs from the player's
                OTHER troops (NOT from furnace level — furnace and troop
                tier are different progression tracks that routinely
                differ even when nothing's wrong, which was exactly the
                noise/illegibility problem before this fix). This should
                be rare — most players keep their three troops in sync.
                Triggers amber background + amber text + a small ⚠ —
                visually distinct from the Helios square.
            A chip only renders at all when at least one of these two
            conditions is true; a troop that's neither Helios-tier nor
            mismatched shows nothing, same as before. */}
        {(() => {
          const troopEntries = [['🛡️','infantry',player.troops?.infantry,C.inf],['⚔️','lancer',player.troops?.lancer,C.lan],['🏹','marksman',player.troops?.marksman,C.mar]];
          const setVals = troopEntries.filter(([,,t]) => t).map(([,,t]) => t);
          const freq = {};
          setVals.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
          const maxFreq = setVals.length ? Math.max(...Object.values(freq)) : 0;
          // Flags the actual outlier(s), not everyone whenever ANY
          // difference exists — with < 2 set troops there's nothing to
          // compare; when nobody agrees at all (maxFreq === 1, e.g. all
          // three distinct), every one of them is equally "odd" and all
          // get flagged; otherwise only whoever's outside the majority.
          function isMismatch(t) {
            if (!t || setVals.length < 2) return false;
            if (maxFreq === 1) return true;
            return freq[t] < maxFreq;
          }
          const notable = troopEntries.filter(([,,t]) => t && (t.startsWith('Helios') || isMismatch(t)));
          if (notable.length === 0) return null;
          return (
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
              {notable.map(([icon, key, t, tc]) => {
                const helios = t.startsWith('Helios');
                const mismatch = isMismatch(t);
                return (
                  <span key={key} title={mismatch ? "Differs from this player's other troops" : undefined}
                    style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:8, background:mismatch?C.gold+'22':tc+'18', color:mismatch?C.gold:tc }}>
                    <span style={{ position:'relative', display:'inline-flex', width:14, height:14, alignItems:'center', justifyContent:'center' }}>
                      {icon}
                      {helios && <span style={{ position:'absolute', top:-2, right:-3, width:6, height:6, background:C.red, borderRadius:1.5 }}/>}
                    </span>
                    {t}
                    {mismatch && <span style={{ fontSize:10 }}>⚠</span>}
                  </span>
                );
              })}
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
