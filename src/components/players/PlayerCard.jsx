import { useState } from 'react';
import { C, FC_BADGE_IMAGES, FC_OPTIONS } from '../../utils/constants.js';
import { roleColor } from '../../utils/roles.js';
import { fmtDate } from '../../utils/dates.js';
import { calcMetrics } from '../../data/metrics.js';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal.jsx';

function initials(n) {
  return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
}

// Troop-type colors for THIS card specifically — red/lancer/green/
// marksman/blue, per explicit request. NOTE: this is intentionally
// scoped to the member card only, not the shared C.inf/C.lan/C.mar
// tokens in constants.js — those are still used elsewhere (Battle
// Plans, Profile view) that aren't part of this pass, so changing them
// globally would create a mismatch there instead of here. Flagging
// that this card and those other screens now use different colors for
// the same troop types, in case that inconsistency needs resolving.
const TROOP_COLORS = { infantry: C.red, lancer: C.green, marksman: C.blue };

// Highest Helios stage a player has reached in ANY troop, ascending —
// used only to detect "has Helios at all", not to rank by stage.
function isFullyMatchedHelios(troops) {
  const set = troops.filter(Boolean);
  return set.length === 3 && set.every(t => t.startsWith('Helios')) && set.every(t => t === set[0]);
}

// Priority tier: 1 = all three troops Helios AND all the same stage
// (no internal mismatch) — the strongest, most "ready" players. 2 =
// has Helios somewhere but not fully matched (partially upgraded). 3 =
// no Helios at all. Exported so RosterTab's Priority sort uses the
// exact same definition as the badge shown here — one source of truth
// instead of two definitions that could drift apart.
export function getPriorityTier(player) {
  const troops = [player.troops?.infantry, player.troops?.lancer, player.troops?.marksman];
  const heliosCount = troops.filter(t => t && t.startsWith('Helios')).length;
  if (heliosCount === 0) return 3;
  if (isFullyMatchedHelios(troops)) return 1;
  return 2;
}

// "Fully upgraded" here means the player's three troops don't
// internally mismatch (same definition as the mismatch flag below) —
// used as the tiebreak within a priority tier / furnace level, per the
// "fully-upgraded ranked above partially-upgraded" requirement.
function isFullyUpgraded(player) {
  const set = [player.troops?.infantry, player.troops?.lancer, player.troops?.marksman].filter(Boolean);
  if (set.length < 2) return true;
  return set.every(t => t === set[0]);
}

// FC_OPTIONS is defined highest-first in constants.js, so a lower
// index means a HIGHER furnace level — this rank is used directly as
// a sort key (lower = better), not inverted.
function furnaceRank(fc) {
  const i = FC_OPTIONS.indexOf(fc);
  return i === -1 ? FC_OPTIONS.length : i; // unset/unknown sorts last
}

// Full sort key for the Priority sort option in RosterTab — tier
// first (1 before 2 before 3), then furnace level (higher first),
// then fully-upgraded before partially-upgraded at the same level,
// then name as the final tiebreak.
export function prioritySortKey(player) {
  return {
    tier: getPriorityTier(player),
    furnaceRank: furnaceRank(player.furnaceLevel),
    upgradeGap: isFullyUpgraded(player) ? 0 : 1,
  };
}

export function comparePriority(a, b) {
  const ka = prioritySortKey(a), kb = prioritySortKey(b);
  if (ka.tier !== kb.tier) return ka.tier - kb.tier;
  if (ka.furnaceRank !== kb.furnaceRank) return ka.furnaceRank - kb.furnaceRank;
  if (ka.upgradeGap !== kb.upgradeGap) return ka.upgradeGap - kb.upgradeGap;
  return (a.username || a.alias || '').localeCompare(b.username || b.alias || '');
}

// Tabler Icons webfont (see index.html for the CDN <link>) — renders as
// a glyph that inherits `color` via CSS, so every state (default,
// Helios, mismatch) can be tinted in code instead of being locked to
// whatever the OS's built-in emoji artwork looks like.
function Icon({ name, size = 14, color, style }) {
  return <i className={`ti ti-${name}`} style={{ fontSize:size, color, lineHeight:1, display:'inline-block', ...style }} aria-hidden="true"/>;
}

