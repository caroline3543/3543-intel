import { useState } from 'react';
import { C, HEROES_BY_GEN, TIER_OPTIONS, LANGUAGES } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { JOINER_HEROES } from '../../data/joinerMeta.js';
import { addJoinerHeroToPlayer, removeJoinerHeroFromPlayer, getPlayersWithJoinerHero, getJoinerHeroCounts } from '../../services/joinerRegistryService.js';
import { searchPlayers } from '../../services/playerAutosuggest.js';
import {
  getAllFieldValues, getPlayersWithFieldValue,
  assignFieldValue, unassignFieldValue,
} from '../../services/fieldRegistryService.js';

// Add a new field here to make it show up in the registry — no other
// wiring needed as long as its data lives at `path` on the player object.
// 'heroes' is a special case (kind:'hero') because joiner heroes carry
// skillLevel/verified metadata, not just a flat value — it reuses the
// existing joinerRegistryService rather than the generic assign/unassign.
const FIELDS = [
  { key:'heroes',    label:'🦸 Joiner Heroes', kind:'hero' },
  { key:'languages', label:'🌐 Languages',     kind:'generic', path:'languages',       multi:true,  options:LANGUAGES,    color:C.gold },
  { key:'infantry',  label:'⚔️ Infantry Tier', kind:'generic', path:'troops.infantry', multi:false, options:TIER_OPTIONS, color:C.inf  },
  { key:'lancer',    label:'🏹 Lancer Tier',   kind:'generic', path:'troops.lancer',   multi:false, options:TIER_OPTIONS, color:C.lan  },
  { key:'marksman',  label:'🎯 Marksman Tier', kind:'generic', path:'troops.marksman', multi:false, options:TIER_OPTIONS, color:C.mar  },
];

