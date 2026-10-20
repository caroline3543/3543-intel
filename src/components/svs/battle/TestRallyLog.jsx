import { useState } from 'react';
import { C } from '../../../utils/constants.js';
import { newTestRallyEntry } from '../../../data/playerSchema.js';

// ── TestRallyLog ───────────────────────────────────────────────
// Real-battle results logged against a formation — who the leader
// fought, the enemy's ratio/heroes/joiners, and the outcome. Builds
// real data over time, same spirit as the "unverified since the
// update" caveat on formations in joinerMeta.js.
//
// Props:
//   entries  – slot.testRallies array
//   onChange – (updatedEntries[]) => void
export function TestRallyLog({ entries = [], onChange }) {
  const [open, setOpen]         = useState(false);
  const [adding, setAdding]     = useState(false);
  const [draft, setDraft]       = useState(() => newTestRallyEntry());
  const [confirmDelete, setConfirmDelete] = useState(null);

  function startAdd() { setDraft(newTestRallyEntry()); setAdding(true); }
  function saveDraft() {
    if (!draft.opponent && !draft.enemyRatio && !draft.enemyHeroes) return;
    onChange([...entries, draft]);
    setAdding(false);
  }
  function deleteEntry(id) {
    onChange(entries.filter(e => e.id !== id));
    setConfirmDelete(null);
  }

  return (
    <div style={{ marginBottom:14 }}>
      <button onClick={() => setOpen(!open)}
        style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:'none', border:'none', padding:'8px 0', cursor:'pointer' }}>
        <span style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em' }}>🧪 Test Rallies ({entries.length})</span>
        <span style={{ color:C.muted, fontSize:13 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>Log real results against this formation — who you fought, their ratio, heroes, and joiners. Helps confirm or correct the recommendation over time.</div>

          {entries.map(e => (
            <div key={e.id} style={{ background:C.section, borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{e.opponent || 'Unnamed opponent'}</div>
                {confirmDelete === e.id ? (
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => setConfirmDelete(null)} style={{ fontSize:11, height:28, padding:'0 8px', borderRadius:8, background:C.card, border:`1px solid ${C.border}`, color:C.icy, cursor:'pointer' }}>Cancel</button>
                    <button onClick={() => deleteEntry(e.id)} style={{ fontSize:11, height:28, padding:'0 8px', borderRadius:8, background:C.red, color:'#fff', border:'none', cursor:'pointer', fontWeight:700 }}>Delete</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(e.id)} style={{ width:28, height:28, borderRadius:8, background:'none', border:`1px solid ${C.red}33`, color:C.red+'88', fontSize:13, cursor:'pointer' }}>✕</button>
                )}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:12 }}>
                {e.enemyRatio  && <div><span style={{ color:C.muted }}>Enemy ratio: </span><span style={{ color:C.icy }}>{e.enemyRatio}</span></div>}
                {e.result      && <div><span style={{ color:C.muted }}>Result: </span><span style={{ color:C.gold, fontWeight:600 }}>{e.result}</span></div>}
                {e.enemyHeroes && <div style={{ gridColumn:'1 / -1' }}><span style={{ color:C.muted }}>Enemy heroes: </span><span style={{ color:C.icy }}>{e.enemyHeroes}</span></div>}
                {e.enemyJoiners&& <div style={{ gridColumn:'1 / -1' }}><span style={{ color:C.muted }}>Enemy joiners: </span><span style={{ color:C.icy }}>{e.enemyJoiners}</span></div>}
              </div>
              {e.notes && <div style={{ fontSize:11, color:C.muted, marginTop:6, fontStyle:'italic' }}>"{e.notes}"</div>}
            </div>
          ))}

          {!adding ? (
            <button onClick={startAdd} style={{ width:'100%', height:44, borderRadius:10, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
              ＋ Log a test rally
            </button>
          ) : (
            <div style={{ background:C.section, borderRadius:10, padding:12 }}>
              {[
                ['opponent', 'Who did you fight?'],
                ['enemyRatio', "Enemy's troop ratio"],
                ['enemyHeroes', "Enemy's heroes"],
                ['enemyJoiners', "Enemy's joiners"],
                ['result', 'Result'],
              ].map(([field, placeholder]) => (
                <input key={field} value={draft[field]} onChange={ev => setDraft(prev => ({ ...prev, [field]:ev.target.value }))}
                  placeholder={placeholder}
                  style={{ width:'100%', minHeight:44, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'0 12px', fontSize:14, color:C.white, boxSizing:'border-box', fontFamily:'inherit', marginBottom:8 }}/>
              ))}
              <textarea value={draft.notes} onChange={ev => setDraft(prev => ({ ...prev, notes:ev.target.value }))}
                placeholder="Any other notes…"
                style={{ width:'100%', minHeight:56, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:13, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit', marginBottom:10 }}/>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setAdding(false)} style={{ flex:1, height:40, borderRadius:8, background:C.card, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>Cancel</button>
                <button onClick={saveDraft} style={{ flex:2, height:40, borderRadius:8, background:C.gold, color:C.bg, fontWeight:700, fontSize:13, border:'none', cursor:'pointer' }}>Save entry</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
