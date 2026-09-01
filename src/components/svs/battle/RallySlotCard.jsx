import { useState } from 'react';
import { C, tierChipStyle } from '../../../utils/constants.js';
import { vibe } from '../../../utils/vibe.js';
import {
  RALLY_TYPES, RALLY_ICONS, RALLY_COLORS, isAttending,
} from './battleConstants.js';
import { FormationPicker } from './FormationPicker.jsx';
import { JoinerSlotRow }   from './JoinerSlotRow.jsx';
import { RatioPicker }     from './RatioPicker.jsx';
import { TestRallyLog }    from './TestRallyLog.jsx';
import { AlliancePicker }  from '../../common/AlliancePicker.jsx';
import { buildFormationMessage } from '../../../services/formationMessage.js';

// ── RallySlotCard ──────────────────────────────────────────────
// One rally slot inside a battle plan.
//
// Field order (deliberate): Alliance, Type, Formation, Troop Ratio,
// Rally Leader, Minimum Troop Tier, Copy Formation Instructions,
// Priority Joiners, Strategy Notes, Test Rallies. Rally Duration is
// NOT shown here — it still exists on the slot (feeds Live Rally
// Room's timer math, default 3min) but is set per-leader in the Live
// Room's Calculator instead, not during planning.
//
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
//   selectedGenerations – number[] from Settings, explicit not cumulative
//   assignedInOtherSlots – Set of playerIds already used as a priority
//                          joiner in a DIFFERENT slot in this same plan
//                          (plan-wide exclusivity — a priority joiner
//                          can only be used in one rally per event)
//   linkedEvent   – the Event this plan is linked to (or null). Leader
//                   selection and joiner eligibility are BOTH gated on
//                   this existing — no event linked means no attendance
//                   data exists, so neither can be shown accurately.
export function RallySlotCard({
  slot, index, players, events = [], totalSlots,
  onUpdate, onDelete, onMoveUp, onMoveDown,
  onGoToMembers, selectedGenerations = [],
  assignedInOtherSlots, linkedEvent = null,
}) {
  const [open, setOpen]               = useState(index === 0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [changingLeader, setChangingLeader] = useState(false);
  const [instructionsText, setInstructionsText] = useState(null); // lazily generated, hand-editable
  const [copied, setCopied] = useState(false);

  const color         = RALLY_COLORS[slot.type] || C.gold;
  const icon          = RALLY_ICONS[slot.type]  || '⚔️';
  const filledJoiners = slot.joiners.filter(j => j.playerName && j.heroName).length;
  const allJoinersFilled = filledJoiners === 4;

  const existingTags = [...new Set(players.map(p => p.allianceTag).filter(Boolean))];

  // Everyone attending the linked event, further narrowed to this
  // slot's alliance if one is set — the pool a Rally Leader can be
  // picked from. Empty (not "everyone") when no event is linked, so
  // nobody gets selected as leader without confirmed real attendance.
  const attendingMembers = linkedEvent
    ? players
        .filter(p => isAttending(p.id, linkedEvent))
        .filter(p => !slot.allianceTag || p.allianceTag === slot.allianceTag)
    : [];

  // The Rally Leader can never appear as their own joiner — this feeds
  // FormationPicker (coverage counts, auto-suggest) AND JoinerSlotRow
  // (manual eligible list) so the leader is excluded everywhere, not
  // just greyed out like a normal already-assigned duplicate. Also
  // attendance- and alliance-filtered for the same reason as above.
  const joinerEligiblePlayers = attendingMembers.filter(p => p.id !== slot.leaderId);

  // Priority-joiner exclusivity is plan-wide, not just within this
  // slot's own 4 joiners — merge in anyone already assigned elsewhere
  // in the same battle plan (passed down from PlanDetail).
  const allAssignedIds = new Set([
    ...slot.joiners.filter(j => j.playerId).map(j => j.playerId),
    ...(assignedInOtherSlots || []),
  ]);

  function upd(patch) { onUpdate({ ...slot, ...patch }); }
  function updJoiner(i, patch) {
    const joiners = [...slot.joiners];
    joiners[i] = { ...joiners[i], ...patch };
    upd({ joiners });
  }

  const completionPct = Math.round(
    (!!slot.leaderName + filledJoiners / 4 * 0.8 + !!slot.ratio * 0.1) / 1.9 * 100
  );

  const hasFormationContent = !!slot.selectedFormation || (slot.leaderRallyHeroes || []).length === 3;

  function generateInstructions() {
    const formation = { type: slot.type, ratio: slot.ratio, leaders: slot.leaderRallyHeroes || [] };
    const messageJoiners = (slot.joiners || []).map(j => ({
      player: j.playerId ? { username: j.playerName } : null,
      hero:   j.heroName,
    }));
    return buildFormationMessage(formation, messageJoiners, slot.leaderName);
  }

  function regenerateInstructions() {
    setInstructionsText(generateInstructions());
  }

  function copyInstructions() {
    const text = instructionsText ?? generateInstructions();
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

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
            {slot.allianceTag && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:C.icy+'22', color:C.icy, fontWeight:700 }}>[{slot.allianceTag}]</span>}
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

          {/* 1. Alliance */}
          <div style={{ marginBottom:14, marginTop:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Alliance</label>
            <AlliancePicker value={slot.allianceTag || ''} onChange={v => upd({ allianceTag: v || null })} existingTags={existingTags} />
            {slot.allianceTag && (
              <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>Only [{slot.allianceTag}] members can be selected as leader or joiners below.</div>
            )}
          </div>

          {/* 2. Type */}
          <div style={{ marginBottom:14 }}>
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

          {/* 3. Formation + 4. Troop Ratio — both need real attendance
              data (formation coverage/auto-suggest reads the eligible
              pool), so gated on a linked event same as leader/joiners. */}
          {linkedEvent ? (
            <>
              <FormationPicker
                slot={slot}
                upd={upd}
                color={color}
                players={joinerEligiblePlayers}
                events={events}
                selectedGenerations={selectedGenerations}
                assignedInOtherSlots={assignedInOtherSlots}
              />

              <RatioPicker slot={slot} upd={upd} />
            </>
          ) : (
            <div style={{ background:C.section, borderRadius:12, padding:14, marginBottom:14, textAlign:'center' }}>
              <div style={{ fontSize:13, color:C.muted }}>🔗 Link this plan to an event above to plan formations, leader, and priority joiners — eligibility needs real attendance data.</div>
            </div>
          )}

          {/* 5. Rally leader — gated on a linked event, since a leader
              can't be picked without confirming they're actually
              attending (same rule as joiners). */}
          {linkedEvent && (
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Rally leader</label>
            {players.length === 0 ? (
              <div style={{ fontSize:13, color:C.muted, padding:'8px 0' }}>
                No members yet.{' '}
                <button onClick={onGoToMembers} style={{ background:'none', border:'none', color:C.gold, fontSize:13, cursor:'pointer', padding:0, textDecoration:'underline' }}>Go to Members →</button>
              </div>
            ) : slot.leaderId && !changingLeader ? (
              /* Leader chosen — show them prominently, nothing else
                 underneath. Joiner selection happens separately below. */
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:color+'14', border:`1px solid ${color}44`, borderRadius:12, padding:'12px 14px' }}>
                <div>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>Leading this rally</div>
                  <div style={{ fontSize:16, fontWeight:800, color:C.white }}>{slot.leaderName}</div>
                </div>
                <button onClick={() => setChangingLeader(true)}
                  style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:16, padding:'6px 14px', color:C.gold, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                  Change
                </button>
              </div>
            ) : attendingMembers.length === 0 ? (
              <div style={{ fontSize:13, color:C.gold, padding:'8px 0' }}>
                ⚠ No one{slot.allianceTag ? ` from [${slot.allianceTag}]` : ''} is marked attending this event yet. Update RSVPs in the Events tab.
              </div>
            ) : (
              <div>
                {attendingMembers.filter(p => p.roles?.includes('Rally Lead')).length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, color:C.gold, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Rally leads</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {attendingMembers.filter(p => p.roles?.includes('Rally Lead')).map(p => {
                        const sel = slot.leaderId === p.id;
                        return (
                          <button key={p.id} onClick={() => { upd({ leaderId:p.id, leaderName:p.username||p.alias }); setChangingLeader(false); }}
                            style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${sel?color:C.gold+'44'}`, background:sel?color+'22':C.gold+'0a', color:sel?color:C.gold, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                            {p.username||p.alias}{p.furnaceLevel ? ` · ${p.furnaceLevel}` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {attendingMembers.filter(p => !p.roles?.includes('Rally Lead')).length > 0 && (
                  <div>
                    <div style={{ fontSize:10, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Other attending members</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {attendingMembers.filter(p => !p.roles?.includes('Rally Lead')).map(p => {
                        const sel = slot.leaderId === p.id;
                        return (
                          <button key={p.id} onClick={() => { upd({ leaderId:p.id, leaderName:p.username||p.alias }); setChangingLeader(false); }}
                            style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${sel?color:C.border}`, background:sel?color+'22':C.section, color:sel?color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                            {p.username||p.alias}{p.furnaceLevel ? ` · ${p.furnaceLevel}` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {attendingMembers.filter(p => p.roles?.includes('Rally Lead')).length === 0 && (
                  <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
                    No attending members have the Rally Lead role.{' '}
                    <button onClick={onGoToMembers} style={{ background:'none', border:'none', color:C.gold, fontSize:12, cursor:'pointer', padding:0, textDecoration:'underline' }}>Assign roles in Members →</button>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* 6. Minimum troop tier */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Minimum troop tier required</label>
            <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>Members below these tiers shouldn't join this rally.</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:11, color:C.muted, marginRight:2 }}>Set all three:</span>
              {['FC1','FC2','FC3','FC4','FC5','FC6','FC7','FC8','T11/Helios'].map(fc => {
                const allMatch = ['infantry','lancer','marksman'].every(k => (slot.troopReqs||{})[k] === fc);
                return (
                  <button key={fc} onClick={() => upd({ troopReqs:{ infantry:fc, lancer:fc, marksman:fc } })}
                    style={{ padding:'4px 10px', borderRadius:12, border:`1px solid ${allMatch?C.gold:C.border}`, background:allMatch?C.gold+'22':C.section, color:allMatch?C.gold:C.muted, fontWeight:600, fontSize:11, cursor:'pointer' }}>
                    {allMatch?'✓ ':''}{fc}
                  </button>
                );
              })}
              <button onClick={() => upd({ troopReqs:{ infantry:null, lancer:null, marksman:null } })}
                style={{ padding:'4px 10px', borderRadius:12, border:`1px solid ${C.border}`, background:'none', color:C.muted, fontSize:11, cursor:'pointer' }}>
                Clear all
              </button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {[['🛡️ Infantry','infantry',C.inf],['⚔️ Lancer','lancer',C.lan],['🏹 Marksman','marksman',C.mar]].map(([label, key, tc]) => (
                <div key={key}>
                  <div style={{ fontSize:11, color:tc, fontWeight:700, marginBottom:4 }}>{label}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {['FC1','FC2','FC3','FC4','FC5','FC6','FC7','FC8','T11/Helios'].map(fc => {
                      const sel = (slot.troopReqs || {})[key] === fc;
                      return (
                        <button key={fc} onClick={() => upd({ troopReqs:{ ...(slot.troopReqs||{}), [key]:sel?null:fc } })}
                          style={{ ...tierChipStyle(sel, tc), height:32, borderRadius:8 }}>
                          {sel?'✓ ':''}{fc}+
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

          {/* 7. Copy formation instructions — viewable and hand-editable
              before copying, not a silent one-shot clipboard write. */}
          {hasFormationContent && (
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Copy formation instructions</label>
              <textarea
                value={instructionsText ?? generateInstructions()}
                onChange={e => setInstructionsText(e.target.value)}
                style={{ width:'100%', minHeight:110, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13, color:C.white, resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }}
              />
              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <button onClick={copyInstructions}
                  style={{ flex:2, height:44, borderRadius:10, background:copied?C.green+'18':C.gold+'18', border:`1px solid ${copied?C.green:C.gold}44`, color:copied?C.green:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
                <button onClick={regenerateInstructions}
                  style={{ flex:1, height:44, borderRadius:10, background:'none', border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  ↺ Reset
                </button>
              </div>
            </div>
          )}

          {/* 8. Priority joiners */}
          {linkedEvent && (
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Priority joiners</label>
              <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>These 4 members must join first, each bringing a specific hero.</div>
              <div style={{ background:C.section, borderRadius:10, padding:10 }}>
                {slot.joiners.map((joiner, i) => (
                  <JoinerSlotRow
                    key={joiner.id}
                    slot={joiner}
                    index={i}
                    players={joinerEligiblePlayers}
                    events={events}
                    onUpdate={patch => updJoiner(i, patch)}
                    allAssignedIds={allAssignedIds}
                    troopReqs={slot.troopReqs}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 9. Strategy notes */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Strategy notes</label>
            <textarea
              value={slot.notes || ''}
              onChange={e => upd({ notes:e.target.value })}
              placeholder="e.g. Counter lands 1s after main, switch fight immediately after…"
              style={{ width:'100%', minHeight:64, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:14, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}
            />
          </div>

          {/* 10. Test rallies — real-battle results logged against this formation */}
          <TestRallyLog entries={slot.testRallies || []} onChange={testRallies => upd({ testRallies })} />
        </div>
      )}
    </div>
  );
}
