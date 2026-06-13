import { C } from '../../../utils/constants.js';
import { JOINER_META } from '../../../data/joinerMeta.js';
import { resolveHero, playerCanFillSlot } from './battleConstants.js';

// ── FormationPicker ────────────────────────────────────────────
// Renders the guided/custom formation section inside a RallySlotCard.
// Props:
//   slot           – rally slot object
//   upd            – (patch) => void  — updates the parent slot
//   color          – accent colour for this rally type
//   players        – full roster array (for coverage checks)
//   maxGeneration  – number (1–6), from Settings
export function FormationPicker({ slot, upd, color, players, maxGeneration = 6 }) {
  const isCustom = slot.formationMode === 'custom';

  const availableFormations = JOINER_META
    .filter(g => g.gen <= maxGeneration)
    .flatMap(g => g.formations.map(f => ({ ...f, gen:g.gen, genLabel:g.genLabel })));

  const filtered = slot.formationFilter
    ? availableFormations.filter(f => f.type.toLowerCase().includes(slot.formationFilter.toLowerCase()))
    : availableFormations;

  function getCoverage(f) {
    return [f.j1, f.j2, f.j3, f.j4].filter(Boolean).map(heroRaw => {
      const resolved = resolveHero(heroRaw);
      const count    = players.filter(p => playerCanFillSlot(p, heroRaw)).length;
      return { heroRaw, display: resolved?.display, alternatives: resolved?.alternatives, count, ok: count >= 1 };
    });
  }

  const selectedFormation = slot.selectedFormation
    ? availableFormations.find(f =>
        f.gen === slot.selectedFormation.gen &&
        f.leaders.join() === slot.selectedFormation.leaders.join() &&
        f.type === slot.selectedFormation.type)
    : null;

  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Formation</label>
      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
        Showing Gen 1–{maxGeneration} formations. Change in ⚙️ Settings.
      </div>

      {/* All / Offense / Defense / Custom toggle */}
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        {[
          ['All',      null,      '#A8C4D8'],
          ['⚔️ Offense','offense', '#F5A623'],
          ['🛡️ Defense','defense', '#6B8CAE'],
          ['🔬 Custom', 'custom',  '#30D158'],
        ].map(([label, val, c]) => {
          const active = val === 'custom'
            ? isCustom
            : !isCustom && slot.formationFilter === val;
          return (
            <button key={label} onClick={() => {
              if (val === 'custom') upd({ formationMode:'custom', selectedFormation:null });
              else upd({ formationMode:'guided', formationFilter:val, selectedFormation:null });
            }} style={{ flex:1, height:38, borderRadius:10, border:`1px solid ${active?c:C.border}`, background:active?c+'22':C.section, color:active?c:C.muted, fontWeight:700, fontSize:12, cursor:'pointer' }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Custom mode */}
      {isCustom && (
        <div style={{ background:C.section, borderRadius:12, padding:14 }}>
          <div style={{ fontSize:12, color:C.green, fontWeight:700, marginBottom:10 }}>🔬 Custom formation — enter any heroes and ratio</div>

          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:6 }}>Leader rally heroes</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {['Jeronimo','Natalia','Molly','Zinman','Flint','Philly','Alonso','Logan','Mia','Greg','Ahmose','Reina','Lynn','Hector','Norah','Gwen','Wu Ming','Renee','Wayne'].map(hero => {
                const sel = (slot.leaderRallyHeroes || []).includes(hero);
                return (
                  <button key={hero} onClick={() => {
                    const c = slot.leaderRallyHeroes || [];
                    upd({ leaderRallyHeroes: sel ? c.filter(h => h !== hero) : [...c, hero] });
                  }} style={{ padding:'5px 10px', borderRadius:12, border:`1px solid ${sel?color:C.border}`, background:sel?color+'22':C.card, color:sel?color:C.muted, fontWeight:sel?700:400, fontSize:12, cursor:'pointer' }}>
                    {sel ? '✓ ' : ''}{hero}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:6 }}>Requested joiner heroes</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {['Jessie','Seo-Yoon','Jasser','Patrick','Mia','Norah','Philly','Logan','Reina','Sergey','Wu Ming','Gwen','Lynn','Zinman'].map(hero => {
                const sel = (slot.requestedHeroes || []).includes(hero);
                return (
                  <button key={hero} onClick={() => {
                    const c = slot.requestedHeroes || [];
                    upd({ requestedHeroes: sel ? c.filter(h => h !== hero) : [...c, hero] });
                  }} style={{ padding:'5px 10px', borderRadius:12, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.card, color:sel?C.gold:C.muted, fontWeight:sel?700:400, fontSize:12, cursor:'pointer' }}>
                    {sel ? '✓ ' : ''}{hero}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Guided formation cards */}
      {!isCustom && (
        <div>
          {filtered.length === 0 && (
            <div style={{ fontSize:13, color:C.muted, textAlign:'center', padding:'20px 0' }}>
              No formations available for Gen 1–{maxGeneration}. Update generation in ⚙️ Settings.
            </div>
          )}
          {filtered.map((f, i) => {
            const isSelected = selectedFormation &&
              f.gen === selectedFormation.gen &&
              f.leaders.join() === selectedFormation.leaders.join() &&
              f.type === selectedFormation.type;
            const coverage   = getCoverage(f);
            const allCovered = coverage.every(c => c.ok);
            const fColor     = f.type.toLowerCase().includes('offense') ? '#F5A623' : '#6B8CAE';

            return (
              <div key={i} onClick={() => {
                upd({
                  selectedFormation: isSelected ? null : { gen:f.gen, leaders:f.leaders, type:f.type },
                  leaderRallyHeroes: f.leaders,
                  requestedHeroes:   [f.j1, f.j2, f.j3, f.j4].filter(Boolean).map(h => resolveHero(h)?.display).filter(Boolean),
                });
              }} style={{ background:isSelected?fColor+'18':C.section, border:`1.5px solid ${isSelected?fColor:C.border}`, borderRadius:12, padding:14, marginBottom:8, cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:12, color:fColor, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>
                      Gen {f.gen} · {f.type}
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:C.white }}>
                      {f.leaders.join(' + ')}
                    </div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{f.ratio}</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                    {isSelected && <span style={{ fontSize:11, color:fColor, fontWeight:700 }}>✓ Selected</span>}
                    <span style={{ fontSize:11, color:allCovered?C.green:C.gold, fontWeight:600 }}>
                      {allCovered ? '✓ Full coverage' : '⚠ Check coverage'}
                    </span>
                  </div>
                </div>

                {/* Joiner slots with coverage */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:f.comments?6:0 }}>
                  {coverage.map((c, ci) => (
                    <div key={ci} style={{ background:C.card, borderRadius:8, padding:'6px 10px', display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:c.ok?C.green:C.red, flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:C.white }}>{c.display}</div>
                        {c.alternatives?.length > 0 && <div style={{ fontSize:10, color:C.muted }}>or {c.alternatives.join('/')}</div>}
                      </div>
                      <div style={{ fontSize:11, color:c.ok?C.green:C.red, fontWeight:700 }}>×{c.count}</div>
                    </div>
                  ))}
                </div>

                {[f.alt1, f.alt2].filter(Boolean).length > 0 && (
                  <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>Alt: {[f.alt1, f.alt2].filter(Boolean).join(' · ')}</div>
                )}
                {f.comments && <div style={{ fontSize:11, color:C.gold, marginTop:4, fontStyle:'italic' }}>⚠ {f.comments}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
