import {C,EVENT_ICONS,JOINER_COVERAGE_EVENTS} from '../../../utils/constants.js';
import {ChecklistManagerSheet} from './ChecklistManagerSheet.jsx';
export function PlanHeader({plan,onBack,updPlan,eventPickerOpen,setEventPickerOpen,linkedEvent,linkableEvents}) {
 return <>

      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:4, padding:0 }}>
        ← Battle Plans
      </button>
      <div style={{ fontSize:14, color:C.muted, marginBottom:16 }}>{plan.name || 'Battle Plan'}</div>


      <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:C.white }}>{plan.name || 'Battle Plan'}</div>
            <div style={{ fontSize:13, color:C.muted }}>{plan.date}{plan.allianceTag ? ` · [${plan.allianceTag}]` : ''}</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {[['draft','Draft',C.muted],['live','🔴 Live',C.red],['completed','✓ Done',C.green]].map(([s,l,c]) => (
              <button key={s} onClick={() => updPlan({ status:s })}
                style={{ minHeight:44, padding:'0 12px', borderRadius:14, border:`1px solid ${plan.status===s?c:C.border}`, background:plan.status===s?c+'22':C.section, color:plan.status===s?c:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={plan.notes || ''}
          onChange={e => updPlan({ notes:e.target.value })}
          placeholder="Strategy overview — target, objective, key timings…"
          style={{ width:'100%', minHeight:60, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}
        />
      </div>


      <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Linked event</div>
        {linkedEvent ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{EVENT_ICONS[linkedEvent.type] || '📋'} {linkedEvent.name || linkedEvent.type}</div>
              <div style={{ fontSize:14, color:C.muted }}>{linkedEvent.date}</div>
            </div>
            <button onClick={() => setEventPickerOpen(!eventPickerOpen)}
              style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:16, padding:'6px 14px', color:C.gold, fontWeight:600, fontSize:14, cursor:'pointer' }}>
              {eventPickerOpen ? 'Cancel' : 'Change'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:13, color:C.red, fontWeight:600, marginBottom:10 }}>⚠ No event linked — leader and joiner planning is locked until you link one.</div>
            <button onClick={() => setEventPickerOpen(!eventPickerOpen)}
              style={{ width:'100%', height:44, borderRadius:10, background:C.gold+'18', border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
              🔗 Link an event
            </button>
          </div>
        )}
        {eventPickerOpen && (
          <div style={{ marginTop:10, maxHeight:220, overflowY:'auto' }}>
            {linkableEvents.length === 0 ? (
              <div style={{ fontSize:14, color:C.muted, textAlign:'center', padding:'10px 0' }}>No upcoming or active events yet. Create one in the Events tab first.</div>
            ) : (
              linkableEvents.map(ev => (
                <button key={ev.id} onClick={() => { updPlan({ eventId:ev.id }); setEventPickerOpen(false); }}
                  style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 12px', borderRadius:8, background:C.section, border:`1px solid ${plan.eventId===ev.id?C.gold:C.border}`, color:C.white, fontSize:13, marginBottom:6, cursor:'pointer' }}>
                  {EVENT_ICONS[ev.type] || '📋'} {ev.name || ev.type} · {ev.date}
                </button>
              ))
            )}
          </div>
        )}
      </div>

 </>;
}
