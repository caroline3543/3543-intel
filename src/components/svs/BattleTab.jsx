import { useState, useEffect } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newSvsPlan, newRallySlot, newJoinerSlot } from '../../data/playerSchema.js';
import { SheetHandle, Field } from '../common/Primitives.jsx';
import { AlliancePicker } from '../common/AlliancePicker.jsx';
import { LiveRallyRoom } from './LiveRallyRoom.jsx';

const RALLY_TYPES = ['Main Rally','Counter Rally','Counter-Counter','Switch Fight','Garrison Entry','Reinforcement','Custom'];
const RALLY_COLORS = {
  'Main Rally':'#F5A623','Counter Rally':'#FF453A','Counter-Counter':'#FF8C00',
  'Switch Fight':'#30D158','Garrison Entry':'#6B8CAE','Reinforcement':'#7BAE8C','Custom':'#A8C4D8',
};
const RATIO_PRESETS = ['60/40/0','50/20/30','48/4/48','40/60/0','60/0/40','0/40/60','50/50/0','Custom'];
const RALLY_DURATIONS = [1,3,5];

// ── Joiner Slot ────────────────────────────────────────────────
function JoinerSlotRow({ slot, index, players, onUpdate, onMarkUnavailable }) {
  const [open, setOpen] = useState(false);

  const player = players.find(p => p.id === slot.playerId);
  const playerJoiners = player
    ? (player.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).map(jh=>jh.hero)
    : [];

  // Auto-suggest replacement
  const assignedIds = new Set(); // passed from parent ideally
  const suggestions = !slot.confirmed && slot.playerId
    ? players
        .filter(p => p.id !== slot.playerId && p.availability?.present==='available')
        .filter(p => (p.joinerHeroes||[]).some(jh=>jh.hero===slot.heroName&&jh.skillLevel>=5))
        .slice(0,3)
    : [];

  return (
    <div style={{ background:C.bg, borderRadius:10, marginBottom:6 }}>
      <div onClick={()=>setOpen(!open)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', cursor:'pointer' }}>
        <div style={{ width:22, height:22, borderRadius:'50%', background:C.border, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:C.muted, flexShrink:0 }}>{index+1}</div>
        <div style={{ flex:1, minWidth:0 }}>
          {slot.playerName ? (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:14, fontWeight:700, color:slot.confirmed===false&&slot.playerId?C.red:C.white, textDecoration:slot.confirmed===false&&slot.playerId?'line-through':'none' }}>
                {slot.playerName}
              </span>
              {slot.heroName&&<span style={{ fontSize:12, color:C.gold, fontWeight:600 }}>→ {slot.heroName}</span>}
              {slot.confirmed===false&&slot.playerId&&<span style={{ fontSize:11, color:C.red }}>Unavailable</span>}
              {slot.replacedBy&&<span style={{ fontSize:11, color:C.green }}>→ {slot.replacedBy.playerName}</span>}
            </div>
          ) : (
            <span style={{ fontSize:14, color:C.muted }}>Tap to assign joiner {index+1}</span>
          )}
        </div>
        <span style={{ color:C.muted, fontSize:14 }}>{open?'▲':'▼'}</span>
      </div>

      {open&&(
        <div style={{ padding:'0 12px 12px' }}>
          {/* Player picker */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Member</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, maxHeight:120, overflowY:'auto' }}>
              {players.filter(p=>p.availability?.present!=='unavailable').map(p=>{
                const sel = slot.playerId===p.id;
                return (
                  <button key={p.id} onClick={()=>onUpdate({...slot,playerId:p.id,playerName:p.username||p.alias||'',heroName:'',confirmed:true,replacedBy:null})}
                    style={{ padding:'5px 10px', borderRadius:14, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.icy, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                    {p.username||p.alias}
                    {(p.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).length>0&&<span style={{ fontSize:10, color:C.muted }}> ·{(p.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).length}🦸</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hero picker — only shows heroes this player has at Skill 5 */}
          {playerJoiners.length>0&&(
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Hero to bring</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {playerJoiners.map(hero=>{
                  const sel=slot.heroName===hero;
                  return (
                    <button key={hero} onClick={()=>onUpdate({...slot,heroName:hero})}
                      style={{ padding:'5px 10px', borderRadius:14, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.icy, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                      ✓ {hero}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mark unavailable + replacement */}
          {slot.playerId&&(
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>onUpdate({...slot,confirmed:slot.confirmed===false?true:false})}
                style={{ flex:1, height:34, borderRadius:8, border:`1px solid ${slot.confirmed===false?C.green:C.red}44`, background:slot.confirmed===false?C.green+'18':C.red+'18', color:slot.confirmed===false?C.green:C.red, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                {slot.confirmed===false?'✓ Mark available':'⚠ Mark unavailable'}
              </button>
              <button onClick={()=>onUpdate({...slot,playerId:null,playerName:'',heroName:'',confirmed:true,replacedBy:null})}
                style={{ height:34, padding:'0 12px', borderRadius:8, border:`1px solid ${C.border}`, background:'none', color:C.muted, fontSize:12, cursor:'pointer' }}>
                Clear
              </button>
            </div>
          )}

          {/* Auto-suggest replacements */}
          {slot.confirmed===false&&suggestions.length>0&&(
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:11, color:C.gold, fontWeight:700, marginBottom:6 }}>Suggested replacements (have {slot.heroName}):</div>
              {suggestions.map(p=>(
                <button key={p.id} onClick={()=>onUpdate({...slot,replacedBy:{playerId:p.id,playerName:p.username||p.alias,heroName:slot.heroName}})}
                  style={{ display:'block', width:'100%', padding:'7px 10px', marginBottom:4, borderRadius:8, border:`1px solid ${C.green}44`, background:C.green+'18', color:C.green, fontWeight:600, fontSize:13, cursor:'pointer', textAlign:'left' }}>
                  ＋ {p.username||p.alias} → {slot.heroName} {p.furnaceLevel?`· ${p.furnaceLevel}`:''}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Rally Slot Card ────────────────────────────────────────────
function RallySlotCard({ slot, index, players, onUpdate, onDelete }) {
  const [open, setOpen] = useState(index===0);

  const color  = RALLY_COLORS[slot.type]||C.gold;
  const leader = players.find(p=>p.id===slot.leaderId);

  function upd(patch) { onUpdate({...slot,...patch}); }
  function updJoiner(i,patch) {
    const joiners=[...slot.joiners];
    joiners[i]={...joiners[i],...patch};
    upd({joiners});
  }

  const filledJoiners = slot.joiners.filter(j=>j.playerName).length;

  return (
    <div style={{ background:C.card, borderRadius:14, marginBottom:12, border:`1px solid ${color}44`, overflow:'hidden' }}>
      {/* Header */}
      <div onClick={()=>setOpen(!open)} style={{ padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:12 }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:color, flexShrink:0, marginTop:5 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{slot.type}</div>
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:color+'22', color, fontWeight:700 }}>{slot.rallyDuration}min</span>
          </div>
          <div style={{ fontSize:13, color:C.icy }}>
            {slot.leaderName||<span style={{ color:C.muted }}>No leader assigned</span>}
            {slot.ratio&&<span style={{ color:C.muted }}> · {slot.ratio}</span>}
            <span style={{ color:C.muted }}> · {filledJoiners}/4 joiners</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={e=>{e.stopPropagation();onDelete(slot.id);}} style={{ background:'none', border:'none', color:C.red+'88', fontSize:18, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
          <span style={{ color:C.muted, fontSize:16 }}>{open?'▲':'▼'}</span>
        </div>
      </div>

      {open&&(
        <div style={{ padding:'0 16px 16px', borderTop:`1px solid ${C.border}22` }}>

          {/* Rally type */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Type</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {RALLY_TYPES.map(type=>{ const sel=slot.type===type; const c=RALLY_COLORS[type]; return (
                <button key={type} onClick={()=>upd({type})} style={{ padding:'6px 12px', borderRadius:16, border:`1px solid ${sel?c:C.border}`, background:sel?c+'22':C.section, color:sel?c:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>{type}</button>
              ); })}
            </div>
          </div>

          {/* Leader */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Rally leader</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {players.filter(p=>p.roles?.includes('Rally Lead')||p.roles?.includes('Flexible')).map(p=>{
                const sel=slot.leaderId===p.id;
                return (
                  <button key={p.id} onClick={()=>upd({leaderId:p.id,leaderName:p.username||p.alias})}
                    style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${sel?color:C.border}`, background:sel?color+'22':C.section, color:sel?color:C.icy, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                    {p.username||p.alias} {p.furnaceLevel?`· ${p.furnaceLevel}`:''}
                  </button>
                );
              })}
              {players.filter(p=>p.roles?.includes('Rally Lead')||p.roles?.includes('Flexible')).length===0&&(
                <div style={{ fontSize:13, color:C.muted }}>No Rally Lead roles assigned — add roles in member profiles</div>
              )}
            </div>
          </div>

          {/* Rally duration */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Rally duration</label>
            <div style={{ display:'flex', gap:8 }}>
              {RALLY_DURATIONS.map(d=>(
                <button key={d} onClick={()=>upd({rallyDuration:d})}
                  style={{ flex:1, height:44, borderRadius:10, border:`1px solid ${slot.rallyDuration===d?color:C.border}`, background:slot.rallyDuration===d?color+'22':C.section, color:slot.rallyDuration===d?color:C.muted, fontWeight:700, fontSize:15, cursor:'pointer' }}>
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Troop ratio */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Troop ratio (Inf/Lan/Mar)</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {RATIO_PRESETS.map(r=>{
                const sel=slot.ratio===r;
                return (
                  <button key={r} onClick={()=>upd({ratio:r})}
                    style={{ padding:'6px 12px', borderRadius:16, border:`1px solid ${sel?C.icy:C.border}`, background:sel?C.icy+'22':C.section, color:sel?C.icy:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority joiners */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Priority joiners <span style={{ color:C.muted, fontWeight:400 }}>(must join first with specified hero)</span></label>
            <div style={{ background:C.section, borderRadius:10, padding:10 }}>
              {slot.joiners.map((joiner,i)=>(
                <JoinerSlotRow key={joiner.id} slot={joiner} index={i} players={players} onUpdate={patch=>updJoiner(i,patch)}/>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Notes</label>
            <textarea value={slot.notes||''} onChange={e=>upd({notes:e.target.value})} placeholder="Strategy notes…"
              style={{ width:'100%', minHeight:64, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:14, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Plan Create Sheet ──────────────────────────────────────────
function PlanCreateSheet({ open, onClose, onSave, existingTags }) {
  const [name, setName]         = useState('');
  const [allianceTag, setTag]   = useState('');
  const [date, setDate]         = useState(new Date().toISOString().slice(0,10));

  useEffect(()=>{
    if (!open) return;
    function h(e){ if(e.key==='Escape') onClose(); }
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h);
  },[open,onClose]);

  if (!open) return null;
  function save() {
    onSave(newSvsPlan({name:name||'Battle Plan',allianceTag,date}));
    setName(''); setTag(''); setDate(new Date().toISOString().slice(0,10));
    onClose(); vibe(8);
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'16px 20px 80px' }}>
        <SheetHandle/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>New Battle Plan</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>
        <Field label="Plan name">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. SvS Week 3 Defence"
            style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
        </Field>
        <Field label="Alliance">
          <AlliancePicker value={allianceTag} onChange={setTag} existingTags={existingTags}/>
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
        </Field>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={save} style={{ flex:2, height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Create Plan</button>
        </div>
      </div>
    </div>
  );
}

// ── Plan Detail ────────────────────────────────────────────────
function PlanDetail({ plan, players, onUpdate, onBack, onGoLive }) {
  function updPlan(patch) { onUpdate({...plan,...patch}); }

  function addSlot() {
    const slot = newRallySlot({ type: plan.rallySlots?.length===0?'Main Rally':'Counter Rally' });
    updPlan({rallySlots:[...(plan.rallySlots||[]),slot]});
    vibe(8);
  }

  function updSlot(updated) { updPlan({rallySlots:(plan.rallySlots||[]).map(s=>s.id===updated.id?updated:s)}); }
  function delSlot(id)      { updPlan({rallySlots:(plan.rallySlots||[]).filter(s=>s.id!==id)}); }

  const slots = plan.rallySlots || [];
  const readySlots = slots.filter(s=>s.leaderName);

  return (
    <div style={{ padding:'16px 20px 0' }}>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:16, padding:0 }}>
        ← Back to Plans
      </button>

      {/* Plan header */}
      <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:C.white }}>{plan.name||'Battle Plan'}</div>
            <div style={{ fontSize:13, color:C.muted }}>{plan.date}{plan.allianceTag?` · [${plan.allianceTag}]`:''}</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {['draft','live','completed'].map(s=>(
              <button key={s} onClick={()=>updPlan({status:s})} style={{ height:30, padding:'0 10px', borderRadius:14, border:`1px solid ${plan.status===s?C.gold:C.border}`, background:plan.status===s?C.gold+'22':C.section, color:plan.status===s?C.gold:C.muted, fontWeight:600, fontSize:11, cursor:'pointer' }}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Rally slots */}
      {slots.map((slot,i)=>(
        <RallySlotCard key={slot.id} slot={slot} index={i} players={players} onUpdate={updSlot} onDelete={delSlot}/>
      ))}

      <button onClick={addSlot} style={{ width:'100%', height:48, borderRadius:12, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', marginBottom:16 }}>
        ＋ Add rally slot
      </button>

      {/* Notes */}
      <div style={{ marginBottom:16 }}>
        <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Plan notes</label>
        <textarea value={plan.notes||''} onChange={e=>updPlan({notes:e.target.value})} placeholder="Strategy overview, target info…"
          style={{ width:'100%', minHeight:80, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:15, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
      </div>

      {/* Go Live button */}
      {readySlots.length>0&&(
        <button onClick={()=>onGoLive(plan)} style={{ width:'100%', height:56, borderRadius:12, background:C.red, color:'#fff', fontWeight:800, fontSize:17, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          🔴 Go Live — {readySlots.length} rally slot{readySlots.length!==1?'s':''}
        </button>
      )}
    </div>
  );
}

// ── BattleTab ──────────────────────────────────────────────────
export function BattleTab({ plans, players, events, onSave, onDelete, showToast }) {
  const [view, setView]             = useState('plans');
  const [activePlanId, setActivePlanId] = useState(null);
  const [createOpen, setCreateOpen]     = useState(false);
  const [liveRoomPlan, setLiveRoomPlan] = useState(null);

  const activePlan = plans.find(p=>p.id===activePlanId);

  const existingTags = [...new Set(players.map(p=>p.allianceTag).filter(Boolean))];

  function createPlan(plan) { onSave([...plans,plan]); setActivePlanId(plan.id); showToast('Plan created ✓'); }
  function updatePlan(updated) { onSave(plans.map(p=>p.id===updated.id?updated:p)); }
  function deletePlan(id) {
    if (!window.confirm('Delete this plan?')) return;
    onDelete(id); setActivePlanId(null); showToast('Plan deleted');
  }
  function duplicatePlan(plan) {
    const copy={...plan,id:Math.random().toString(36).slice(2)+Date.now().toString(36),name:`${plan.name||'Plan'} (copy)`,status:'draft',createdAt:new Date().toISOString()};
    onSave([...plans,copy]); showToast('Plan duplicated ✓'); vibe(8);
  }

  function handleGoLive(plan) {
    setLiveRoomPlan(plan);
    setView('liveRoom');
  }

  if (view==='liveRoom') {
    return <LiveRallyRoom onBack={()=>setView('plans')} players={players} planData={liveRoomPlan}/>;
  }

  if (activePlan) {
    return <PlanDetail plan={activePlan} players={players} onUpdate={updatePlan} onBack={()=>setActivePlanId(null)} onGoLive={handleGoLive}/>;
  }

  return (
    <div style={{ padding:'16px 20px 0' }}>
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <button onClick={()=>setCreateOpen(true)} style={{ flex:2, height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>＋ New Plan</button>
        <button onClick={()=>{ setLiveRoomPlan(null); setView('liveRoom'); }} style={{ flex:1, height:52, borderRadius:12, background:C.red+'22', border:`1px solid ${C.red}44`, color:C.red, fontWeight:700, fontSize:14, cursor:'pointer' }}>🔴 Live Room</button>
      </div>

      {plans.length===0&&(
        <div style={{ textAlign:'center', padding:'40px 20px' }}>
          <div style={{ fontSize:52, marginBottom:16 }}>⚔️</div>
          <div style={{ fontSize:18, fontWeight:700, color:C.white, marginBottom:8 }}>No plans yet</div>
          <div style={{ fontSize:15, color:C.muted, marginBottom:24 }}>Build your rally assignments before the battle. Assign leaders, joiners, and heroes. Then go live.</div>
          <button onClick={()=>setCreateOpen(true)} style={{ height:52, padding:'0 32px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>＋ Create first plan</button>
        </div>
      )}

      {plans.map(plan=>(
        <div key={plan.id} onClick={()=>setActivePlanId(plan.id)} style={{ background:C.card, borderRadius:12, padding:'14px 16px', marginBottom:10, cursor:'pointer', border:`1px solid ${plan.status==='live'?C.red+'66':C.border+'44'}`, WebkitTapHighlightColor:'transparent' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:16, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{plan.name||'Battle Plan'}</div>
              <div style={{ fontSize:12, color:C.muted }}>{plan.date}{plan.allianceTag?` · [${plan.allianceTag}]`:''}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
              <span style={{ fontSize:11, fontWeight:700, color:plan.status==='live'?C.red:plan.status==='completed'?C.muted:C.icy, padding:'2px 8px', borderRadius:10, background:(plan.status==='live'?C.red:plan.status==='completed'?C.muted:C.icy)+'18' }}>
                {plan.status==='live'?'🔴 Live':plan.status==='completed'?'✓ Done':'Draft'}
              </span>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={e=>{e.stopPropagation();duplicatePlan(plan);}} style={{ fontSize:11, color:C.icy, background:'none', border:'none', cursor:'pointer' }}>Duplicate</button>
                <button onClick={e=>{e.stopPropagation();deletePlan(plan.id);}} style={{ fontSize:11, color:C.red+'88', background:'none', border:'none', cursor:'pointer' }}>Delete</button>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, fontSize:12, color:C.muted }}>
            <span>⚔️ {(plan.rallySlots||[]).length} rally slots</span>
            <span>👥 {(plan.rallySlots||[]).reduce((acc,s)=>acc+s.joiners.filter(j=>j.playerName).length,0)} joiners assigned</span>
          </div>
        </div>
      ))}

      <PlanCreateSheet open={createOpen} onClose={()=>setCreateOpen(false)} onSave={createPlan} existingTags={existingTags}/>
    </div>
  );
}
