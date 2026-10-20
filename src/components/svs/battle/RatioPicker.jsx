import { C } from '../../../utils/constants.js';
import { RATIO_PRESETS } from './battleConstants.js';

// ── RatioPicker ────────────────────────────────────────────────
// The troop-ratio section of a rally slot. Prominence is gated on
// leader heroes being fully decided — the ratio recommendation is
// tied to that specific formation, so showing it prominently before
// the heroes are locked in would be premature. Extracted from
// RallySlotCard.jsx to keep both files under the 300-line limit.
//
// Props:
//   slot – rally slot object (reads leaderRallyHeroes + ratio)
//   upd  – (patch) => void, same updater RallySlotCard passes everywhere
export function RatioPicker({ slot, upd }) {
  const heroesLocked = (slot.leaderRallyHeroes || []).length === 3;

  return (
    <div style={{ marginBottom:14, background:heroesLocked?C.gold+'14':'transparent', border:heroesLocked?`1px solid ${C.gold}44`:'none', borderRadius:heroesLocked?12:0, padding:heroesLocked?14:0 }}>
      <label style={{ fontSize:heroesLocked?13:11, fontWeight:700, color:heroesLocked?C.gold:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:heroesLocked?8:4 }}>
        {heroesLocked ? '⚡ ' : ''}Troop ratio <span style={{ fontWeight:400 }}>(Infantry / Lancer / Marksman)</span>
      </label>
      {!heroesLocked && (
        <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Pick all 3 leader heroes above to confirm the ratio for this formation.</div>
      )}
      <div style={{ display:'flex', flexWrap:'wrap', gap:heroesLocked?8:6, marginBottom:slot.ratio==='Custom'?8:0 }}>
        {RATIO_PRESETS.map(r => {
          const sel = slot.ratio === r;
          return (
            <button key={r} onClick={() => upd({ ratio:r })}
              style={{ padding:heroesLocked?'10px 18px':'6px 12px', minHeight:heroesLocked?44:'auto', borderRadius:16, border:`1px solid ${sel?C.icy:C.border}`, background:sel?C.icy+'22':C.section, color:sel?C.icy:C.muted, fontWeight:600, fontSize:heroesLocked?15:13, cursor:'pointer' }}>
              {r}
            </button>
          );
        })}
        <button onClick={() => upd({ ratio:'Custom' })}
          style={{ padding:heroesLocked?'10px 18px':'6px 12px', minHeight:heroesLocked?44:'auto', borderRadius:16, border:`1px solid ${slot.ratio&&!RATIO_PRESETS.includes(slot.ratio)?C.icy:C.border}`, background:slot.ratio&&!RATIO_PRESETS.includes(slot.ratio)?C.icy+'22':C.section, color:slot.ratio&&!RATIO_PRESETS.includes(slot.ratio)?C.icy:C.muted, fontWeight:600, fontSize:heroesLocked?15:13, cursor:'pointer' }}>
          Custom
        </button>
      </div>
      {(slot.ratio === 'Custom' || (slot.ratio && !RATIO_PRESETS.includes(slot.ratio))) && (
        <input
          value={slot.ratio === 'Custom' ? '' : slot.ratio}
          onChange={e => upd({ ratio:e.target.value })}
          placeholder="e.g. 55/35/10"
          style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit', marginTop:6 }}
        />
      )}
    </div>
  );
}
