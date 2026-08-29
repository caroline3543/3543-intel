import { useState, useEffect } from 'react';
import { C, TIER_OPTIONS, LANGUAGES, tierChipStyle } from '../../utils/constants.js';
import { JOINER_HEROES } from '../../data/joinerMeta.js';
import { vibe } from '../../utils/vibe.js';
import { newPlayer } from '../../data/playerSchema.js';
import { resolveBatchRows, mergePlayerObjects } from '../../services/batchAddService.js';
import { searchPlayers } from '../../services/playerAutosuggest.js';
import { Inp, Sel, SheetHandle } from '../common/Primitives.jsx';
import { AlliancePicker } from '../common/AlliancePicker.jsx';
import { BatchMemberCard } from './BatchMemberCard.jsx';

function initials(n) {
  return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
}

const TROOP_TYPES = [['🛡️',C.inf,'infantry'],['⚔️',C.lan,'lancer'],['🏹',C.mar,'marksman']];
const emptyTroops = () => ({infantry:null,lancer:null,marksman:null});
const emptyStat = () => ({ furnaceLevel:null, troops:emptyTroops(), languages:[], joinerHeroes:[] });

export function BatchAddSheet({ open, onClose, members, onAddNew, onUpdateExisting }) {
  const [phase, setPhase]         = useState(0);
  const [rawLines, setRawLines]   = useState([]);
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [tagAll, setTagAll]       = useState('');
  const [showOpt, setShowOpt]     = useState(false);
  const [resolved, setResolved]   = useState(null);
  const [fuzzyDec, setFuzzyDec]   = useState({});
  const [grpSel, setGrpSel]       = useState(new Set());
  const [grpStat, setGrpStat]     = useState(emptyStat());
  const [memStats, setMemStats]   = useState({});

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') handleClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  function updateSuggestions(text) {
    if (!text.trim()) { setSuggestions([]); return; }
    setSuggestions(searchPlayers(members, text, 6));
  }
  function addLine(text, linkedId=null) {
    if (!text.trim()) return;
    setRawLines(prev=>[...prev,{text:text.trim(),linkedId}]);
    setInputText(''); setSuggestions([]);
  }
  function removeLine(idx) { setRawLines(prev=>prev.filter((_,i)=>i!==idx)); }

  function getActive() {
    if (!resolved) return [];
    const n=[];
    resolved.exact.forEach(r=>n.push(r.name));
    resolved.fuzzy.forEach(r=>{const d=fuzzyDec[r.name];if(d==='update'||d==='create')n.push(r.name);});
    resolved.fresh.forEach(r=>n.push(r.name));
    return n;
  }
  const active = getActive();
  const individualList = active.filter(n=>!grpSel.has(n));

  function resetAll() {
    setPhase(0);setRawLines([]);setInputText('');setSuggestions([]);setTagAll('');setShowOpt(false);setResolved(null);setFuzzyDec({});
    setGrpSel(new Set());setGrpStat(emptyStat());setMemStats({});
  }
  function handleClose() { resetAll(); onClose(); }
  function tog(set,fn,k) { const n=new Set(set);n.has(k)?n.delete(k):n.add(k);fn(n); }

  function resolve() {
    const res = resolveBatchRows(rawLines, members);
    setResolved(res);
    const d={};res.fuzzy.forEach(r=>{d[r.name]='update';});
    setFuzzyDec(d);setPhase(1);vibe(8);
  }

  function memStat(n) { return memStats[n] || emptyStat(); }
  function setMemStat(n, patch) { setMemStats(prev => ({ ...prev, [n]: { ...memStat(n), ...patch } })); }

  function toGrpJoinerHeroes(list) {
    const now = new Date().toISOString();
    return (list || []).map(hero => ({ hero, skillLevel: 5, verified: false, updatedAt: now }));
  }

  function buildStats(n) {
    const raw = grpSel.has(n) ? grpStat : memStat(n);
    return {
      furnaceLevel: raw.furnaceLevel,
      troops: raw.troops,
      languages: raw.languages,
      joinerHeroes: toGrpJoinerHeroes(raw.joinerHeroes),
    };
  }

  function buildAndSave() {
    const toCreate=[],toUpdate=[];
    (resolved?.exact||[]).forEach(r=>{const patch={...buildStats(r.name)};if(tagAll)patch.allianceTag=tagAll;toUpdate.push(mergePlayerObjects(r.existingPlayer,patch));});
    (resolved?.fuzzy||[]).forEach(r=>{const d=fuzzyDec[r.name];if(d==='skip')return;const patch={...buildStats(r.name)};if(tagAll)patch.allianceTag=tagAll;d==='update'?toUpdate.push(mergePlayerObjects(r.existingPlayer,patch)):toCreate.push(newPlayer({username:r.name,allianceTag:tagAll,...patch}));});
    (resolved?.fresh||[]).forEach(r=>toCreate.push(newPlayer({username:r.name,allianceTag:tagAll,...buildStats(r.name)})));
    if(toUpdate.length)onUpdateExisting(toUpdate);
    if(toCreate.length)onAddNew(toCreate);
    vibe([10,50,10]);resetAll();onClose();
  }

  const PL=['Names','Review','Details'];
  if (!open) return null;

  return (
    <div style={{ position:'fixed', inset:0, background:'#000a', zIndex:200, display:'flex', alignItems:'flex-end' }}>
      <div style={{ background:'#1E3A52', borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'92vh', overflowY:'auto', padding:'16px 20px 80px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontSize:18, fontWeight:700, color:'#FFFFFF' }}>Batch Add Players</div>
          <button onClick={handleClose} style={{ background:'none', border:'none', color:'#5A7A94', fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>

        {/* Phase stepper */}
        <div style={{ display:'flex', alignItems:'center', marginBottom:24 }}>
          {PL.map((l,i)=>(
            <div key={l} style={{ display:'flex', alignItems:'center', flex:1 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:i<phase?C.green:i===phase?C.gold:C.border, color:i<=phase?C.bg:C.muted, fontWeight:700, fontSize:12 }}>{i<phase?'✓':i+1}</div>
                <div style={{ fontSize:9, color:i===phase?C.gold:C.muted, marginTop:3, textAlign:'center' }}>{l}</div>
              </div>
              {i<PL.length-1&&<div style={{ height:2, flex:0.3, background:i<phase?C.green:C.border, marginBottom:14 }}/>}
            </div>
          ))}
        </div>

        {/* Phase 0 — Names */}
        {phase===0&&(
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:C.white, marginBottom:6 }}>Who's joining?</div>
            <div style={{ fontSize:13, color:C.icy, marginBottom:16 }}>Type names one at a time. Tap suggestions to link existing players.</div>
            {rawLines.length>0&&(
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                {rawLines.map((line,i)=>(
                  <div key={i} style={{ display:'inline-flex', alignItems:'center', gap:6, background:line.linkedId?C.gold+'18':C.section, border:`1px solid ${line.linkedId?C.gold:C.border}`, borderRadius:20, padding:'6px 10px' }}>
                    <span style={{ fontSize:13, color:line.linkedId?C.gold:C.white }}>{line.text}{line.linkedId&&' ✓'}</span>
                    <button onClick={()=>removeLine(i)} style={{ background:'none', border:'none', color:C.muted, fontSize:16, cursor:'pointer', padding:0, lineHeight:1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ position:'relative', marginBottom:12 }}>
              <div style={{ display:'flex', gap:8 }}>
                <input value={inputText} onChange={e=>{setInputText(e.target.value);updateSuggestions(e.target.value);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();addLine(inputText);}}} placeholder="Type a name, press Enter to add…" style={{ flex:1, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, fontFamily:'inherit' }}/>
                <button onClick={()=>addLine(inputText)} disabled={!inputText.trim()} style={{ height:48, padding:'0 16px', borderRadius:10, background:inputText.trim()?C.gold:C.border, color:C.bg, fontWeight:700, fontSize:14, border:'none', cursor:inputText.trim()?'pointer':'default' }}>Add</button>
              </div>
              {suggestions.length>0&&(
                <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', zIndex:600, boxShadow:'0 8px 24px #000a' }}>
                  <div style={{ fontSize:11, color:C.muted, padding:'8px 14px 4px', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700 }}>Existing — tap to link</div>
                  {suggestions.map(p=>(
                    <button key={p.id} onClick={()=>{addLine(p.username||p.alias||'',p.id);vibe(8);}} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', background:'none', border:'none', borderTop:`1px solid ${C.border}22`, cursor:'pointer', textAlign:'left' }}>
                      <div style={{ width:30, height:30, borderRadius:'50%', background:C.muted+'33', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, color:C.white, flexShrink:0 }}>{initials(p.username||p.alias||'?')}</div>
                      <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:700, color:C.white }}>{p.username||p.alias||'?'}</div><div style={{ fontSize:11, color:C.muted }}>{p.allianceTag?`[${p.allianceTag}]`:''}</div></div>
                      <span style={{ fontSize:12, color:C.gold, fontWeight:600 }}>Link ›</span>
                    </button>
                  ))}
                  <button onClick={()=>addLine(inputText,null)} style={{ display:'block', width:'100%', padding:'10px 14px', background:'none', border:'none', borderTop:`1px solid ${C.border}22`, cursor:'pointer', textAlign:'left', fontSize:13, color:C.muted }}>+ Add "{inputText}" as new player</button>
                </div>
              )}
            </div>
            {rawLines.length>0&&<div style={{ fontSize:13, color:C.icy, marginBottom:12 }}><span style={{ color:C.white, fontWeight:600 }}>{rawLines.length}</span> entries · <span style={{ color:C.gold }}>{rawLines.filter(l=>l.linkedId).length} linked</span></div>}
            <button onClick={()=>setShowOpt(!showOpt)} style={{ background:'none', border:'none', color:C.gold, fontSize:14, cursor:'pointer', padding:'4px 0', marginBottom:12 }}>{showOpt?'▾':'▸'} Apply to everyone</button>
            {showOpt&&(
              <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Alliance</div>
                <AlliancePicker
                  value={tagAll}
                  onChange={setTagAll}
                  existingTags={[...new Set(members.map(p=>p.allianceTag).filter(Boolean))]}
                  placeholder="Or type a custom tag…"
                />
                {tagAll&&<div style={{ fontSize:12, color:C.green, marginTop:6 }}>✓ Will apply [{tagAll}] to all {rawLines.length} members</div>}
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={handleClose} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
              <button disabled={rawLines.length===0} onClick={resolve} style={{ flex:2, height:54, borderRadius:12, background:rawLines.length>0?C.gold:C.border, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:rawLines.length>0?'pointer':'default' }}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Phase 1 — Review */}
        {phase===1&&resolved&&(
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:C.white, marginBottom:6 }}>Review</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:20 }}>
              {[[resolved.fresh.length,'New',C.green],[resolved.exact.length,'Update',C.gold],[resolved.fuzzy.length,'Review',C.mar]].map(([c,l,col])=>(
                <div key={l} style={{ background:C.section, borderRadius:10, padding:12, textAlign:'center' }}><div style={{ fontSize:24, fontWeight:700, color:col }}>{c}</div><div style={{ fontSize:12, color:C.muted }}>{l}</div></div>
              ))}
            </div>
            {resolved.exact.length>0&&<div style={{ marginBottom:16 }}><div style={{ fontSize:13, fontWeight:700, color:C.gold, marginBottom:8 }}>✓ Will update</div>{resolved.exact.map(r=><div key={r.name} style={{ background:C.section, borderRadius:10, padding:'10px 14px', marginBottom:6, display:'flex', justifyContent:'space-between' }}><div style={{ fontSize:14, fontWeight:700, color:C.white }}>{r.name}</div><span style={{ fontSize:12, color:C.gold }}>Update</span></div>)}</div>}
            {resolved.fuzzy.length>0&&<div style={{ marginBottom:16 }}><div style={{ fontSize:13, fontWeight:700, color:C.mar, marginBottom:8 }}>⚠️ Possible duplicates</div>{resolved.fuzzy.map(r=>{const d=fuzzyDec[r.name]||'update';return(<div key={r.name} style={{ background:C.section, borderRadius:10, padding:14, marginBottom:8 }}><div style={{ marginBottom:8 }}><div style={{ fontSize:14, fontWeight:700, color:C.white }}>{r.name}</div><div style={{ fontSize:11, color:C.muted }}>similar to "{r.existingPlayer.username||r.existingPlayer.alias}" ({Math.round(r.score*100)}%)</div></div><div style={{ display:'flex', gap:8 }}>{[['update','Update',C.gold],['create','New',C.green],['skip','Skip',C.muted]].map(([v,l,c])=><button key={v} onClick={()=>setFuzzyDec(prev=>({...prev,[r.name]:v}))} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${d===v?c:C.border}`, background:d===v?c+'22':C.card, color:d===v?c:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>{l}</button>)}</div></div>);})}</div>}
            {resolved.fresh.length>0&&<div style={{ marginBottom:20 }}><div style={{ fontSize:13, fontWeight:700, color:C.green, marginBottom:8 }}>＋ New players</div>{resolved.fresh.map(r=><div key={r.name} style={{ background:C.section, borderRadius:10, padding:'10px 14px', marginBottom:6, display:'flex', justifyContent:'space-between' }}><div style={{ fontSize:14, fontWeight:700, color:C.white }}>{r.name}</div><span style={{ fontSize:12, color:C.green }}>New</span></div>)}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setPhase(0)} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>← Back</button>
              <button onClick={()=>{setPhase(2);vibe(8);}} style={{ flex:2, height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Continue →</button>
            </div>
          </div>
        )}

        {/* Phase 2 — Details: furnace, troop tiers, languages, joiner
            heroes. JoinerRegistry-styled: group shortcut for bulk
            values, then a flat list of expandable per-member cards. */}
        {phase===2&&(
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:C.white, marginBottom:4 }}>Member details</div>
            <div style={{ fontSize:13, color:C.icy, marginBottom:16 }}>Set values for everyone at once, or tap a member below to override.</div>

            <div style={{ background:C.section, borderRadius:12, borderLeft:`3px solid ${C.gold}`, padding:16, marginBottom:20 }}>
              <div style={{ fontSize:15, fontWeight:700, color:C.gold, marginBottom:4 }}>⚡ Group shortcut</div>
              <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>Tap members to include, then set their values below.</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
                {active.map(n=><button key={n} onClick={()=>{tog(grpSel,setGrpSel,n);vibe(8);}} style={{ padding:'8px 14px', borderRadius:20, minHeight:40, border:`1px solid ${grpSel.has(n)?C.gold:C.border}`, background:grpSel.has(n)?C.gold+'22':C.card, color:grpSel.has(n)?C.gold:C.icy, fontWeight:600, fontSize:14, cursor:'pointer' }}>{n}</button>)}
              </div>

              <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:6 }}>🔥 Furnace level</div>
              <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:14 }}>
                {TIER_OPTIONS.map(t=><button key={t} onClick={()=>setGrpStat(prev=>({...prev, furnaceLevel:prev.furnaceLevel===t?null:t}))} style={tierChipStyle(grpStat.furnaceLevel===t)}>{grpStat.furnaceLevel===t?'✓ ':''}{t}</button>)}
              </div>

              {TROOP_TYPES.map(([icon,c,k])=>(
                <div key={k} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:12, color:c, fontWeight:700, marginBottom:6 }}>{icon}</div>
                  <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>{TIER_OPTIONS.map(t=><button key={t} onClick={()=>setGrpStat(prev=>({...prev, troops:{...prev.troops,[k]:prev.troops[k]===t?null:t}}))} style={tierChipStyle(grpStat.troops[k]===t,c)}>{grpStat.troops[k]===t?'✓ ':''}{t}</button>)}</div>
                </div>
              ))}

              <div style={{ fontSize:12, color:C.icy, fontWeight:700, marginBottom:6, marginTop:4 }}>🌐 Languages spoken</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                {LANGUAGES.map(lang=>{
                  const sel = grpStat.languages.includes(lang);
                  return <button key={lang} onClick={()=>setGrpStat(prev=>({...prev, languages: sel?prev.languages.filter(l=>l!==lang):[...prev.languages,lang]}))} style={{ padding:'6px 12px', borderRadius:16, border:`2px solid ${sel?C.icy:C.border}`, background:sel?C.icy:C.section, color:sel?C.bg:C.muted, fontWeight:sel?800:600, fontSize:13, cursor:'pointer', minHeight:36 }}>{sel?'✓ ':''}{lang}</button>;
                })}
              </div>

              <div style={{ fontSize:12, color:C.gold, fontWeight:700, marginBottom:6 }}>🦸 Joiner heroes (Skill 5)</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {JOINER_HEROES.map(hero=>{
                  const sel = grpStat.joinerHeroes.includes(hero);
                  return <button key={hero} onClick={()=>setGrpStat(prev=>({...prev, joinerHeroes: sel?prev.joinerHeroes.filter(h=>h!==hero):[...prev.joinerHeroes,hero]}))} style={{ padding:'6px 12px', borderRadius:16, border:`2px solid ${sel?C.gold:C.border}`, background:sel?C.gold:C.section, color:sel?C.bg:C.muted, fontWeight:sel?800:600, fontSize:13, cursor:'pointer', minHeight:36 }}>{sel?'✓ ':''}{hero}</button>;
                })}
              </div>
            </div>

            {individualList.length>0&&(
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Individual overrides</div>
                {individualList.map(n=>(
                  <BatchMemberCard key={n} name={n} stat={memStat(n)} onChange={patch=>setMemStat(n,patch)}/>
                ))}
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setPhase(1)} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>← Back</button>
              <button onClick={buildAndSave} style={{ flex:2, height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>
                Save {active.length} Player{active.length!==1?'s':''}
              </button>
            </div>
            <button onClick={buildAndSave} style={{ display:'block', margin:'10px auto 0', background:'none', border:'none', color:C.muted, fontSize:13, cursor:'pointer' }}>Skip values →</button>
          </div>
        )}
      </div>
    </div>
  );
}
