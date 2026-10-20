import { useState } from 'react';
import { getWorkspaces, activeStateId, selectWorkspace } from '../../services/stateWorkspaceService.js';
import { saveToStorage } from '../../services/exportImportService.js';
import { C } from '../../utils/constants.js';
const control = { minHeight:44, borderRadius:10, border:`1px solid ${C.border}`, background:C.section, color:C.white, padding:'8px 10px', fontSize:14 };
export function StateSwitcher({ data, onPull }) {
  const [adding, setAdding] = useState(false);
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');
  function switchTo(id) {
    if (id === activeStateId()) return;
    try { saveToStorage(data, true); selectWorkspace(id); }
    catch (e) { setError(e.message || 'Unable to save the current state.'); }
  }
  return <section style={{ marginTop:12 }} aria-label="State workspace">
    <label htmlFor="active-state" style={{ display:'block', color:C.gold, fontSize:12, marginBottom:5 }}>Showing one state only</label>
    <div style={{ display:'flex', gap:6 }}>
      <select id="active-state" value={activeStateId()} onChange={e => switchTo(e.target.value)} style={{ ...control, flex:1, minWidth:0 }}>
        {getWorkspaces().states.map(id => <option key={id} value={id}>State {id}</option>)}
      </select>
      <button style={control} onClick={() => setAdding(!adding)} aria-label="Add another state">+ State</button>
      <button style={{ ...control, color:C.gold }} onClick={onPull}>Pull alliance</button>
    </div>
    {adding && <form onSubmit={e => { e.preventDefault(); switchTo(number); }} style={{ display:'flex', gap:6, marginTop:8 }}>
      <input aria-label="New state number" inputMode="numeric" value={number} placeholder="State number" onChange={e => setNumber(e.target.value)} style={{ ...control, width:'100%', minWidth:0 }} />
      <button style={control} type="submit">Open</button>
    </form>}
    {error && <p role="alert" style={{ color:C.red, fontSize:12 }}>{error}</p>}
  </section>;
}
