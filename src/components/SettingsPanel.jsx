import { useState } from 'react';
import { C, HEROES_BY_GEN } from '../utils/constants.js';
import { Field, Inp, SheetHandle } from './common/Primitives.jsx';
import { FORMATION_GEN_CUTOFF } from '../data/joinerMeta.js';

// Show every generation the game has (from HEROES_BY_GEN, currently up
// to 11), not just the ones with authored formation data — otherwise
// an alliance past Gen 6 can never select their real generation at
// all, which is what actually made this setting feel non-functional.
const GENERATIONS = HEROES_BY_GEN.map((g, i) => {
  const gen = i + 1;
  return {
    gen,
    label: g.heroes.join(', '),
    hasFormations: gen <= FORMATION_GEN_CUTOFF,
  };
});

export function SettingsPanel({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings || {});
  function upd(k, v) { setS(prev => ({ ...prev, [k]: v })); }

  // Multi-select — NOT cumulative. Selecting Gen 4 and Gen 5 means
  // exactly those two show up in battle-plan suggestions, nothing
  // else. Replaces the old "this generation and everything below it"
  // single-select model, which showed generations an alliance may have
  // already outgrown.
  const selectedGens = s.selectedGenerations || [];
  function toggleGen(gen) {
    upd('selectedGenerations', selectedGens.includes(gen)
      ? selectedGens.filter(g => g !== gen)
      : [...selectedGens, gen].sort((a, b) => a - b));
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'16px 20px 60px', maxHeight:'86vh', overflowY:'auto' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>⚙️ Alliance Settings</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:22, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>
        <Field label="Alliance Name">
          <Inp value={s.allianceName} onChange={v => upd('allianceName', v)} placeholder="Alliance name" />
        </Field>
        <Field label="Alliance Tag">
          <Inp value={s.allianceTag} onChange={v => upd('allianceTag', v)} placeholder="e.g. ABC" />
        </Field>
        <Field label="State ID">
          <Inp value={s.stateId} onChange={v => upd('stateId', v)} placeholder="e.g. 1234" inputMode="numeric" />
        </Field>

        {/* Generation setting — multi-select */}
        <Field label="Hero Generations" hint="Select every generation your alliance is actively using. Only these will be suggested in battle planning. Generations marked ⚠ don't have guided formations authored yet — Battle Plan's Custom mode still works for those.">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {GENERATIONS.map(g => {
              const sel = selectedGens.includes(g.gen);
              return (
                <button key={g.gen} onClick={() => toggleGen(g.gen)}
                  style={{ textAlign:'left', padding:'10px 14px', borderRadius:10, border:`1px solid ${sel?C.gold:C.border+'44'}`, background:sel?C.gold+'22':C.section, cursor:'pointer' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:sel?C.gold:C.muted }}>
                    {sel?'✓ ':''}Gen {g.gen}
                  </div>
                  <div style={{ fontSize:11, color:sel?C.gold:C.muted, marginTop:2 }}>{g.label}</div>
                  {!g.hasFormations && (
                    <div style={{ fontSize:10, color:C.gold, marginTop:4 }}>⚠ No guided formations yet — Custom mode only</div>
                  )}
                </button>
              );
            })}
          </div>
          {selectedGens.length === 0 && (
            <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>Nothing selected yet — battle planning will show suggestions from every generation until you pick which ones apply to you.</div>
          )}
        </Field>

        <button onClick={() => onSave(s)} style={{ width:'100%', height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>
          Save Settings
        </button>
      </div>
    </div>
  );
}