function initials(n) { return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?'; }

const labelStyle = { fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 };
const inputStyle = { width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit' };
const ownerRowStyle = { display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${C.border}22` };
const nameStyle = { fontSize:14, fontWeight:700, color:C.white };
const metaStyle = { fontSize:11, color:C.muted };
const removeBtnStyle = { background:'none', border:'none', color:C.red+'88', fontSize:16, cursor:'pointer', padding:'4px' };
const resultDropdownStyle = { position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', zIndex:600, boxShadow:'0 8px 24px #000a' };
const resultRowStyle = { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', background:'none', border:'none', borderBottom:`1px solid ${C.border}22`, cursor:'pointer', textAlign:'left' };

function Avatar({ name }) {
  return <div style={{ width:32, height:32, borderRadius:'50%', background:C.muted+'33', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, color:C.white, flexShrink:0 }}>{initials(name)}</div>;
}

// ── Generic value card (Languages / Tiers) ──────────────────────
function ValueCard({ value, path, multi, color, players, onUpdatePlayer }) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const owners = getPlayersWithFieldValue(players, path, value, multi);
  const count = owners.length;

  function search(q) {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    const pool = players.filter(p => !owners.some(o=>o.id===p.id));
    setResults(searchPlayers(pool, q, 5));
  }
  function addOwner(p) { onUpdatePlayer(assignFieldValue(p, path, value, multi)); setQuery(''); setResults([]); }
  function removeOwner(p) { onUpdatePlayer(unassignFieldValue(p, path, value, multi)); }

  return (
    <div style={{ background:C.card, borderRadius:12, padding:14, marginBottom:8 }}>
      <div onClick={()=>setOpen(!open)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{value}</div>
          <div style={{ fontSize:12, color:C.muted }}>{count} player{count!==1?'s':''}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:20, fontWeight:700, color:count>0?(color||C.gold):C.muted }}>{count}</div>
          <span style={{ fontSize:16, color:C.muted }}>{open?'▲':'▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
          {owners.length>0 && (
            <div style={{ marginBottom:12 }}>
              <div style={labelStyle}>Assigned</div>
              {owners.map(p=>(
                <div key={p.id} style={ownerRowStyle}>
                  <Avatar name={p.username||p.alias}/>
                  <div style={{ flex:1 }}>
                    <div style={nameStyle}>{p.username||p.alias||'?'}</div>
                    <div style={metaStyle}>{p.allianceTag?`[${p.allianceTag}]`:''}{p.furnaceLevel?` FC${p.furnaceLevel}`:''}</div>
                  </div>
                  <button onClick={()=>removeOwner(p)} style={removeBtnStyle}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div style={labelStyle}>Add Player</div>
          <div style={{ position:'relative' }}>
            <input value={query} onChange={e=>search(e.target.value)} placeholder="Search player by name…" style={inputStyle}/>
            {results.length>0 && (
              <div style={resultDropdownStyle}>
                {results.map(p=>(
                  <button key={p.id} onClick={()=>{addOwner(p);vibe(8);}} style={resultRowStyle}>
                    <Avatar name={p.username||p.alias}/>
                    <div>
                      <div style={nameStyle}>{p.username||p.alias||'?'}</div>
                      <div style={metaStyle}>{p.allianceTag?`[${p.allianceTag}]`:''}</div>
                    </div>
                    <span style={{ marginLeft:'auto', fontSize:12, color:C.green, fontWeight:600 }}>Add ›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── New value creator row ────────────────────────────────────────
// Typing a value that isn't in the predefined list and isn't already in
// use lets you create it. It shows up as its own card immediately (open,
// zero owners) so you can assign the first player in the same motion —
// once assigned, getAllFieldValues will pick it up on its own from then on.
function NewValueRow({ existingValues, onCreate }) {
  const [text, setText] = useState('');
  const trimmed = text.trim();
  const isDup = existingValues.some(v=>v.toLowerCase()===trimmed.toLowerCase());
  return (
    <div style={{ display:'flex', gap:8, marginBottom:16 }}>
      <input
        value={text}
        onChange={e=>setText(e.target.value)}
        placeholder="Type a new value not listed below…"
        style={{ ...inputStyle, flex:1 }}
      />
      <button
        disabled={!trimmed||isDup}
        onClick={()=>{ onCreate(trimmed); setText(''); }}
        style={{
          padding:'0 16px', borderRadius:10, border:'none', minHeight:44, fontWeight:700, fontSize:13,
          background: (!trimmed||isDup) ? C.muted+'33' : C.gold,
          color: (!trimmed||isDup) ? C.muted : C.bg,
          cursor: (!trimmed||isDup) ? 'default' : 'pointer',
        }}
      >+ Create</button>
    </div>
  );
}

// ── Joiner Heroes field (existing hero-registry logic, unchanged) ─
function HeroFieldView({ players, onUpdatePlayer }) {
  const counts = getJoinerHeroCounts(players, JOINER_HEROES);
  return (
    <div>
      {HEROES_BY_GEN.map(({gen,heroes})=>{
        const joiners = heroes.filter(h=>JOINER_HEROES.includes(h));
        if (joiners.length===0) return null;
        return (
          <div key={gen}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.1em', margin:'16px 0 8px' }}>{gen}</div>
            {joiners.map(hero=>(
              <HeroValueCard key={hero} hero={hero} count={counts[hero]||0} players={players} onUpdatePlayer={onUpdatePlayer}/>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Kept separate from the generic ValueCard: joiner heroes carry
// skillLevel/verified metadata, so assigning/removing goes through
// joinerRegistryService rather than the plain field assign/unassign.
function HeroValueCard({ hero, count, players, onUpdatePlayer }) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const owners = getPlayersWithJoinerHero(players, hero);

  function search(q) {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setResults(searchPlayers(players.filter(p=>!(p.joinerHeroes||[]).some(jh=>jh.hero===hero&&jh.skillLevel>=5)), q, 5));
  }
  function addOwner(p){ onUpdatePlayer(addJoinerHeroToPlayer(p, hero)); setQuery(''); setResults([]); }
  function removeOwner(p){ onUpdatePlayer(removeJoinerHeroFromPlayer(p, hero)); }

  return (
    <div style={{ background:C.card, borderRadius:12, padding:14, marginBottom:8 }}>
      <div onClick={()=>setOpen(!open)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{hero}</div>
          <div style={{ fontSize:12, color:C.muted }}>{count} player{count!==1?'s':''} at Skill 5</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:20, fontWeight:700, color:count>0?C.gold:C.muted }}>{count}</div>
          <span style={{ fontSize:16, color:C.muted }}>{open?'▲':'▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
          {owners.length>0 && (
            <div style={{ marginBottom:12 }}>
              <div style={labelStyle}>Owners</div>
              {owners.map(p=>(
                <div key={p.id} style={ownerRowStyle}>
                  <Avatar name={p.username||p.alias}/>
                  <div style={{ flex:1 }}>
                    <div style={nameStyle}>{p.username||p.alias||'?'}</div>
                    <div style={metaStyle}>{p.allianceTag?`[${p.allianceTag}]`:''}{p.furnaceLevel?` FC${p.furnaceLevel}`:''}</div>
                  </div>
                  <button onClick={()=>removeOwner(p)} style={removeBtnStyle}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div style={labelStyle}>Add Player</div>
          <div style={{ position:'relative' }}>
            <input value={query} onChange={e=>search(e.target.value)} placeholder="Search player by name…" style={inputStyle}/>
            {results.length>0 && (
              <div style={resultDropdownStyle}>
                {results.map(p=>(
                  <button key={p.id} onClick={()=>{addOwner(p);vibe(8);}} style={resultRowStyle}>
                    <Avatar name={p.username||p.alias}/>
                    <div>
                      <div style={nameStyle}>{p.username||p.alias||'?'}</div>
                      <div style={metaStyle}>{p.allianceTag?`[${p.allianceTag}]`:''}</div>
                    </div>
                    <span style={{ marginLeft:'auto', fontSize:12, color:C.green, fontWeight:600 }}>Add ›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Generic field view (Languages / Tiers) ───────────────────────
function GenericFieldView({ field, players, onUpdatePlayer }) {
  const [pendingValue, setPendingValue] = useState(null);
  const values = getAllFieldValues(players, field.path, field.options, field.multi);
  const displayValues = (pendingValue && !values.includes(pendingValue)) ? [...values, pendingValue] : values;

  return (
    <div>
      <NewValueRow existingValues={values} onCreate={setPendingValue} />
      {displayValues.map(v=>(
        <ValueCard key={v} value={v} path={field.path} multi={field.multi} color={field.color} players={players} onUpdatePlayer={onUpdatePlayer} />
      ))}
    </div>
  );
}

// ── FieldRegistry (main export) ───────────────────────────────────
export default function FieldRegistry({ players, onUpdatePlayer, onClose }) {
  const [field, setField] = useState(FIELDS[0].key);
  const activeField = FIELDS.find(f=>f.key===field);

  return (
    <div style={{ height:'100vh', fontFamily:'system-ui,-apple-system,sans-serif', color:C.white, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, background:C.bg, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:4 }}>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', padding:0 }}>← Back</button>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:C.white }}>📋 Field Registry</div>
            <div style={{ fontSize:12, color:C.muted }}>Assign roster data by value · {players.length} players</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginTop:12 }}>
          {FIELDS.map(f=>(
            <button key={f.key} onClick={()=>setField(f.key)} style={{ padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap', background:field===f.key?C.gold+'22':C.section, border:`1px solid ${field===f.key?C.gold:C.border}`, color:field===f.key?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', flexShrink:0 }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', paddingBottom:40 }}>
        {activeField.kind==='hero'
          ? <HeroFieldView players={players} onUpdatePlayer={onUpdatePlayer} />
          : <GenericFieldView field={activeField} players={players} onUpdatePlayer={onUpdatePlayer} />
        }
      </div>
    </div>
  );
}