export function PlayerCard({ player, roles = [], onClick, onDelete, events, missingCount, troopPower, onToggleRallyLead, onOpenFields, bulkMode, isSelected }) {
  const dn      = player.username||player.alias||'Unknown';
  const rc      = roleColor(player.roles?.[0], roles);
  const metrics = calcMetrics(player, events||[]);
  const joiners = (player.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).map(jh=>jh.hero);
  const isRallyLead = player.roles?.includes('Rally Lead');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [joinersOpen, setJoinersOpen] = useState(false);
  const priorityTier = getPriorityTier(player);

  return (
    <div onClick={onClick} style={{ background:isSelected?C.gold+'18':C.card, borderRadius:12, padding:'14px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12, cursor:'pointer', WebkitTapHighlightColor:'transparent', userSelect:'none', opacity:player.blacklisted?0.6:1, border:`1px solid ${isSelected?C.gold:C.border}`, boxShadow:'0 1px 3px rgba(0,0,0,0.35)' }}>

      {bulkMode && (
        <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${isSelected?C.gold:C.border}`, background:isSelected?C.gold:'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {isSelected && <span style={{ fontSize:13, color:C.bg, fontWeight:700 }}>✓</span>}
        </div>
      )}

      {/* Avatar */}
      <div style={{ position:'relative', flexShrink:0 }}>
        <div style={{ width:46, height:46, borderRadius:'50%', background:rc+'33', border:`2px solid ${rc}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:17, color:C.white }}>
          {initials(dn)}
        </div>
        {/* Joiner-hero indicator — supplementary info, not a headline
            element: a small neutral icon badge on the avatar corner
            instead of a row of gold pills competing with FC/troop
            data. Tap reveals which heroes without leaving the list. */}
        {joiners.length > 0 && (
          <div style={{ position:'absolute', bottom:-2, right:-2 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setJoinersOpen(v => !v)} aria-label={`Joiner heroes: ${joiners.join(', ')}`}
              style={{ width:18, height:18, borderRadius:'50%', background:C.muted, border:`2px solid ${C.card}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}>
              <Icon name="check" size={10} color={C.white}/>
            </button>
            {joinersOpen && (
              <div style={{ position:'absolute', top:'100%', left:0, marginTop:4, background:C.section, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 10px', zIndex:20, whiteSpace:'nowrap', boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize:10, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Joiner Heroes</div>
                {joiners.map(h => <div key={h} style={{ fontSize:12, color:C.white }}>{h}</div>)}
              </div>
            )}
          </div>
        )}
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
          {priorityTier === 1 && (
            <span title="Fully Helios-matched — top priority" style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:11, fontWeight:700, padding:'1px 7px', borderRadius:8, background:C.icy+'18', color:C.icy, flexShrink:0 }}>
              <Icon name="star" size={11} color={C.icy}/> Priority
            </span>
          )}
          {player.blacklisted && (
            <span title={player.blacklistReason || ''} style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:11, color:C.red, fontWeight:700, padding:'1px 7px', borderRadius:8, background:C.red+'18', flexShrink:0 }}>
              <Icon name="alert-triangle" size={11} color={C.red}/> Blacklisted
            </span>
          )}
          {missingCount > 0 && (
            <button
              onClick={e => { e.stopPropagation(); onOpenFields?.(); }}
              title="Open Player Information"
              style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:11, color:C.gold, fontWeight:700, padding:'1px 7px', borderRadius:8, background:C.gold+'18', border:'none', flexShrink:0, cursor:'pointer', WebkitTapHighlightColor:'transparent' }}
            ><Icon name="alert-triangle" size={11} color={C.gold}/> {missingCount} missing</button>
          )}
        </div>

        {/* Row 2 — alliance · player ID · troop power · reliability (furnace moved up next to the name) */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
          {player.allianceTag && <span style={{ fontSize:12, color:C.icy, fontWeight:600 }}>[{player.allianceTag}]</span>}
          {player.fid && <span style={{ fontSize:11, color:C.muted }}>ID {player.fid}</span>}
          {troopPower != null && <span style={{ fontSize:12, color:C.gold, fontWeight:700 }}>💪 {troopPower.toLocaleString()}</span>}
          {player.country && <span style={{ fontSize:12, color:C.muted }}>{player.country}</span>}
          {metrics && (
            <span style={{ fontSize:11, fontWeight:700, marginLeft:'auto', color:metrics.reliabilityScore>=70?C.green:metrics.reliabilityScore>=40?C.gold:C.red }}>
              {metrics.reliabilityScore}pts
            </span>
          )}
        </div>

        {/* Role labels and rank were shown here before — removed per
            request: both are one tap away in the profile now (Role in
            SvS section, and the editable Alliance Rank section), so a
            second copy on every list row was unnecessary clutter. */}

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
          const troopEntries = [['shield','infantry',player.troops?.infantry,TROOP_COLORS.infantry],['sword','lancer',player.troops?.lancer,TROOP_COLORS.lancer],['target-arrow','marksman',player.troops?.marksman,TROOP_COLORS.marksman]];
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
              {notable.map(([iconName, key, t, tc]) => {
                const helios = t.startsWith('Helios');
                const mismatch = isMismatch(t);
                return (
                  <span key={key} title={mismatch ? "Differs from this player's other troops" : undefined}
                    style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:8, background:mismatch?C.gold+'22':tc+'18', color:mismatch?C.gold:tc }}>
                    <span style={{ position:'relative', display:'inline-flex', width:14, height:14, alignItems:'center', justifyContent:'center' }}>
                      <Icon name={iconName} size={13} color={mismatch?C.gold:tc}/>
                      {helios && <span style={{ position:'absolute', top:-2, right:-3, width:6, height:6, background:C.red, borderRadius:1.5 }}/>}
                    </span>
                    {t}
                    {mismatch && <Icon name="alert-triangle" size={10} color={C.gold}/>}
                  </span>
                );
              })}
            </div>
          );
        })()}

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
            style={{ width:44, height:44, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:isRallyLead?C.gold+'22':'none', border:`1.5px solid ${isRallyLead?C.gold:C.border}`, cursor:'pointer', flexShrink:0 }}
          ><Icon name="crown" size={19} color={isRallyLead?C.gold:C.muted+'88'}/></button>

          {/* Overflow menu — a direct one-tap ✕ was too easy to hit by
              accident in a long list. ⋮ opens a small menu; the actual
              delete still requires confirming in DeleteConfirmModal. */}
          <div style={{ position:'relative', flexShrink:0 }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              aria-label="More options"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              style={{ width:44, height:44, borderRadius:10, background:menuOpen?C.section:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
            ><Icon name="dots-vertical" size={20} color={C.muted}/></button>
            {menuOpen && (
              <div style={{ position:'absolute', top:'100%', right:0, marginTop:4, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.5)', zIndex:20, overflow:'hidden', minWidth:160 }}>
                <button
                  onClick={() => { setMenuOpen(false); setConfirmingDelete(true); }}
                  style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'12px 14px', background:'none', border:'none', color:C.red, fontSize:14, fontWeight:600, cursor:'pointer', textAlign:'left', whiteSpace:'nowrap' }}
                ><Icon name="trash" size={15} color={C.red}/> Remove player</button>
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
