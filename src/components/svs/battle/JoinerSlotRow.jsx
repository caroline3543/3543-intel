import { useState } from 'react';
import { C } from '../../../utils/constants.js';
import { FC_ORDER } from './battleConstants.js';

// ── JoinerSlotRow ──────────────────────────────────────────────
// One priority-joiner row inside a rally slot.
// Props:
//   slot            – joiner slot object
//   index           – 0-based position
//   players         – full roster array
//   onUpdate        – (updatedSlot) => void
//   allAssignedIds  – Set of playerIds already assigned in this rally slot
//   troopReqs       – { infantry, lancer, marksman } minimum FC strings
export function JoinerSlotRow({ slot, index, players, onUpdate, allAssignedIds, troopReqs = {} }) {
  const [open, setOpen] = useState(false);

  const player        = players.find(p => p.id === slot.playerId);
  const playerJoiners = player
    ? (player.joinerHeroes || []).filter(jh => jh.skillLevel >= 5).map(jh => jh.hero)
    : [];

  const isComplete = !!(slot.playerName && slot.heroName);
  const isUnavail  = slot.confirmed === false && slot.playerId;

  function meetsReqs(p) {
    const reqs = troopReqs || {};
    for (const [key, minFC] of Object.entries(reqs)) {
      if (!minFC) continue;
      const playerTier = p.troops?.[key];
      if (!playerTier) return { ok: false, reason: `Needs ${minFC}+ ${key}` };
      if (FC_ORDER.indexOf(playerTier) < FC_ORDER.indexOf(minFC)) {
        return { ok: false, reason: `${key} ${playerTier} < ${minFC} required` };
      }
    }
    return { ok: true, reason: null };
  }

  const hasReqs    = Object.values(troopReqs || {}).some(Boolean);
  const eligible   = players.filter(p => !hasReqs || meetsReqs(p).ok);
  const ineligible = hasReqs ? players.filter(p => !meetsReqs(p).ok) : [];

  const withJoiners    = eligible.filter(p => (p.joinerHeroes || []).some(jh => jh.skillLevel >= 5));
  const withoutJoiners = eligible.filter(p => !(p.joinerHeroes || []).some(jh => jh.skillLevel >= 5));

  const suggestions = isUnavail && slot.heroName
    ? eligible
        .filter(p => p.id !== slot.playerId)
        .filter(p => !allAssignedIds.has(p.id))
        .filter(p => p.availability?.present !== 'unavailable')
        .filter(p => (p.joinerHeroes || []).some(jh => jh.hero === slot.heroName && jh.skillLevel >= 5))
        .slice(0, 3)
    : [];

  return (
    <div style={{ background: C.bg, borderRadius: 10, marginBottom: 6, border: `1px solid ${isComplete ? C.green + '33' : C.border + '44'}` }}>
      {/* Row header */}
      <div onClick={() => setOpen(!open)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', cursor:'pointer' }}>
        <div style={{ width:22, height:22, borderRadius:'50%', background: isComplete ? C.green+'33' : C.border, border: `1.5px solid ${isComplete ? C.green : C.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color: isComplete ? C.green : C.muted, flexShrink:0 }}>
          {isComplete ? '✓' : index + 1}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          {slot.playerName ? (
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <span style={{ fontSize:14, fontWeight:700, color: isUnavail ? C.muted : C.white, textDecoration: isUnavail ? 'line-through' : 'none' }}>
                {slot.replacedBy ? slot.replacedBy.playerName : slot.playerName}
              </span>
              {slot.heroName && <span style={{ fontSize:12, color:C.gold, fontWeight:600 }}>→ {slot.replacedBy?.heroName || slot.heroName}</span>}
              {isUnavail && <span style={{ fontSize:11, color:C.red, fontWeight:600 }}>Unavailable</span>}
              {slot.replacedBy && <span style={{ fontSize:11, color:C.green }}>← sub</span>}
            </div>
          ) : (
            <span style={{ fontSize:14, color:C.muted }}>Assign member {index + 1}</span>
          )}
          {slot.playerId && playerJoiners.length === 0 && (
            <div style={{ fontSize:11, color:C.gold, marginTop:2 }}>⚠ No joiner heroes recorded — add in 🦸 Joiner Registry</div>
          )}
        </div>
        <span style={{ color:C.muted, fontSize:13 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding:'0 12px 12px' }}>

          {/* Member picker */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>
              Member
              {hasReqs && (
                <span style={{ fontSize:10, color:C.gold, fontWeight:400, marginLeft:8 }}>
                  {eligible.length} eligible · {ineligible.length} below troop tier
                </span>
              )}
            </label>
            {players.length === 0 ? (
              <div style={{ fontSize:13, color:C.muted, padding:'8px 0' }}>No members in roster</div>
            ) : (
              <div style={{ maxHeight:160, overflowY:'auto' }}>
                {/* Eligible with heroes */}
                {withJoiners.length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, color:C.gold, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Has joiner heroes</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {withJoiners.map(p => {
                        const sel     = slot.playerId === p.id;
                        const already = allAssignedIds.has(p.id) && !sel;
                        return (
                          <button key={p.id} onClick={() => !already && onUpdate({ ...slot, playerId:p.id, playerName:p.username||p.alias||'', heroName:'', confirmed:true, replacedBy:null })}
                            style={{ padding:'5px 10px', borderRadius:14, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':already?C.border+'11':C.section, color:sel?C.gold:already?C.muted:C.icy, fontWeight:600, fontSize:12, cursor:already?'default':'pointer', opacity:already?0.5:1 }}>
                            {p.username || p.alias}
                            <span style={{ fontSize:10, color:sel?C.gold:C.muted }}> ·{(p.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).length}🦸</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Eligible without heroes */}
                {withoutJoiners.length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>No heroes recorded</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {withoutJoiners.map(p => {
                        const sel     = slot.playerId === p.id;
                        const already = allAssignedIds.has(p.id) && !sel;
                        return (
                          <button key={p.id} onClick={() => !already && onUpdate({ ...slot, playerId:p.id, playerName:p.username||p.alias||'', heroName:'', confirmed:true, replacedBy:null })}
                            style={{ padding:'5px 10px', borderRadius:14, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:already?'default':'pointer', opacity:already?0.5:1 }}>
                            {p.username || p.alias}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Ineligible — below troop tier */}
                {ineligible.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, color:C.red, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>
                      ✗ Below troop tier requirement
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {ineligible.map(p => {
                        const reason = meetsReqs(p).reason;
                        return (
                          <div key={p.id} title={reason} style={{ padding:'5px 10px', borderRadius:14, border:`1px solid ${C.red}33`, background:C.red+'0a', color:C.muted, fontSize:12, opacity:0.6, cursor:'not-allowed', display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{ fontSize:10, color:C.red }}>✗</span>
                            {p.username || p.alias}
                            <span style={{ fontSize:10, color:C.red+88 }}>{reason}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {eligible.length === 0 && hasReqs && (
                  <div style={{ fontSize:13, color:C.red, padding:'8px 0', textAlign:'center' }}>
                    ⚠ No members meet the troop tier requirements for this rally.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hero picker */}
          {slot.playerId && playerJoiners.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Hero to bring</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {playerJoiners.map(hero => {
                  const sel = slot.heroName === hero;
                  return (
                    <button key={hero} onClick={() => onUpdate({ ...slot, heroName:hero })}
                      style={{ padding:'6px 12px', borderRadius:14, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                      ✓ {hero}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {slot.playerId && playerJoiners.length === 0 && (
            <div style={{ background:C.section, borderRadius:8, padding:'8px 12px', marginBottom:10, fontSize:12, color:C.muted }}>
              No Skill 5 joiner heroes for this member. Add them in the 🦸 Joiner Registry (Intel tab).
            </div>
          )}

          {/* Mark unavailable + clear */}
          {slot.playerId && (
            <div style={{ display:'flex', gap:8, marginBottom: suggestions.length > 0 ? 10 : 0 }}>
              <button onClick={() => onUpdate({ ...slot, confirmed: slot.confirmed === false ? true : false })}
                style={{ flex:1, height:36, borderRadius:8, border:`1px solid ${slot.confirmed===false?C.green:C.red}44`, background:slot.confirmed===false?C.green+'18':C.red+'18', color:slot.confirmed===false?C.green:C.red, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                {slot.confirmed === false ? '✓ Mark available' : '⚠ Mark unavailable'}
              </button>
              <button onClick={() => onUpdate({ ...slot, playerId:null, playerName:'', heroName:'', confirmed:true, replacedBy:null })}
                style={{ height:36, padding:'0 12px', borderRadius:8, border:`1px solid ${C.border}`, background:'none', color:C.muted, fontSize:12, cursor:'pointer' }}>
                Clear
              </button>
            </div>
          )}

          {/* Replacement suggestions */}
          {suggestions.length > 0 && (
            <div style={{ background:C.green+'0a', borderRadius:8, padding:10 }}>
              <div style={{ fontSize:11, color:C.green, fontWeight:700, marginBottom:6 }}>Suggested replacements (have {slot.heroName}):</div>
              {suggestions.map(p => (
                <button key={p.id} onClick={() => onUpdate({ ...slot, replacedBy:{ playerId:p.id, playerName:p.username||p.alias, heroName:slot.heroName } })}
                  style={{ display:'block', width:'100%', padding:'7px 10px', marginBottom:4, borderRadius:8, border:`1px solid ${C.green}44`, background:C.green+'18', color:C.green, fontWeight:600, fontSize:13, cursor:'pointer', textAlign:'left' }}>
                  ＋ {p.username||p.alias} → {slot.heroName}{p.furnaceLevel ? ` · ${p.furnaceLevel}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
