import { RallyLeaderSetup } from './RallyLeaderSetup.jsx';
import { useState } from 'react';
import { C, tierChipStyle, JOINER_COVERAGE_EVENTS } from '../../../utils/constants.js';
import { vibe } from '../../../utils/vibe.js';
import {
  RALLY_TYPES, RALLY_ICONS, RALLY_COLORS, isAttending,
} from './battleConstants.js';
import { FormationPicker } from './FormationPicker.jsx';
import { SlotAllocationControls } from './SlotAllocationControls.jsx';
import { isReady,isCommitted,eligibleTypes } from '../../../services/battlePoolService.js';
import { JoinerSlotRow }   from './JoinerSlotRow.jsx';
import { RatioPicker }     from './RatioPicker.jsx';
import { TestRallyLog }    from './TestRallyLog.jsx';
import { AlliancePicker }  from '../../common/AlliancePicker.jsx';

export function RallySlotCard({
  slot, index, players, events = [], totalSlots,
  onUpdate, onDelete, onMoveUp, onMoveDown,
  onGoToMembers, selectedGenerations = [],
  assignedInOtherSlots, linkedEvent = null, poolController,
}) {
  const [open, setOpen]               = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [changingLeader, setChangingLeader] = useState(false);

  const color         = RALLY_COLORS[slot.type] || C.gold;
  const icon          = RALLY_ICONS[slot.type]  || '⚔️';
  const filledJoiners = slot.joiners.filter(j => j.playerName && j.heroName).length;
  const allJoinersFilled = filledJoiners === 4;

  const existingTags = [...new Set(players.map(p => p.allianceTag).filter(Boolean))];

  const TIER_REQ_OPTIONS = ['Helios','FC8','FC7','FC6','FC5','FC4','FC3','FC2','FC1'];
  function tierReqLabel(fc) { return fc === 'Helios' ? 'Any Helios' : `${fc}+`; }

  const attendingMembers = linkedEvent
    ? players
        .filter(p => isReady(p,linkedEvent,slot.planPhase)&&!isCommitted(p,poolController?.pool))
        .filter(p => !slot.allianceTag || p.allianceTag === slot.allianceTag)
        .filter(p => !p.blacklisted)
    : [];

  const joinerEligiblePlayers = attendingMembers.filter(p => p.id !== slot.leaderId && eligibleTypes(p,slot).length>0);

  const leaderPlayer = players.find(p => p.id === slot.leaderId) || null;

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

  function selectLeader(p) {
    const joiners = slot.joiners.map(j =>
      j.playerId === p.id ? { ...j, playerId:null, playerName:'', confirmed:true, replacedBy:null } : j
    );
    onUpdate({ ...slot, leaderId:p.id, leaderName:p.username||p.alias, joiners });
    setChangingLeader(false);
  }

  const completionPct = Math.round(
    (!!slot.leaderName + filledJoiners / 4 * 0.8 + !!slot.ratio * 0.1) / 1.9 * 100
  );

  return (
    <div style={{ background:C.card, borderRadius:14, marginBottom:12, border:`1px solid ${color}44`, overflow:'hidden' }}>

      <div style={{ height:3, background:C.border }}>
        <div style={{ height:'100%', width:`${completionPct}%`, background:allJoinersFilled&&slot.leaderName?C.green:color, transition:'width 300ms ease' }}/>
      </div>


      <div onClick={() => setOpen(!open)} style={{ padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:12 }}>
        <div style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{slot.type}</div>
            {slot.allianceTag && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:C.icy+'22', color:C.icy, fontWeight:700 }}>[{slot.allianceTag}]</span>}
            {slot.target && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:color+'22', color, fontWeight:700 }}>{slot.target==='turret'?'🗼 Turret':'🏰 Castle'}</span>}
            {slot.ratio && <span style={{ fontSize:11, color:C.muted }}>{slot.ratio}</span>}
          </div>
          <div style={{ fontSize:13, color:C.icy }}>
            {slot.leaderName
              ? <span style={{ color:C.white, fontWeight:600 }}>{slot.leaderName}</span>
              : <span style={{ color:C.red+'cc', fontWeight:600 }}>No leader ⚠</span>}
            <span style={{ color:C.muted }}> · {filledJoiners}/4 joiners</span>
          </div>
        </div>

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


          <div style={{ marginBottom:14, marginTop:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Alliance</label>
            <AlliancePicker value={slot.allianceTag || ''} onChange={v => upd({ allianceTag: v || null })} existingTags={existingTags} />
            {slot.allianceTag && (
              <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>Only [{slot.allianceTag}] members can be selected as leader or joiners below.</div>
            )}
          </div>


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


          {linkedEvent && JOINER_COVERAGE_EVENTS.includes(linkedEvent.type) && (
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Target</label>
              <div style={{ display:'flex', gap:8 }}>
                {[['turret','🗼 Turret'],['castle','🏰 Castle']].map(([val, label]) => {
                  const sel = slot.target === val;
                  return (
                    <button key={val} onClick={() => upd({ target: sel ? null : val })}
                      style={{ flex:1, height:44, borderRadius:12, border:`1px solid ${sel?color:C.border}`, background:sel?color+'22':C.section, color:sel?color:C.muted, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                      {sel?'✓ ':''}{label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}


          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Planning for</label>
            <div style={{ display:'flex', gap:8 }}>
              {[['start','⏱ Start of event'],['midway','🔄 Midway through']].map(([val, label]) => {
                const sel = (slot.planPhase || 'start') === val;
                return (
                  <button key={val} onClick={() => upd({ planPhase: val })}
                    style={{ flex:1, height:40, borderRadius:12, border:`1px solid ${sel?color:C.border}`, background:sel?color+'22':C.section, color:sel?color:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    {sel?'✓ ':''}{label}
                  </button>
                );
              })}
            </div>
          </div>


          <RallyLeaderSetup linkedEvent={linkedEvent} players={players} onGoToMembers={onGoToMembers} slot={slot} changingLeader={changingLeader} setChangingLeader={setChangingLeader} color={color} attendingMembers={attendingMembers} selectLeader={selectLeader} upd={upd} joinerEligiblePlayers={joinerEligiblePlayers} events={events} selectedGenerations={selectedGenerations} leaderPlayer={leaderPlayer} allAssignedIds={allAssignedIds}/>

          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Minimum troop tier required</label>
            <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>Members below these tiers shouldn't join this rally.</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:11, color:C.muted, marginRight:2 }}>Set all three:</span>
              {TIER_REQ_OPTIONS.map(fc => {
                const allMatch = ['infantry','lancer','marksman'].every(k => (slot.troopReqs||{})[k] === fc);
                return (
                  <button key={fc} onClick={() => upd({ troopReqs:{ infantry:fc, lancer:fc, marksman:fc } })}
                    style={{ padding:'4px 10px', borderRadius:12, border:`1px solid ${allMatch?C.gold:C.border}`, background:allMatch?C.gold+'22':C.section, color:allMatch?C.gold:C.muted, fontWeight:600, fontSize:11, cursor:'pointer' }}>
                    {allMatch?'✓ ':''}{tierReqLabel(fc)}
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
                    {TIER_REQ_OPTIONS.map(fc => {
                      const sel = (slot.troopReqs || {})[key] === fc;
                      return (
                        <button key={fc} onClick={() => upd({ troopReqs:{ ...(slot.troopReqs||{}), [key]:sel?null:fc } })}
                          style={{ ...tierChipStyle(sel, tc), height:32, borderRadius:8 }}>
                          {sel?'✓ ':''}{tierReqLabel(fc)}
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
                    linkedEvent={linkedEvent}
                    planPhase={slot.planPhase || 'start'}
                    onUpdate={patch => updJoiner(i, patch)}
                    allAssignedIds={allAssignedIds}
                    troopReqs={slot.troopReqs}
                    rallySlot={slot}
                  />
                ))}
              </div>
            </div>
          )}

          <SlotAllocationControls slot={slot} players={players} event={linkedEvent} onUpdate={onUpdate} pool={poolController?.pool} excludedIds={assignedInOtherSlots}/>


          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Strategy notes</label>
            <textarea
              value={slot.notes || ''}
              onChange={e => upd({ notes:e.target.value })}
              placeholder="e.g. Counter lands 1s after main, switch fight immediately after…"
              style={{ width:'100%', minHeight:64, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:14, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}
            />
          </div>


          <TestRallyLog entries={slot.testRallies || []} onChange={testRallies => upd({ testRallies })} />
        </div>
      )}
    </div>
  );
}
