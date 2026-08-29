import { useState } from 'react';
import { C, TIER_OPTIONS, LANGUAGES, tierChipStyle } from '../../utils/constants.js';
import { JOINER_HEROES } from '../../data/joinerMeta.js';

function initials(n) {
  return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
}

const TROOP_TYPES = [['🛡️',C.inf,'infantry'],['⚔️',C.lan,'lancer'],['🏹',C.mar,'marksman']];

// ── BatchMemberCard ──────────────────────────────────────────────
// One expandable member row in BatchAddSheet's individual-override
// list — JoinerRegistry-style tap-to-expand, set values inline.
// Extracted from BatchAddSheet.jsx to keep both files under the
// 300-line limit.
//
// Props:
//   name  – member's raw name string (batch-add keys by name, not id, until save)
//   stat  – { furnaceLevel, troops:{...}, languages:[], joinerHeroes:[] }
//   onChange – (patch) => void, merges into this member's stat
export function BatchMemberCard({ name, stat, onChange }) {
  const [open, setOpen] = useState(false);
  const summary = [stat.furnaceLevel, stat.troops.infantry, stat.troops.lancer, stat.troops.marksman].filter(Boolean).length
    + (stat.languages?.length || 0) + (stat.joinerHeroes?.length || 0);

  function toggleLanguage(lang) {
    const cur = stat.languages || [];
    onChange({ languages: cur.includes(lang) ? cur.filter(l => l !== lang) : [...cur, lang] });
  }
  function toggleHero(hero) {
    const cur = stat.joinerHeroes || [];
    const has = cur.includes(hero);
    onChange({ joinerHeroes: has ? cur.filter(h => h !== hero) : [...cur, hero] });
  }

  return (
    <div style={{ background:C.card, borderRadius:12, padding:14, marginBottom:8 }}>
      <div onClick={()=>setOpen(!open)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:C.muted+'33', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, color:C.white, flexShrink:0 }}>{initials(name)}</div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{name}</div>
            <div style={{ fontSize:12, color:C.muted }}>{summary>0?`${summary} value${summary!==1?'s':''} set`:'Not set'}</div>
          </div>
        </div>
        <span style={{ fontSize:16, color:C.muted }}>{open?'▲':'▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
          <div style={{ fontSize:11, color:C.gold, fontWeight:700, marginBottom:6 }}>🔥 Furnace level</div>
          <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:12 }}>
            {TIER_OPTIONS.map(t=><button key={t} onClick={()=>onChange({furnaceLevel:stat.furnaceLevel===t?null:t})} style={tierChipStyle(stat.furnaceLevel===t)}>{stat.furnaceLevel===t?'✓ ':''}{t}</button>)}
          </div>

          {TROOP_TYPES.map(([icon,c,k])=>(
            <div key={k} style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, color:c, fontWeight:700, marginBottom:6 }}>{icon}</div>
              <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
                {TIER_OPTIONS.map(t=><button key={t} onClick={()=>onChange({troops:{...stat.troops,[k]:stat.troops[k]===t?null:t}})} style={tierChipStyle(stat.troops[k]===t,c)}>{stat.troops[k]===t?'✓ ':''}{t}</button>)}
              </div>
            </div>
          ))}

          <div style={{ fontSize:11, color:C.icy, fontWeight:700, marginBottom:6, marginTop:4 }}>🌐 Languages spoken</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
            {LANGUAGES.map(lang=>{
              const sel = (stat.languages||[]).includes(lang);
              return <button key={lang} onClick={()=>toggleLanguage(lang)} style={{ padding:'6px 12px', borderRadius:16, border:`2px solid ${sel?C.icy:C.border}`, background:sel?C.icy:C.section, color:sel?C.bg:C.muted, fontWeight:sel?800:600, fontSize:13, cursor:'pointer', minHeight:36 }}>{sel?'✓ ':''}{lang}</button>;
            })}
          </div>

          <div style={{ fontSize:11, color:C.gold, fontWeight:700, marginBottom:6 }}>🦸 Joiner heroes (Skill 5)</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {JOINER_HEROES.map(hero=>{
              const sel = (stat.joinerHeroes||[]).includes(hero);
              return <button key={hero} onClick={()=>toggleHero(hero)} style={{ padding:'6px 12px', borderRadius:16, border:`2px solid ${sel?C.gold:C.border}`, background:sel?C.gold:C.section, color:sel?C.bg:C.muted, fontWeight:sel?800:600, fontSize:13, cursor:'pointer', minHeight:36 }}>{sel?'✓ ':''}{hero}</button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
