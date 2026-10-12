import {C,EVENT_ICONS,JOINER_COVERAGE_EVENTS} from '../../../utils/constants.js';
import {ChecklistManagerSheet} from './ChecklistManagerSheet.jsx';
export function PlanOutputs({plan,slots,readySlots,summaryText,setSummaryText,generateSummary,copySummary,summaryCopied,regenerateSummary,linkedEvent,unallocated,unallocatedEligible,unallocatedIneligible,checklist,autoFlags,setChecklistManagerOpen,updPlan,copyChecklist,checklistCopied,checklistManagerOpen,onSaveChecklist,onGoLive}) {
 return <>

      {readySlots.length > 0 && (
        <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:8 }}>📋 Plan Summary</div>
          <textarea
            value={summaryText ?? generateSummary()}
            onChange={e => setSummaryText(e.target.value)}
            style={{ width:'100%', minHeight:140, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13, color:C.white, resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }}
          />
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button onClick={copySummary}
              style={{ flex:2, height:44, borderRadius:10, background:summaryCopied?C.green+'18':C.gold+'18', border:`1px solid ${summaryCopied?C.green:C.gold}44`, color:summaryCopied?C.green:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {summaryCopied ? '✓ Copied' : '📋 Copy summary'}
            </button>
            <button onClick={regenerateSummary}
              style={{ flex:1, height:44, borderRadius:10, background:'none', border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
              ↺ Reset
            </button>
          </div>
        </div>
      )}


      {slots.length > 0 && (
        <div style={{ background:C.section, borderRadius:12, padding:14, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.icy, marginBottom:2 }}>🔁 Unallocated</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>{linkedEvent ? 'Attending members' : 'Members'} not leading or already used as a priority joiner in this plan.</div>
          {unallocated.length === 0 ? (
            <div style={{ fontSize:12, color:C.muted }}>Everyone available is already allocated somewhere in this plan.</div>
          ) : (
            <>
              {unallocatedEligible.length > 0 && (
                <div style={{ marginBottom: unallocatedIneligible.length > 0 ? 12 : 0 }}>
                  <div style={{ fontSize:10, color:C.green, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>✓ Eligible — has joiner heroes</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {unallocatedEligible.map(p => {
                      const heroes = (p.joinerHeroes || []).filter(jh => jh.skillLevel >= 5).map(jh => jh.hero);
                      return (
                        <div key={p.id} style={{ padding:'6px 12px', borderRadius:16, background:C.card, border:`1px solid ${C.green}44` }}>
                          <span style={{ fontSize:13, fontWeight:600, color:C.white }}>{p.username || p.alias || '?'}</span>
                          <span style={{ fontSize:11, color:C.gold, marginLeft:6 }}>{heroes.slice(0,2).join(', ')}{heroes.length > 2 ? ` +${heroes.length-2}` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {unallocatedIneligible.length > 0 && (
                <div>
                  <div style={{ fontSize:10, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>✗ Not currently eligible — no joiner heroes recorded</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {unallocatedIneligible.map(p => (
                      <div key={p.id} style={{ padding:'6px 12px', borderRadius:16, background:C.card, border:`1px solid ${C.border}`, opacity:0.7 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:C.muted }}>{p.username || p.alias || '?'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}


      <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white }}>📋 Leadership Checklist</div>
          <button onClick={() => setChecklistManagerOpen(true)} style={{ background:'none', border:'none', color:C.gold, fontSize:12, fontWeight:600, cursor:'pointer' }}>Manage</button>
        </div>

        <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:14, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
          {autoFlags.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:C.gold, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>⚠ Needs attention</div>
              {autoFlags.map(flag => (
                <div key={flag.id} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'6px 0' }}>
                  <span style={{ fontSize:13, color:flag.type==='coverage'?C.red:C.gold, flexShrink:0 }}>{flag.type==='coverage'?'⚠':'❓'}</span>
                  <span style={{ fontSize:13, color:C.icy }}>{flag.text}</span>
                </div>
              ))}
            </div>
          )}

          {checklist.length === 0 ? (
            <div style={{ fontSize:13, color:C.muted }}>No checklist items yet. Tap Manage to add some — e.g. "Rally leads briefed", "Formations locked", "Backup joiners identified".</div>
          ) : (
            checklist.map(item => {
              const checked = !!(plan.checklist || {})[item.id];
              return (
                <div key={item.id} onClick={() => updPlan({ checklist:{ ...(plan.checklist || {}), [item.id]:!checked } })}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', cursor:'pointer' }}>
                  <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${checked?C.green:C.border}`, background:checked?C.green+'33':'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {checked && <span style={{ color:C.green, fontSize:13, fontWeight:700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:14, color:checked?C.muted:C.white, textDecoration:checked?'line-through':'none' }}>{item.name}</span>
                </div>
              );
            })
          )}
        </div>

        {(autoFlags.length > 0 || checklist.length > 0) && (
          <button onClick={copyChecklist}
            style={{ width:'100%', height:44, borderRadius:10, marginTop:10, background:checklistCopied?C.green+'18':C.gold+'18', border:`1px solid ${checklistCopied?C.green:C.gold}44`, color:checklistCopied?C.green:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
            {checklistCopied ? '✓ Copied' : '📋 Copy checklist'}
          </button>
        )}
      </div>

      <ChecklistManagerSheet
        open={checklistManagerOpen}
        onClose={() => setChecklistManagerOpen(false)}
        items={checklist}
        onSaveItems={onSaveChecklist}
      />


      {readySlots.length > 0 && (
        <div style={{ position:'fixed', bottom:60, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, background:C.bg, borderTop:`1px solid ${C.border}`, padding:'12px 20px 16px', boxSizing:'border-box', zIndex:50 }}>
          <button onClick={() => onGoLive(plan)} style={{ width:'100%', height:56, borderRadius:12, background:C.red, color:'#fff', fontWeight:800, fontSize:17, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            🔴 Go Live — {readySlots.length} slot{readySlots.length !== 1 ? 's' : ''}
            <span style={{ fontSize:13, fontWeight:400, opacity:0.8 }}>
              {readySlots.map(s => s.leaderName).join(' · ')}
            </span>
          </button>
        </div>
      )}
 </>;
}
