import { useState } from 'react';
import { C } from '../utils/constants.js';
import { JOINER_HEROES, JOINER_META, buildCoverageReport } from '../data/joinerMeta.js';
import { getPlayersWithJoinerHero } from '../services/joinerRegistryService.js';
import { detectStacking } from '../services/svsTimingService.js';

// Battle-prep analysis views, split out of the old JoinerRegistry.jsx.
// The "who has this hero" assignment UI moved to FieldRegistry.jsx in
// Members — this is what's left: read-only analysis you reach for while
// battle planning, not while managing the roster. Logic here is
// unchanged from the original file, just relocated.

const VIEWS = [
  { id:'coverage', label:'📊 Coverage' },
  { id:'stacking', label:'⚠️ Stacking' },
  { id:'meta',     label:'📐 Meta' },
];

// ── Coverage View ──────────────────────────────────────────────
function CoverageView({ players }) {
  const report = buildCoverageReport(players, JOINER_HEROES);
  const maxCount = Math.max(...report.map(r=>r.count), 1);
  return (
    <div style={{ padding:'0 0 20px' }}>
      <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>
        Coverage across {players.length} players. Red = no coverage.
      </div>
      {report.map(({hero,count})=>(
        <div key={hero} style={{ marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:14, color:count===0?C.red:C.white, fontWeight:count===0?700:400 }}>{hero}{count===0?' ⚠️':''}</span>
            <span style={{ fontSize:14, fontWeight:700, color:count===0?C.red:C.gold }}>{count}</span>
          </div>
          <div style={{ height:8, borderRadius:4, background:C.border, overflow:'hidden' }}>
            <div style={{ width:`${(count/maxCount)*100}%`, height:'100%', borderRadius:4, background:count===0?C.red:C.gold, transition:'width 300ms ease' }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Stacking View ──────────────────────────────────────────────
function StackingView({ players }) {
  const allJoiners = players.flatMap(p=>(p.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).map(jh=>jh.hero));
  const stacks = detectStacking(allJoiners);

  if (stacks.length===0) {
    return (
      <div style={{ textAlign:'center', padding:'40px 20px' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
        <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:8 }}>No stacking issues</div>
        <div style={{ fontSize:14, color:C.muted }}>No joiner hero appears 3+ times across your roster.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background:C.red+'18', border:`1px solid ${C.red}33`, borderRadius:12, padding:14, marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.red, marginBottom:4 }}>⚠️ Stacking Detected</div>
        <div style={{ fontSize:13, color:C.muted }}>Same hero joining 3+ times means their skill buffs don't stack — you're wasting joiner slots.</div>
      </div>
      {stacks.map(({hero,count,risk})=>{
        const owners = getPlayersWithJoinerHero(players, hero);
        return (
          <div key={hero} style={{ background:C.card, borderRadius:12, padding:14, marginBottom:8, border:`1px solid ${risk==='high'?C.red:C.gold}33` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{hero}</div>
              <span style={{ fontSize:12, fontWeight:700, color:risk==='high'?C.red:C.gold, padding:'2px 8px', borderRadius:10, background:(risk==='high'?C.red:C.gold)+'18' }}>×{count} {risk==='high'?'HIGH RISK':'medium'}</span>
            </div>
            <div style={{ fontSize:12, color:C.muted }}>Players with this hero: {owners.map(p=>p.username||p.alias||'?').join(', ')}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Meta View ──────────────────────────────────────────────────
function MetaView({ players }) {
  const [selectedGen, setSelectedGen]   = useState(6);
  const [selectedType, setSelectedType] = useState('Defense');
  const [selectedRatio, setSelectedRatio] = useState('Any');

  const genData = JOINER_META.find(g=>g.gen===selectedGen);
  let formations = genData?.formations||[];
  if (selectedType!=='Any') formations=formations.filter(f=>f.type.toLowerCase().includes(selectedType.toLowerCase()));
  if (selectedRatio!=='Any') formations=formations.filter(f=>f.ratio.includes(selectedRatio));

  const ratios = genData ? ['Any',...new Set(genData.formations.map(f=>f.ratio.split(' or ')[0]))] : ['Any'];

  function playerHas(hero) {
    return players.some(p=>(p.joinerHeroes||[]).some(jh=>jh.hero===hero&&jh.skillLevel>=5));
  }

  return (
    <div>
      <div style={{ background:C.section, borderRadius:12, padding:14, marginBottom:16 }}>
        <div style={{ fontSize:13, color:C.icy, lineHeight:1.6 }}>
          Meta tables based on community spreadsheet data. Formations may vary based on your specific heroes and server generation. Always verify with your leadership.
        </div>
      </div>

      <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:14 }}>📐 Meta Recommendation</div>
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Generation</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
          {JOINER_META.map(g=>(
            <button key={g.gen} onClick={()=>{setSelectedGen(g.gen);setSelectedRatio('Any');}} style={{ padding:'8px 14px', borderRadius:20, border:`1px solid ${selectedGen===g.gen?C.gold:C.border}`, background:selectedGen===g.gen?C.gold+'22':C.section, color:selectedGen===g.gen?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
              Gen {g.gen}
            </button>
          ))}
        </div>
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Type</div>
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          {['Defense','Offense'].map(t=>(
            <button key={t} onClick={()=>setSelectedType(t)} style={{ flex:1, height:40, borderRadius:20, border:`1px solid ${selectedType===t?C.gold:C.border}`, background:selectedType===t?C.gold+'22':C.section, color:selectedType===t?C.gold:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>{t}</button>
          ))}
        </div>
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Ratio (optional)</div>
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:16 }}>
          {ratios.slice(0,5).map(r=>(
            <button key={r} onClick={()=>setSelectedRatio(r)} style={{ padding:'6px 14px', borderRadius:20, whiteSpace:'nowrap', border:`1px solid ${selectedRatio===r?C.gold:C.border}`, background:selectedRatio===r?C.gold+'22':C.section, color:selectedRatio===r?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer', minHeight:36 }}>{r}</button>
          ))}
        </div>

        {formations.length===0&&<div style={{ fontSize:14, color:C.muted, textAlign:'center', padding:'20px 0' }}>No formations match these filters.</div>}
        {formations.map((f,i)=>(
          <div key={i} style={{ background:C.section, borderRadius:10, padding:14, marginBottom:10, border:f.isMeta?`1px solid ${C.gold}44`:undefined }}>
            {f.isMeta&&<div style={{ fontSize:11, fontWeight:700, color:C.gold, marginBottom:6 }}>✦ NEW META</div>}
            <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:2 }}>{f.type} · {f.ratio}</div>
            <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>Leaders: {Array.isArray(f.leaders)?f.leaders.join(' & '):f.leaders}</div>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Joiners</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:f.alt1||f.comments?12:0 }}>
              {[f.j1,f.j2,f.j3,f.j4].filter(Boolean).map((j,ji)=>{
                const heroName = j.replace(/[*]/g,'').trim();
                const hasIt = playerHas(heroName);
                return (
                  <div key={ji} style={{ background:hasIt?C.gold+'22':C.card, border:`1px solid ${hasIt?C.gold:C.border}`, borderRadius:20, padding:'8px 14px' }}>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>J{ji+1}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:hasIt?C.gold:C.white }}>{j}</div>
                    {hasIt&&<div style={{ fontSize:10, color:C.green }}>✓ covered</div>}
                  </div>
                );
              })}
            </div>
            {(f.alt1||f.alt2)&&(
              <div style={{ marginBottom:f.comments?8:0 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Alternatives</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {[f.alt1,f.alt2,f.alt3].filter(Boolean).map((a,ai)=>(
                    <span key={ai} style={{ padding:'6px 12px', borderRadius:16, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontSize:13 }}>{a}</span>
                  ))}
                </div>
              </div>
            )}
            {f.comments&&<div style={{ fontSize:12, color:C.muted, fontStyle:'italic', marginTop:8 }}>ℹ️ {f.comments}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── JoinerAnalysis (main export) ──────────────────────────────
export default function JoinerAnalysis({ players, onClose }) {
  const [view, setView] = useState('coverage');

  return (
    <div style={{ height:'100vh', fontFamily:'system-ui,-apple-system,sans-serif', color:C.white, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, background:C.bg, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:4 }}>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', padding:0 }}>← Back</button>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:C.white }}>📐 Joiner Analysis</div>
            <div style={{ fontSize:12, color:C.muted }}>Coverage, stacking & meta · {players.length} players</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginTop:12 }}>
          {VIEWS.map(v=>(
            <button key={v.id} onClick={()=>setView(v.id)} style={{ padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap', background:view===v.id?C.gold+'22':C.section, border:`1px solid ${view===v.id?C.gold:C.border}`, color:view===v.id?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', flexShrink:0 }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', paddingBottom:40 }}>
        {view==='coverage'&&<CoverageView players={players}/>}
        {view==='stacking'&&<StackingView players={players}/>}
        {view==='meta'&&<MetaView players={players}/>}
      </div>
    </div>
  );
}
