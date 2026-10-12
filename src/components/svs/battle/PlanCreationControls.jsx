import {C,EVENT_ICONS,JOINER_COVERAGE_EVENTS} from '../../../utils/constants.js';
import {ChecklistManagerSheet} from './ChecklistManagerSheet.jsx';
export function PlanCreationControls({linkedEvent,slots,turretCount,setTurretCount,castleCount,setCastleCount,createAndAutoFillLeaders,plan,updPlan,autoFillPlan,confirmAutoFill,setConfirmAutoFill,autoFillResult}) {
 return <>

      {linkedEvent && JOINER_COVERAGE_EVENTS.includes(linkedEvent.type) && (
        <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:4 }}>➕ Create Rally Slots</div>
          <div style={{ fontSize:14, color:C.muted, marginBottom:12 }}>
            How many rally leaders do you need, and for what? Creates the slots and auto-fills them immediately.
          </div>
          <div style={{ display:'flex', gap:12, marginBottom:12 }}>
            {[['🗼 Turret', turretCount, setTurretCount], ['🏰 Castle', castleCount, setCastleCount]].map(([label, val, setVal]) => (
              <div key={label} style={{ flex:1, background:C.section, borderRadius:10, padding:10, textAlign:'center' }}>
                <div style={{ fontSize:14, color:C.icy, fontWeight:600, marginBottom:6 }}>{label}</div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                  <button onClick={() => setVal(Math.max(0, val - 1))}
                    style={{ minWidth:44, minHeight:44, borderRadius:8, border:`1px solid ${C.border}`, background:C.card, color:C.icy, fontSize:16, fontWeight:700, cursor:'pointer' }}>−</button>
                  <div style={{ fontSize:18, fontWeight:800, color:C.white, minWidth:20 }}>{val}</div>
                  <button onClick={() => setVal(val + 1)}
                    style={{ minWidth:44, minHeight:44, borderRadius:8, border:`1px solid ${C.border}`, background:C.card, color:C.icy, fontSize:16, fontWeight:700, cursor:'pointer' }}>+</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={createAndAutoFillLeaders} disabled={turretCount + castleCount === 0}
            style={{ width:'100%', height:48, borderRadius:12, background:(turretCount+castleCount)>0?C.gold:C.section, border:(turretCount+castleCount)>0?'none':`1px solid ${C.border}`, color:(turretCount+castleCount)>0?C.bg:C.muted, fontWeight:700, fontSize:14, cursor:(turretCount+castleCount)>0?'pointer':'default' }}>
            {turretCount + castleCount > 0 ? `Preview ${turretCount + castleCount} slot${turretCount+castleCount!==1?'s':''} & Auto-Fill` : 'Set a count above'}
          </button>
        </div>
      )}

      {linkedEvent&&slots.length>0&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}><button onClick={()=>autoFillPlan(undefined,true)} style={{minHeight:44,padding:'8px 14px',background:C.section,border:`1px solid ${C.border}`,borderRadius:10,color:C.gold,fontSize:14}}>Preview rebalance unlocked</button><select aria-label="Allocation strategy" value={plan.allocationMode||'balanced'} onChange={e=>updPlan({allocationMode:e.target.value})} style={{minHeight:44,maxWidth:'100%',background:C.section,border:`1px solid ${C.border}`,borderRadius:10,color:C.icy,fontSize:16}}><option value="balanced">Balanced wave</option><option value="castle">Prioritise main castle rally</option></select></div>}

      {linkedEvent && slots.length > 0 && (
        <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:4 }}>⚡ Auto-Fill Available Pool</div>
          <div style={{ fontSize:14, color:C.muted, marginBottom:12 }}>
            Castle leaders first. Preview available heroes and balanced troop fillers. Existing assignments stay put.
          </div>
          <button onClick={() => confirmAutoFill ? autoFillPlan() : setConfirmAutoFill(true)}
            style={{ width:'100%', height:48, borderRadius:12, background:confirmAutoFill?C.gold:C.section, border:confirmAutoFill?'none':`1px solid ${C.border}`, color:confirmAutoFill?C.bg:C.icy, fontWeight:700, fontSize:14, cursor:'pointer' }}>
            {confirmAutoFill ? 'Preview allocation' : '⚡ Auto-Fill Empty Slots'}
          </button>
          {autoFillResult && (
            <div style={{ fontSize:14, color:C.muted, marginTop:8, textAlign:'center' }}>
              Filled {autoFillResult.leadersFilled} leader{autoFillResult.leadersFilled!==1?'s':''}, set {autoFillResult.heroesSet} required joiner hero{autoFillResult.heroesSet!==1?'es':''}, and assigned {autoFillResult.joinersFilled} joiner{autoFillResult.joinersFilled!==1?'s':''}. Open any rally to review or swap picks.
            </div>
          )}
        </div>
      )}

 </>;
}
