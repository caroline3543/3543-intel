import { useState } from 'react';
import { C } from '../../../utils/constants.js';
import { vibe } from '../../../utils/vibe.js';
import {
  RALLY_TYPES, RALLY_ICONS, RALLY_COLORS,
  RATIO_PRESETS, RALLY_DURATIONS,
} from './battleConstants.js';
import { FormationPicker } from './FormationPicker.jsx';
import { JoinerSlotRow }   from './JoinerSlotRow.jsx';

// ── RallySlotCard ──────────────────────────────────────────────
// One rally slot inside a battle plan.
// Props:
//   slot          – rally slot object
//   index         – 0-based position
//   totalSlots    – total number of slots (for reorder bounds)
//   players       – full roster array
//   onUpdate      – (updatedSlot) => void
//   onDelete      – (slotId) => void
//   onMoveUp      – () => void
//   onMoveDown    – () => void
//   onGoToMembers – () => void  (navigation shortcut)
//   maxGeneration – number from Settings
export function RallySlotCard({
  slot, index, players, totalSlots,
  onUpdate, onDelete, onMoveUp, onMoveDown,
  onGoToMembers, maxGeneration = 6,
}) {
  const [open, setOpen]               = useState(index === 0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const color         = RALLY_COLORS[slot.type] || C.gold;
  const icon          = RALLY_ICONS[slot.type]  || '⚔️';
  const filledJoiners = slot.joiners.filter(j => j.playerName && j.heroName).length;
  const allJoinersFilled = filledJoiners === 4;

  const allAssignedIds = new Set(slot.joiners.filter(j => j.playerId).map(j => j.playerId));

  function upd(patch) { onUpdate({ ...slot, ...patch }); }
  function updJoiner(i, patch) {
    const joiners = [...slot.joiners];
    joiners[i] = { ...joiners[i], ...patch };
    upd({ joiners });
  }

  const completionPct = Math.round(
    (!!slot.leaderName + filledJoiners / 4 * 0.8 + !!slot.ratio * 0.1) / 1.9 * 100
  );

  return (
    <div style={{ background:C.card, borderRadius:14, marginBottom:12, border:`1px solid ${color}44`, overflow:'hidden' }}>
      {/* Completion bar */}
      <div style={{ height:3, background:C.border }}>
        <div style={{ height:'100%', width:`${completionPct}%`, background:allJoinersFilled&&slot.leaderName?C.green:color, transition:'width 300ms ease' }}/>
      </div>

      {/* Header */}
      <div onClick={() => setOpen(!open)} style={{ padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:12 }}>
        <div style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{slot.type}</div>
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:color+'22', color, fontWeight:700 }}>{slot.rallyDuration}min</span>
            {slot.ratio && <span style={{ fontSize:11, color:C.muted }}>{slot.ratio}</span>}
          </div>
          <div style={{ fontSize:13, color:C.icy }}>
            {slot.leaderName
              ? <span style={{ color:C.white, fontWeight:600 }}>{slot.leaderName}</span>
              : <span style={{ color:C.red+'cc', fontWeight:600 }}>No leader ⚠</span>}
            <span style={{ color:C.muted }}> · {filledJoiners}/4 joiners</span>
          </div>
        </div>
        {/* Reorder + delete */}
        <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
          {index > 0 && (
            <button onClick={e => { e.stopPropagation(); onMoveUp(); }}
              style={{ width:28, height:28, borderRadius:8, background:C.section, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>↑</button>
          )}
          {index < totalSlots - 1 && (
            <button onClick={e => { e.stopPropagation(); onMoveDown(); }}
              style={{ width:28, height:28, borderRadius:8, background:C.section, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>↓</button>
          )}
          <button onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
            style={{ width:28, height:28, borderRadius:8, background:'none', border:`1px solid ${C.red}33`, color:C.red+'88', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          <span style={{ color:C.muted, fontSize:14, marginLeft:2 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Delete confirmation inline */}
      {confirmDelete && (
        <div style={{ margin:'0 16px 14px', background:C.red+'18', border:`1px solid ${C.red}44`, borderRadius:10, padding:12 }}>
          <div style={{ fontSize:13, color:C.white, marginBottom:10, textAlign:'center' }}>
            Delete this {slot.type} slot?{filledJoiners > 0 ? ` (${filledJoiners} joiners assigned)` : ''} This cannot be undone.
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setConfirmDelete(false)}
              style={{ flex:1, height:40, borderRadius:10, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>Cancel</button>
            <button onClick={() => { onDelete(slot.id); vibe([20,20,20]); }}
              style={{ flex:2, height:40, borderRadius:10, background:C.red, color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>Delete slot</button>
          </div>
        </div>
      )}

      {open && !confirmDelete && (
        <div style={{ padding:'0 16px 16px', borderTop:`1px solid ${C.border}22` }}>

          {/* Rally type */}
          <div style={{ marginBottom:14, marginTop:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Type</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {RALLY_TYPES.map(type => {
                const sel = slot.type === type;
                const c   = RALLY_COLORS[type];
                return (
                  <button key={type} onClick={() => upd({ type })}
                    style={{ padding:'6px 12px', borderRadius:16, border:`1px solid ${sel?c:C.border}`, background:sel?c+'22':C.section, color:sel?c:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                    {RALLY_ICONS[type]} {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rally leader */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Rally leader</label>
            {players.length === 0 ? (
              <div style={{ fontSize:13, color:C.muted, padding:'8px 0' }}>
                No members yet.{' '}
                <button onClick={onGoToMembers} style={{ background:'none', border:'none', color:C.gold, fontSize:13, cursor:'pointer', padding:0, textDecoration:'underline' }}>Go to Members →</button>
              </div>
            ) : (
              <div>
                {players.filter(p => p.roles?.includes('Rally Lead')).length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, color:C.gold, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Rally leads</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {players.filter(p => p.roles?.includes('Rally Lead')).map(p => {
                        const sel = slot.leaderId === p.id;
                        return (
                          <button key={p.id} onClick={() => upd({ leaderId:p.id, leaderName:p.username||p.alias })}
                            style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${sel?color:C.gold+'44'}`, background:sel?color+'22':C.gold+'0a', color:sel?color:C.gold, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                            {p.username||p.alias}{p.furnaceLevel ? ` · ${p.furnaceLevel}` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {players.filter(p => !p.roles?.includes('Rally Lead')).length > 0 && (
                  <div>
                    <div style={{ fontSize:10, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Other members</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {players.filter(p => !p.roles?.includes('Rally Lead')).map(p => {
                        const sel = slot.leaderId === p.id;
                        return (
                          <button key={p.id} onClick={() => upd({ leaderId:p.id, leaderName:p.username||p.alias })}
                            style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${sel?color:C.border}`, background:sel?color+'22':C.section, color:sel?color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                            {p.username||p.alias}{p.furnaceLevel ? ` · ${p.furnaceLevel}` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {players.filter(p => p.roles?.includes('Rally Lead')).length === 0 && (
                  <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
                    No Rally Lead roles set.{' '}
                    <button onClick={onGoToMembers} style={{ background:'none', border:'none', color:C.gold, fontSize:12, cursor:'pointer', padding:0, textDecoration:'underline' }}>Assign roles in Members →</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rally duration */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Rally duration</label>
            <div style={{ display:'flex', gap:8 }}>
              {RALLY_DURATIONS.map(d => (
                <button key={d} onClick={() => upd({ rallyDuration:d })}
                  style={{ flex:1, height:48, borderRadius:10, border:`1px solid ${slot.rallyDuration===d?color:C.border}`, background:slot.rallyDuration===d?color+'22':C.section, color:slot.rallyDuration===d?color:C.muted, fontWeight:700, fontSize:15, cursor:'pointer' }}>
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Troop ratio */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>
              Troop ratio <span style={{ fontWeight:400 }}>(Infantry / Lancer / Marksman)</span>
            </label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:slot.ratio==='Custom'?8:0 }}>
              {RATIO_PRESETS.map(r => {
                const sel = slot.ratio === r;
                return (
                  <button key={r} onClick={() => upd({ ratio:r })}
                    style={{ padding:'6px 12px', borderRadius:16, border:`1px solid ${sel?C.icy:C.border}`, background:sel?C.icy+'22':C.section, color:sel?C.icy:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                    {r}
                  </button>
                );
              })}
              <button onClick={() => upd({ ratio:'Custom' })}
                style={{ padding:'6px 12px', borderRadius:16, border:`1px solid ${slot.ratio&&!RATIO_PRESETS.includes(slot.ratio)?C.icy:C.border}`, background:slot.ratio&&!RATIO_PRESETS.includes(slot.ratio)?C.icy+'22':C.section, color:slot.ratio&&!RATIO_PRESETS.includes(slot.ratio)?C.icy:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                Custom
              </button>
            </div>
            {(slot.ratio === 'Custom' || (slot.ratio && !RATIO_PRESETS.includes(slot.ratio))) && (
              <input
                value={slot.ratio === 'Custom' ? '' : slot.ratio}
                onChange={e => upd({ ratio:e.target.value })}
                placeholder="e.g. 55/35/10"
                style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit', marginTop:6 }}
              />
            )}
          </div>

          {/* FC Troop requirements */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Minimum troop tier required</label>
            <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>Members below these tiers shouldn't join this rally.</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {[['🛡️ Infantry','infantry',C.inf],['⚔️ Lancer','lancer',C.lan],['🏹 Marksman','marksman',C.mar]].map(([label, key, tc]) => (
                <div key={key}>
                  <div style={{ fontSize:11, color:tc, fontWeight:700, marginBottom:4 }}>{label}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {['FC1','FC2','FC3','FC4','FC5'].map(fc => {
                      const sel = (slot.troopReqs || {})[key] === fc;
                      return (
                        <button key={fc} onClick={() => upd({ troopReqs:{ ...(slot.troopReqs||{}), [key]:sel?null:fc } })}
                          style={{ height:32, borderRadius:8, border:`1px solid ${sel?tc:C.border}`, background:sel?tc+'22':C.section, color:sel?tc:C.muted, fontWeight:sel?700:400, fontSize:12, cursor:'pointer' }}>
                          {fc}+
                        </button>
                      );
                    })}
                    <button onClick={() => upd({ troopReqs:{ ...(slot.troopReqs||{}), [key]:null } })}
                      style={{ height:28, borderRadius:8, border:`1px solid ${C.border}`, background:'none', color:C.muted, fontSize:11, cursor:'pointer' }}>Any</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formation picker */}
          <FormationPicker
            slot={slot}
            upd={upd}
            color={color}
            players={players}
            maxGeneration={maxGeneration}
          />

          {/* Priority joiners */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Priority joiners</label>
            <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>These 4 members must join first, each bringing a specific hero.</div>
            <div style={{ background:C.section, borderRadius:10, padding:10 }}>
              {slot.joiners.map((joiner, i) => (
                <JoinerSlotRow
                  key={joiner.id}
                  slot={joiner}
                  index={i}
                  players={players}
                  onUpdate={patch => updJoiner(i, patch)}
                  allAssignedIds={allAssignedIds}
                  troopReqs={slot.troopReqs}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Strategy notes</label>
            <textarea
              value={slot.notes || ''}
              onChange={e => upd({ notes:e.target.value })}
              placeholder="e.g. Counter lands 1s after main, switch fight immediately after…"
              style={{ width:'100%', minHeight:64, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:14, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
