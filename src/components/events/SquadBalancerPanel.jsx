import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { getCurrentTroopPower } from '../../data/metrics.js';
import { newSquad } from '../../data/playerSchema.js';
import { balanceSquads, squadTotalPower } from '../../services/squadBalancerService.js';

function initials(n) { return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?'; }

// ── SquadBalancerPanel ─────────────────────────────────────────
// Foundry / Canyon Clash only (see TROOP_POWER_EVENTS) — these events
// split an alliance's own contingent into several independent teams
// racing across the map, not rallies, so this is deliberately separate
// from the Battle Plan / rally-slot system.
//
// Props:
//   activeEvent   – the event being balanced (needs .squads, .snapshots, .participantIds)
//   players       – full roster (for name lookups)
//   events        – full events array — fallback power source when this
//                   event hasn't had troop power entered yet
//   onUpdateEvent – (updatedEvent) => void
export function SquadBalancerPanel({ activeEvent, players, events, onUpdateEvent }) {
  const [teamCount, setTeamCount]     = useState(2);
  const [selectedLeaderIds, setSelectedLeaderIds] = useState([]);
  const [confirmRebalance, setConfirmRebalance]   = useState(false);
  const [movingPlayerId, setMovingPlayerId]       = useState(null); // player currently showing the "move to..." picker

  const eventPlayers = players.filter(p => (activeEvent.participantIds || []).includes(p.id));

  function getPower(player) {
    const snap = (activeEvent.snapshots || []).find(s => s.playerId === player.id);
    return snap?.troopPower ?? getCurrentTroopPower(player, events);
  }

  const squads = activeEvent.squads || [];
  const hasSquads = squads.length > 0;

  function toggleLeader(id) {
    setSelectedLeaderIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= teamCount) return prev;
      return [...prev, id];
    });
  }

  function runBalance() {
    const { squads: built } = balanceSquads(eventPlayers, selectedLeaderIds, teamCount, getPower);
    const named = built.map((s, i) => ({ ...newSquad(s), name: `Team ${i + 1}` }));
    onUpdateEvent({ ...activeEvent, squads: named });
    setSelectedLeaderIds([]);
    vibe(8);
  }

  function clearSquads() {
    onUpdateEvent({ ...activeEvent, squads: [] });
    setConfirmRebalance(false);
    vibe(8);
  }

  function renameSquad(id, name) {
    onUpdateEvent({ ...activeEvent, squads: squads.map(s => s.id === id ? { ...s, name } : s) });
  }

  function moveMember(playerId, fromSquadId, toSquadId) {
    if (fromSquadId === toSquadId) { setMovingPlayerId(null); return; }
    const updated = squads.map(s => {
      if (s.id === fromSquadId) {
        return s.leaderId === playerId
          ? { ...s, leaderId: null }
          : { ...s, memberIds: s.memberIds.filter(id => id !== playerId) };
      }
      if (s.id === toSquadId) return { ...s, memberIds: [...s.memberIds, playerId] };
      return s;
    });
    onUpdateEvent({ ...activeEvent, squads: updated });
    setMovingPlayerId(null);
    vibe(8);
  }

  const totals = squads.map(s => squadTotalPower(s, players, getPower));
  const maxTotal = totals.length ? Math.max(...totals) : 0;
  const avgTotal = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const noPowerCount = eventPlayers.filter(p => getPower(p) == null).length;

  function playerName(id) {
    const p = players.find(pl => pl.id === id);
    return p ? (p.username || p.alias || '?') : '?';
  }

  if (!hasSquads) {
    return (
      <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:4 }}>⚖️ Squad Balancer</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>
          Splits {eventPlayers.length} attendee{eventPlayers.length !== 1 ? 's' : ''} into teams as close to equal total power as possible.
        </div>

        <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Number of teams</label>
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          {[2,3,4,5,6].map(n => (
            <button key={n} onClick={() => { setTeamCount(n); setSelectedLeaderIds(prev => prev.slice(0, n)); }}
              style={{ flex:1, height:44, borderRadius:10, border:`1px solid ${teamCount===n?C.gold:C.border}`, background:teamCount===n?C.gold+'22':C.section, color:teamCount===n?C.gold:C.muted, fontWeight:700, fontSize:15, cursor:'pointer' }}>
              {n}
            </button>
          ))}
        </div>

        <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>
          Team leads (optional — up to {teamCount})
        </label>
        <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>
          Each pick anchors one team. Leave some unpicked and the balancer fills every team from scratch.
        </div>
        {eventPlayers.length === 0 ? (
          <div style={{ fontSize:13, color:C.muted, padding:'8px 0' }}>No one's been added to this event yet.</div>
        ) : (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
            {eventPlayers.map(p => {
              const idx = selectedLeaderIds.indexOf(p.id);
              const sel = idx !== -1;
              return (
                <button key={p.id} onClick={() => toggleLeader(p.id)}
                  style={{ padding:'7px 12px', borderRadius:20, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  {sel ? `${idx+1}. ` : ''}{p.username||p.alias||'?'}
                </button>
              );
            })}
          </div>
        )}

        {noPowerCount > 0 && (
          <div style={{ fontSize:11, color:C.gold, marginBottom:12 }}>
            ⚠ {noPowerCount} attendee{noPowerCount!==1?'s have':' has'} no recorded troop power — they'll be spread evenly by headcount instead of by strength.
          </div>
        )}

        <button onClick={runBalance} disabled={eventPlayers.length === 0}
          style={{ width:'100%', height:48, borderRadius:12, background:eventPlayers.length?C.gold:C.section, color:eventPlayers.length?C.bg:C.muted, fontWeight:700, fontSize:15, border:eventPlayers.length?'none':`1px solid ${C.border}`, cursor:eventPlayers.length?'pointer':'default' }}>
          ⚖️ Auto-Balance {teamCount} Teams
        </button>
      </div>
    );
  }

  return (
    <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.white }}>⚖️ Squads</div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => confirmRebalance ? runBalance() : setConfirmRebalance(true)}
            onBlur={() => setTimeout(() => setConfirmRebalance(false), 200)}
            style={{ fontSize:12, color:confirmRebalance?C.gold:C.muted, background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
            {confirmRebalance ? 'Tap again to re-balance' : '↺ Re-balance'}
          </button>
        </div>
      </div>
      <div style={{ fontSize:11, color:C.muted, marginBottom:14 }}>
        Power spread: {(maxTotal - Math.min(...totals)).toLocaleString()} across teams · average {Math.round(avgTotal).toLocaleString()}
        {noPowerCount > 0 && ` · ⚠ ${noPowerCount} with no recorded power`}
      </div>

      {squads.map((squad, si) => {
        const total = totals[si];
        const pctOfMax = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
        const allMemberIds = [squad.leaderId, ...squad.memberIds].filter(Boolean);
        return (
          <div key={squad.id} style={{ background:C.section, borderRadius:12, padding:12, marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <input value={squad.name} onChange={e => renameSquad(squad.id, e.target.value)}
                style={{ background:'none', border:'none', color:C.white, fontSize:14, fontWeight:700, fontFamily:'inherit', padding:0, flex:1, minWidth:0 }} />
              <div style={{ fontSize:13, fontWeight:700, color:C.gold, flexShrink:0 }}>{total.toLocaleString()}</div>
            </div>
            <div style={{ height:5, borderRadius:3, background:C.border, overflow:'hidden', marginBottom:10 }}>
              <div style={{ width:`${pctOfMax}%`, height:'100%', background:C.gold, borderRadius:3, transition:'width 300ms ease' }}/>
            </div>
            {allMemberIds.length === 0 ? (
              <div style={{ fontSize:12, color:C.muted }}>Empty</div>
            ) : allMemberIds.map(pid => {
              const isLeader = pid === squad.leaderId;
              const player = players.find(p => p.id === pid);
              const power = player ? getPower(player) : null;
              return (
                <div key={pid} style={{ position:'relative' }}>
                  <div onClick={() => setMovingPlayerId(movingPlayerId === pid ? null : pid)}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', cursor:'pointer' }}>
                    <div style={{ width:26, height:26, borderRadius:'50%', background:(isLeader?C.gold:C.muted)+'33', border:`1.5px solid ${isLeader?C.gold:C.muted}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:11, color:C.white, flexShrink:0 }}>
                      {initials(playerName(pid))}
                    </div>
                    {isLeader && <span style={{ fontSize:11 }}>👑</span>}
                    <span style={{ fontSize:13, color:C.white, flex:1 }}>{playerName(pid)}</span>
                    <span style={{ fontSize:12, color:power!=null?C.icy:C.muted }}>{power!=null ? power.toLocaleString() : 'no power'}</span>
                    <span style={{ fontSize:11, color:C.gold }}>⇄</span>
                  </div>
                  {movingPlayerId === pid && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:'4px 0 8px 34px' }}>
                      {squads.filter(s => s.id !== squad.id).map(s => (
                        <button key={s.id} onClick={() => moveMember(pid, squad.id, s.id)}
                          style={{ padding:'5px 10px', borderRadius:14, background:C.card, border:`1px solid ${C.border}`, color:C.icy, fontSize:12, cursor:'pointer' }}>
                          → {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <button onClick={clearSquads} style={{ width:'100%', height:40, borderRadius:10, background:'none', border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', marginTop:4 }}>
        Clear teams
      </button>
    </div>
  );
}
