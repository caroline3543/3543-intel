import {C} from '../../../utils/constants.js';
import {FormationPicker} from './FormationPicker.jsx';
import {RatioPicker} from './RatioPicker.jsx';
export function RallyLeaderSetup({linkedEvent,players,onGoToMembers,slot,changingLeader,setChangingLeader,color,attendingMembers,selectLeader,upd,joinerEligiblePlayers,events,selectedGenerations,leaderPlayer,allAssignedIds}) {
return <>
          {linkedEvent ? (
            <>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:14, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Rally leader</label>
                {players.length === 0 ? (
                  <div style={{ fontSize:13, color:C.muted, padding:'8px 0' }}>
                    No members yet.{' '}
                    <button onClick={onGoToMembers} style={{ background:'none', border:'none', color:C.gold, fontSize:13, cursor:'pointer', padding:0, textDecoration:'underline' }}>Go to Members →</button>
                  </div>
                ) : slot.leaderId && !changingLeader ? (

                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:color+'14', border:`1px solid ${color}44`, borderRadius:12, padding:'12px 14px' }}>
                    <div>
                      <div style={{ fontSize:14, color:C.muted, marginBottom:2 }}>Leading this rally</div>
                      <div style={{ fontSize:16, fontWeight:800, color:C.white }}>{slot.leaderName}</div>
                    </div>
                    <button onClick={() => setChangingLeader(true)}
                      style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:16, padding:'6px 14px', color:C.gold, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                      Change
                    </button>
                  </div>
                ) : attendingMembers.length === 0 ? (
                  <div style={{ fontSize:13, color:C.gold, padding:'8px 0' }}>
                    ⚠ No one{slot.allianceTag ? ` from [${slot.allianceTag}]` : ''} is marked attending this event yet. Update RSVPs in the Events tab.
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize:14, color:C.gold, fontWeight:600, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                      <span>👇</span> Tap a name below to select as leader
                    </div>
                    {attendingMembers.filter(p => p.roles?.includes('Rally Lead')).length > 0 && (
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:14, color:C.gold, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Rally leads</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          {attendingMembers.filter(p => p.roles?.includes('Rally Lead')).map(p => {
                            const sel = slot.leaderId === p.id;
                            return (
                              <button key={p.id} onClick={() => selectLeader(p)}
                                style={{ minHeight:44, padding:'7px 14px', borderRadius:20, border:`1px solid ${sel?color:C.gold+'44'}`, background:sel?color+'22':C.gold+'0a', color:sel?color:C.gold, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                                {p.username||p.alias}{p.furnaceLevel ? ` · ${p.furnaceLevel}` : ''}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {attendingMembers.filter(p => !p.roles?.includes('Rally Lead')).length > 0 && (
                      <div>
                        <div style={{ fontSize:14, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Other attending members</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          {attendingMembers.filter(p => !p.roles?.includes('Rally Lead')).map(p => {
                            const sel = slot.leaderId === p.id;
                            return (
                              <button key={p.id} onClick={() => selectLeader(p)}
                                style={{ minHeight:44, padding:'7px 14px', borderRadius:20, border:`1px solid ${sel?color:C.border}`, background:sel?color+'22':C.section, color:sel?color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                                {p.username||p.alias}{p.furnaceLevel ? ` · ${p.furnaceLevel}` : ''}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {attendingMembers.filter(p => p.roles?.includes('Rally Lead')).length === 0 && (
                      <div style={{ fontSize:14, color:C.muted, marginTop:4 }}>
                        No attending members have the Rally Lead role.{' '}
                        <button onClick={onGoToMembers} style={{ background:'none', border:'none', color:C.gold, fontSize:14, cursor:'pointer', padding:0, textDecoration:'underline' }}>Assign roles in Members →</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <FormationPicker
                slot={slot}
                upd={upd}
                color={color}
                players={joinerEligiblePlayers}
                events={events}
                selectedGenerations={selectedGenerations}
                leaderPlayer={leaderPlayer}
                assignedInOtherSlots={allAssignedIds}
              />

              <RatioPicker slot={slot} upd={upd} />
            </>
          ) : (
            <div style={{ background:C.section, borderRadius:12, padding:14, marginBottom:14, textAlign:'center' }}>
              <div style={{ fontSize:13, color:C.muted }}>🔗 Link this plan to an event above to plan leader, formations, and priority joiners — eligibility needs real attendance data.</div>
            </div>
          )}

 </>;
}
