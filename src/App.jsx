import { useState, useEffect, useRef } from "react";
import { loadData, saveData, exportData, importData, mergeData } from "./data/dataManager.js";

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg: "#0A1628", card: "#1E3A52", section: "#152236",
  gold: "#F5A623", white: "#FFFFFF", icy: "#A8C4D8",
  muted: "#5A7A94", inf: "#6B8CAE", lan: "#7BAE8C",
  mar: "#B8859A", red: "#FF453A", green: "#30D158",
  border: "#2A4A64",
};

const TIER_OPTIONS = ["T10","FC1","FC2","FC3","FC4","FC5","T11","T12"];
const ROLES = ["Rally Lead","Attack Team","Joiner","Garrison","Flexible","Reserve"];
const ROLE_COLORS = {
  "Rally Lead":C.gold,"Attack Team":C.red,"Joiner":C.mar,
  "Garrison":C.inf,"Flexible":C.lan,"Reserve":C.muted,
};
const ROLE_ICONS = {
  "Rally Lead":"👑","Attack Team":"⚔️","Joiner":"🏹",
  "Garrison":"🛡️","Flexible":"🔄","Reserve":"⏸️",
};

const HEROES_BY_GEN = [
  { gen:"Gen 1",  heroes:["Jessie","Jasser","Jeronimo","Seo-Yoon","Patrick","Bahiti","Ling Xue","Lumak Bokan"] },
  { gen:"Gen 2",  heroes:["Philly","Alonso"] },
  { gen:"Gen 3",  heroes:["Mia","Logan","Greg"] },
  { gen:"Gen 4",  heroes:["Reina","Ahmose","Lynn"] },
  { gen:"Gen 5",  heroes:["Norah","Hector","Gwen"] },
  { gen:"Gen 6",  heroes:["Wu Ming","Renee","Wayne"] },
  { gen:"Gen 7",  heroes:["Edith","Gordon","Bradley"] },
  { gen:"Gen 8",  heroes:["Gatot","Sonya","Hendrik"] },
  { gen:"Gen 9",  heroes:["Magnus","Fred","Xura"] },
  { gen:"Gen 10", heroes:["Gregory","Freya","Blanchette"] },
  { gen:"Gen 11", heroes:["Eleonora","Lloyd","Rufus"] },
];

// Region-based timezones — general, not UTC offsets
const TIMEZONES = [
  "Oceania","Southeast Asia","East Asia","South Asia",
  "Middle East","Eastern Europe","Central Europe","Western Europe",
  "UK & Ireland","West Africa","East Africa","South Africa",
  "Eastern North America","Central North America","Western North America",
  "Central America & Caribbean","South America (East)","South America (West)",
];

const LANGUAGES = [
  "English","Mandarin","Spanish","Portuguese","Russian","Arabic",
  "Turkish","German","French","Indonesian","Vietnamese","Thai",
  "Korean","Japanese","Polish","Italian","Dutch","Hindi","Malay","Other",
];

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Argentina","Australia","Austria",
  "Bangladesh","Belgium","Brazil","Cambodia","Canada","Chile","China",
  "Colombia","Czech Republic","Denmark","Egypt","Ethiopia","Finland",
  "France","Germany","Ghana","Greece","Hungary","India","Indonesia",
  "Iran","Iraq","Ireland","Israel","Italy","Japan","Jordan","Kazakhstan",
  "Kenya","Malaysia","Mexico","Morocco","Myanmar","Nepal","Netherlands",
  "New Zealand","Nigeria","Norway","Pakistan","Peru","Philippines","Poland",
  "Portugal","Romania","Russia","Saudi Arabia","Serbia","Singapore",
  "South Africa","South Korea","Spain","Sri Lanka","Sweden","Switzerland",
  "Taiwan","Thailand","Turkey","Ukraine","United Arab Emirates",
  "United Kingdom","United States","Venezuela","Vietnam","Other",
];

// ── Helpers ────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function vibe(p) { try { navigator.vibrate(p); } catch(e) {} }
function initials(name) {
  return (name||"?").split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase() || "?";
}
function fmtDate(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }
  catch { return null; }
}

function newPlayer(overrides={}) {
  return {
    id: uid(),
    // Identity
    fid: "",
    username: "",     // in-game username
    alias: "",        // real name or nickname
    allianceTag: "",
    country: "",
    timezone: "",
    languages: [],
    // Combat
    furnaceLevel: null,
    infantryCampLevel: null,
    lancerCampLevel: null,
    marksmanCampLevel: null,
    troops: { infantry:null, lancer:null, marksman:null },
    heroes: [],
    hasNoneChecked: false,
    roles: [],
    // Availability
    availability: { present:"available", timing:"unknown", lateBy:null, earlyBy:null, discord:"unknown" },
    teamAssignment: null,
    notes: "",
    // Meta
    profileLastUpdated: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── Shared UI primitives ───────────────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{hint}</div>}
    </div>
  );
}

function Inp({ value, onChange, placeholder, type="text", inputMode, style={} }) {
  return (
    <input type={type} inputMode={inputMode} value={value??""} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} style={{
        width:"100%", background:C.section, border:`1px solid ${C.border}`,
        borderRadius:10, padding:"12px 14px", fontSize:16, color:C.white,
        boxSizing:"border-box", fontFamily:"inherit", ...style,
      }} />
  );
}

function Sel({ value, onChange, options, placeholder }) {
  return (
    <select value={value||""} onChange={e=>onChange(e.target.value)} style={{
      width:"100%", background:C.section, border:`1px solid ${C.border}`,
      borderRadius:10, padding:"12px 14px", fontSize:16,
      color:value ? C.white : C.muted, boxSizing:"border-box", fontFamily:"inherit",
    }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function TierPill({ value, onChange, color }) {
  return (
    <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
      {TIER_OPTIONS.map(t => (
        <button key={t} onClick={()=>onChange(value===t?null:t)} style={{
          padding:"6px 12px", borderRadius:16, border:`1px solid ${value===t?color:C.border}`,
          background:value===t?color+"22":C.section, color:value===t?color:C.muted,
          fontWeight:600, fontSize:13, cursor:"pointer", whiteSpace:"nowrap", minHeight:36, flexShrink:0,
        }}>{t}</button>
      ))}
    </div>
  );
}

function AvailChip({ label, selected, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding:"8px 14px", borderRadius:20, minHeight:44,
      border:`1px solid ${selected?color:C.border}`,
      background:selected?color+"18":C.section,
      color:selected?color:C.icy, fontWeight:600, fontSize:14, cursor:"pointer",
      transition:"all 150ms ease",
    }}>{label}</button>
  );
}

function Toast({ msg, type="success" }) {
  if (!msg) return null;
  const color = type==="error"?C.red:type==="warning"?C.gold:C.green;
  return (
    <div style={{
      position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
      background:C.card+"ee", backdropFilter:"blur(12px)",
      border:`1px solid ${color}44`, borderRadius:20,
      padding:"10px 20px", fontSize:15, fontWeight:600, color,
      zIndex:500, whiteSpace:"nowrap", maxWidth:"90vw", pointerEvents:"none",
    }}>{msg}</div>
  );
}

// ── Player Profile Sheet ───────────────────────────────────────
function PlayerSheet({ player, open, onClose, onSave }) {
  const [p, setP] = useState(() => player||newPlayer());
  const [activeTab, setActiveTab] = useState("identity");

  useEffect(() => {
    if (open) {
      setP(player ? {...player} : newPlayer());
      setActiveTab("identity");
    }
  }, [open, player?.id]);

  function upd(key, val) {
    setP(prev => ({...prev, [key]:val, profileLastUpdated:new Date().toISOString()}));
  }
  function updTroop(key, val) {
    setP(prev => ({...prev, troops:{...prev.troops,[key]:val}, profileLastUpdated:new Date().toISOString()}));
  }
  function updAvail(patch) {
    setP(prev => ({...prev, availability:{...prev.availability,...patch}, profileLastUpdated:new Date().toISOString()}));
  }

  function handleSave() {
    onSave({...p, profileLastUpdated:p.profileLastUpdated||new Date().toISOString()});
    onClose();
    vibe(8);
  }

  const TABS = [
    {id:"identity", label:"👤 Identity"},
    {id:"combat",   label:"⚔️ Combat"},
    {id:"avail",    label:"📅 Availability"},
  ];

  if (!open) return null;

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:300,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:C.card, borderRadius:"20px 20px 0 0", width:"100%",
        maxHeight:"92vh", overflowY:"auto", padding:"16px 20px 100px",
      }}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}} />

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:18,fontWeight:700,color:C.white}}>{player?"Edit Player":"Add Player"}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>

        {/* Tab strip */}
        <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto"}}>
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
              padding:"8px 14px", borderRadius:20, whiteSpace:"nowrap",
              background:activeTab===t.id?C.gold+"22":C.section,
              border:`1px solid ${activeTab===t.id?C.gold:C.border}`,
              color:activeTab===t.id?C.gold:C.muted,
              fontWeight:600, fontSize:13, cursor:"pointer",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── IDENTITY ── */}
        {activeTab === "identity" && (
          <div>
            <Field label="WOS User ID / FID">
              <Inp value={p.fid} onChange={v=>upd("fid",v)} placeholder="e.g. 12345678" inputMode="numeric" />
            </Field>
            <Field label="In-Game Username">
              <Inp value={p.username} onChange={v=>upd("username",v)} placeholder="WOS username" />
            </Field>
            <Field label="Alias / Real Name">
              <Inp value={p.alias} onChange={v=>upd("alias",v)} placeholder="Nickname or real name" />
            </Field>
            <Field label="Alliance Tag">
              <Inp value={p.allianceTag} onChange={v=>upd("allianceTag",v)} placeholder="e.g. R3K" />
            </Field>
            <Field label="Country">
              <Sel value={p.country} onChange={v=>upd("country",v)} options={COUNTRIES} placeholder="Select country…" />
            </Field>
            <Field label="Region / Timezone">
              <Sel value={p.timezone} onChange={v=>upd("timezone",v)} options={TIMEZONES} placeholder="Select region…" />
            </Field>
            <Field label="Languages">
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {LANGUAGES.map(lang => {
                  const sel = p.languages?.includes(lang);
                  return (
                    <button key={lang} onClick={()=>{
                      const cur = p.languages||[];
                      upd("languages", sel?cur.filter(l=>l!==lang):[...cur,lang]);
                    }} style={{
                      padding:"6px 12px", borderRadius:16, minHeight:36,
                      border:`1px solid ${sel?C.icy:C.border}`,
                      background:sel?C.icy+"22":C.section,
                      color:sel?C.icy:C.muted, fontWeight:600, fontSize:13, cursor:"pointer",
                    }}>{lang}</button>
                  );
                })}
              </div>
            </Field>
            <Field label="Furnace Level">
              <Inp value={p.furnaceLevel??""} onChange={v=>upd("furnaceLevel",v?parseInt(v):null)}
                placeholder="e.g. 28" inputMode="numeric" type="number" />
            </Field>
            <Field label="Notes">
              <textarea value={p.notes||""} onChange={e=>upd("notes",e.target.value)}
                placeholder="Any notes about this player…"
                style={{width:"100%",minHeight:80,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:16,color:C.white,resize:"none",boxSizing:"border-box",fontFamily:"inherit"}} />
            </Field>
            {p.profileLastUpdated && (
              <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Last updated: {fmtDate(p.profileLastUpdated)}</div>
            )}
          </div>
        )}

        {/* ── COMBAT ── */}
        {activeTab === "combat" && (
          <div>
            {/* Camp levels */}
            <Field label="Camp Levels">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:4}}>
                {[["🛡️ Inf","infantryCampLevel",C.inf],["⚔️ Lan","lancerCampLevel",C.lan],["🏹 Mar","marksmanCampLevel",C.mar]].map(([label,key,color])=>(
                  <div key={key} style={{background:C.section,borderRadius:10,padding:10,textAlign:"center"}}>
                    <div style={{fontSize:11,color,fontWeight:700,marginBottom:6}}>{label}</div>
                    <input type="number" inputMode="numeric" value={p[key]??""} placeholder="–"
                      onChange={e=>upd(key,e.target.value?parseInt(e.target.value):null)}
                      style={{width:"100%",background:C.card,border:`1px solid ${color}44`,borderRadius:8,padding:"8px 0",fontSize:18,fontWeight:700,color,textAlign:"center",boxSizing:"border-box",fontFamily:"inherit"}} />
                  </div>
                ))}
              </div>
            </Field>

            <Field label="🛡️ Infantry Troop Tier">
              <TierPill value={p.troops.infantry} onChange={v=>updTroop("infantry",v)} color={C.inf} />
            </Field>
            <Field label="⚔️ Lancer Troop Tier">
              <TierPill value={p.troops.lancer} onChange={v=>updTroop("lancer",v)} color={C.lan} />
            </Field>
            <Field label="🏹 Marksman Troop Tier">
              <TierPill value={p.troops.marksman} onChange={v=>updTroop("marksman",v)} color={C.mar} />
            </Field>

            <Field label="Battle Roles" hint="Select all that apply">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {ROLES.map(role=>{
                  const sel = p.roles?.includes(role);
                  const color = ROLE_COLORS[role];
                  return (
                    <button key={role} onClick={()=>{
                      const cur = p.roles||[];
                      upd("roles",sel?cur.filter(r=>r!==role):[...cur,role]);
                    }} style={{
                      padding:"12px 14px",borderRadius:12,minHeight:48,textAlign:"left",position:"relative",
                      border:`1px solid ${sel?color:C.border}`,
                      background:sel?color+"18":C.section,
                      color:sel?color:C.muted,fontWeight:600,fontSize:14,cursor:"pointer",
                    }}>
                      {sel && <span style={{position:"absolute",top:8,right:10,fontSize:12}}>✓</span>}
                      {ROLE_ICONS[role]} {role}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Joiner Heroes at Skill 5" hint="Only Skill 5 counts">
              <button onClick={()=>{
                const next = !p.hasNoneChecked;
                upd("hasNoneChecked",next);
                if (next) upd("heroes",[]);
              }} style={{
                display:"flex",alignItems:"center",gap:10,padding:"10px 14px",width:"100%",marginBottom:12,
                background:p.hasNoneChecked?C.red+"18":C.section,
                border:`1px solid ${p.hasNoneChecked?C.red:C.border}`,
                borderRadius:10,color:p.hasNoneChecked?C.red:C.muted,
                fontSize:14,fontWeight:600,cursor:"pointer",boxSizing:"border-box",
              }}>{p.hasNoneChecked?"✓":"○"} Has none at Skill 5</button>

              {!p.hasNoneChecked && HEROES_BY_GEN.map(({gen,heroes})=>(
                <div key={gen}>
                  <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",margin:"12px 0 8px"}}>{gen}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {heroes.map(h=>{
                      const owned = p.heroes?.includes(h);
                      return (
                        <button key={h} onClick={()=>{
                          const cur = p.heroes||[];
                          upd("heroes",owned?cur.filter(x=>x!==h):[...cur,h]);
                        }} style={{
                          padding:"6px 12px",borderRadius:16,minHeight:36,
                          border:`1px solid ${owned?C.gold:C.border}`,
                          background:owned?C.gold+"18":C.section,
                          color:owned?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",
                        }}>{owned?"✓ ":""}{h}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Field>
          </div>
        )}

        {/* ── AVAILABILITY ── */}
        {activeTab === "avail" && (
          <div>
            <Field label="SvS Availability">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[["✅ Available","available",C.green],["❌ Unavailable","unavailable",C.red]].map(([label,val,color])=>(
                  <button key={val} onClick={()=>updAvail({present:val})} style={{
                    height:52,borderRadius:12,
                    border:`1px solid ${p.availability.present===val?color:C.border}`,
                    background:p.availability.present===val?color+"18":C.section,
                    color:p.availability.present===val?color:C.muted,
                    fontWeight:600,fontSize:15,cursor:"pointer",
                  }}>{label}</button>
                ))}
              </div>
            </Field>
            <Field label="Timing">
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[["⏰ On Time","on-time"],["🕐 Late","late"],["🚪 Leaving Early","early"],["❓ Unknown","unknown"]].map(([label,val])=>(
                  <button key={val} onClick={()=>updAvail({timing:val})} style={{
                    padding:"8px 14px",borderRadius:20,minHeight:40,
                    border:`1px solid ${p.availability.timing===val?C.gold:C.border}`,
                    background:p.availability.timing===val?C.gold+"18":C.section,
                    color:p.availability.timing===val?C.gold:C.muted,
                    fontWeight:600,fontSize:14,cursor:"pointer",
                  }}>{label}</button>
                ))}
              </div>
            </Field>
            <Field label="Discord During SvS">
              <div style={{display:"flex",gap:8}}>
                {[["🎙️ On Discord","yes"],["🔇 Not on Discord","no"],["❓ Unknown","unknown"]].map(([label,val])=>(
                  <button key={val} onClick={()=>updAvail({discord:val})} style={{
                    flex:1,height:44,borderRadius:12,
                    border:`1px solid ${p.availability.discord===val?C.icy:C.border}`,
                    background:p.availability.discord===val?C.icy+"18":C.section,
                    color:p.availability.discord===val?C.icy:C.muted,
                    fontWeight:600,fontSize:13,cursor:"pointer",
                  }}>{label}</button>
                ))}
              </div>
            </Field>
          </div>
        )}

        <button onClick={handleSave} style={{
          width:"100%",height:54,borderRadius:12,background:C.gold,
          color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginTop:8,
        }}>Save Player</button>
      </div>
    </div>
  );
}

// ── Batch Add Sheet ────────────────────────────────────────────
// Phase 0: Names (plain text, no FID lookup)
// Phase 1: Availability
// Phase 2: Troop Tiers
// Phase 3: Heroes
function BatchAddSheet({ open, onClose, members, onAdd }) {
  const [phase, setPhase] = useState(0);
  const [raw, setRaw] = useState("");
  const [tagAll, setTagAll] = useState("");
  const [tzAll, setTzAll] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  const [voiceSet, setVoiceSet] = useState(new Set());
  const [lateSet, setLateSet] = useState(new Set());
  const [lateBy, setLateBy] = useState("unknown");
  const [earlySet, setEarlySet] = useState(new Set());
  const [earlyBy, setEarlyBy] = useState("unknown");
  const [unavailSet, setUnavailSet] = useState(new Set());

  const [groupTierSel, setGroupTierSel] = useState(new Set());
  const [groupTroops, setGroupTroops] = useState({infantry:null,lancer:null,marksman:null});
  const [memberTroops, setMemberTroops] = useState({});
  const [tierIdx, setTierIdx] = useState(0);

  const [groupHeroSel, setGroupHeroSel] = useState(new Set());
  const [groupHeroes, setGroupHeroes] = useState([]);
  const [memberHeroes, setMemberHeroes] = useState({});
  const [memberHasNone, setMemberHasNone] = useState({});
  const [heroIdx, setHeroIdx] = useState(0);

  const existingNames = new Set(members.map(m=>(m.username||m.alias||"").toLowerCase()));
  const parsedNames = raw.split(/[\n,]/).map(n=>n.trim()).filter(Boolean);
  const newNames = parsedNames.filter(n=>!existingNames.has(n.toLowerCase()));
  const dupCount = parsedNames.length - newNames.length;

  const tierStack = newNames.filter(n=>!groupTierSel.has(n));
  const heroStack  = newNames.filter(n=>!groupHeroSel.has(n));

  function resetAll() {
    setPhase(0); setRaw(""); setTagAll(""); setTzAll(""); setShowOptional(false);
    setVoiceSet(new Set()); setLateSet(new Set()); setLateBy("unknown");
    setEarlySet(new Set()); setEarlyBy("unknown"); setUnavailSet(new Set());
    setGroupTierSel(new Set()); setGroupTroops({infantry:null,lancer:null,marksman:null});
    setMemberTroops({}); setTierIdx(0);
    setGroupHeroSel(new Set()); setGroupHeroes([]); setMemberHeroes({}); setMemberHasNone({}); setHeroIdx(0);
  }

  function handleClose() { resetAll(); onClose(); }

  function toggle(set, setFn, key) {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setFn(next);
  }

  function buildAndAdd() {
    const built = newNames.map(name => {
      const troops = groupTierSel.has(name)
        ? {...groupTroops}
        : (memberTroops[name]||{infantry:null,lancer:null,marksman:null});
      const heroes = groupHeroSel.has(name) ? [...groupHeroes] : (memberHeroes[name]||[]);
      const hasNone = memberHasNone[name]||false;
      return newPlayer({
        username: name,
        allianceTag: tagAll,
        timezone: tzAll,
        troops,
        heroes: hasNone?[]:heroes,
        hasNoneChecked: hasNone,
        availability: {
          present: unavailSet.has(name)?"unavailable":"available",
          timing: lateSet.has(name)?"late":earlySet.has(name)?"early":"unknown",
          lateBy: lateSet.has(name)?lateBy:null,
          earlyBy: earlySet.has(name)?earlyBy:null,
          discord: voiceSet.has(name)?"yes":"unknown",
        },
      });
    });
    onAdd(built);
    vibe([10,50,10]);
    handleClose();
  }

  const PHASES = ["Names","Availability","Troop Tiers","Heroes"];

  if (!open) return null;

  return (
    <div style={{position:"fixed",inset:0,background:"#000a",zIndex:200,display:"flex",alignItems:"flex-end"}}>
      <div style={{
        background:C.card,borderRadius:"20px 20px 0 0",width:"100%",
        maxHeight:"92vh",overflowY:"auto",padding:"16px 20px 80px",
      }}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}} />

        {/* Phase indicator */}
        <div style={{display:"flex",alignItems:"center",marginBottom:24}}>
          {PHASES.map((label,i)=>(
            <div key={label} style={{display:"flex",alignItems:"center",flex:1}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1}}>
                <div style={{
                  width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
                  background:i<phase?C.green:i===phase?C.gold:C.border,
                  color:i<=phase?C.bg:C.muted,fontWeight:700,fontSize:13,
                }}>{i<phase?"✓":i+1}</div>
                <div style={{fontSize:9,color:i===phase?C.gold:C.muted,marginTop:4,textAlign:"center"}}>{label}</div>
              </div>
              {i<PHASES.length-1 && <div style={{height:2,flex:0.4,background:i<phase?C.green:C.border,marginBottom:16}} />}
            </div>
          ))}
        </div>

        {/* ── PHASE 0: NAMES ── */}
        {phase === 0 && (
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Who's joining?</div>
            <div style={{fontSize:13,color:C.icy,marginBottom:16,lineHeight:1.6}}>
              Type or paste usernames — one per line or comma-separated.
            </div>

            <textarea value={raw} onChange={e=>setRaw(e.target.value)}
              placeholder={"Marcus\nCaroline, ZhangWei\nKira"}
              style={{
                width:"100%",minHeight:140,background:C.section,
                border:`1px solid ${C.border}`,borderRadius:12,padding:14,
                fontSize:18,color:C.white,lineHeight:1.8,
                resize:"none",boxSizing:"border-box",fontFamily:"inherit",
              }} />

            {/* Live chip preview */}
            {parsedNames.length > 0 && (
              <div style={{display:"flex",flexWrap:"wrap",gap:6,margin:"12px 0"}}>
                {parsedNames.map((n,i)=>{
                  const dup = existingNames.has(n.toLowerCase());
                  return (
                    <span key={i} style={{
                      display:"inline-flex",alignItems:"center",gap:6,
                      background:dup?C.red+"18":C.section,
                      border:`1px solid ${dup?C.red:C.border}`,
                      borderRadius:20,padding:"6px 12px",fontSize:13,
                      color:dup?C.red:C.white,
                    }}>{n}{dup&&<span style={{fontSize:11}}>· exists</span>}</span>
                  );
                })}
              </div>
            )}

            {parsedNames.length > 0 && (
              <div style={{fontSize:13,color:C.icy,marginBottom:16}}>
                <span style={{color:C.white,fontWeight:600}}>{newNames.length}</span> new
                {dupCount>0&&<span style={{color:C.red}}> · {dupCount} duplicate{dupCount!==1?"s":""} skipped</span>}
              </div>
            )}

            {/* Optional fields */}
            <button onClick={()=>setShowOptional(!showOptional)} style={{
              background:"none",border:"none",color:C.gold,fontSize:14,cursor:"pointer",padding:"4px 0",marginBottom:12,
            }}>{showOptional?"▾":"▸"} Set for all members (optional)</button>

            {showOptional && (
              <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}>
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:12,color:C.muted,display:"block",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Alliance Tag</label>
                  <Inp value={tagAll} onChange={setTagAll} placeholder="R3K" />
                </div>
                <div>
                  <label style={{fontSize:12,color:C.muted,display:"block",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Region / Timezone</label>
                  <Sel value={tzAll} onChange={setTzAll} options={TIMEZONES} placeholder="Select region…" />
                </div>
              </div>
            )}

            <button disabled={newNames.length===0} onClick={()=>{setPhase(1);vibe(8);}} style={{
              width:"100%",height:54,borderRadius:12,
              background:newNames.length>0?C.gold:C.border,
              color:C.bg,fontWeight:700,fontSize:17,border:"none",
              cursor:newNames.length>0?"pointer":"default",
            }}>Continue with {newNames.length} member{newNames.length!==1?"s":""} →</button>
          </div>
        )}

        {/* ── PHASE 1: AVAILABILITY ── */}
        {phase === 1 && (
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Before the battle</div>
            <div style={{fontSize:13,color:C.icy,marginBottom:24}}>Tap members to set their status.</div>

            {[
              {label:"🎙️ Who's on Discord voice?", set:voiceSet, setFn:setVoiceSet, color:C.gold},
              {label:"🕐 Who's arriving late?",    set:lateSet,  setFn:setLateSet,  color:C.icy,
                extra: lateSet.size>0 && (
                  <div style={{marginTop:10}}>
                    <div style={{fontSize:12,color:C.muted,marginBottom:8}}>How late?</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {["15 min","30 min","1 hr","Unknown"].map(opt=>(
                        <button key={opt} onClick={()=>setLateBy(opt)} style={{
                          padding:"6px 14px",borderRadius:20,minHeight:36,
                          border:`1px solid ${lateBy===opt?C.icy:C.border}`,
                          background:lateBy===opt?C.icy+"22":C.section,
                          color:lateBy===opt?C.icy:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",
                        }}>{opt}</button>
                      ))}
                    </div>
                  </div>
                ),
              },
              {label:"🚪 Who's leaving early?",   set:earlySet, setFn:setEarlySet, color:C.mar,
                extra: earlySet.size>0 && (
                  <div style={{marginTop:10}}>
                    <div style={{fontSize:12,color:C.muted,marginBottom:8}}>How early?</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {["30 min","1 hr","Unknown"].map(opt=>(
                        <button key={opt} onClick={()=>setEarlyBy(opt)} style={{
                          padding:"6px 14px",borderRadius:20,minHeight:36,
                          border:`1px solid ${earlyBy===opt?C.mar:C.border}`,
                          background:earlyBy===opt?C.mar+"22":C.section,
                          color:earlyBy===opt?C.mar:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",
                        }}>{opt}</button>
                      ))}
                    </div>
                  </div>
                ),
              },
              {label:"❌ Who won't make it?", set:unavailSet, setFn:setUnavailSet, color:C.red},
            ].map(({label,set,setFn,color,extra})=>(
              <div key={label} style={{marginBottom:28}}>
                <div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:8}}>{label}</div>
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  <button onClick={()=>setFn(new Set(newNames))} style={{fontSize:13,color:C.gold,background:"none",border:"none",cursor:"pointer"}}>Select all</button>
                  <span style={{color:C.muted}}>·</span>
                  <button onClick={()=>setFn(new Set())} style={{fontSize:13,color:C.gold,background:"none",border:"none",cursor:"pointer"}}>Clear</button>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {newNames.map(n=>(
                    <AvailChip key={n} label={n} selected={set.has(n)} color={color}
                      onClick={()=>{toggle(set,setFn,n);vibe(8);}} />
                  ))}
                </div>
                {extra}
              </div>
            ))}

            <button onClick={()=>{setPhase(2);vibe(8);}} style={{
              width:"100%",height:54,borderRadius:12,background:C.gold,
              color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginBottom:12,
            }}>Continue →</button>
            <button onClick={()=>setPhase(2)} style={{
              display:"block",margin:"0 auto",background:"none",border:"none",
              color:C.muted,fontSize:13,cursor:"pointer",padding:"8px 0",
            }}>I'll update availability during SvS →</button>
          </div>
        )}

        {/* ── PHASE 2: TROOP TIERS ── */}
        {phase === 2 && (
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Troop tiers</div>
            <div style={{fontSize:13,color:C.icy,marginBottom:20}}>Set the highest tier each member has unlocked.</div>

            {/* Group shortcut */}
            <div style={{background:C.section,borderRadius:12,borderLeft:`3px solid ${C.gold}`,padding:16,marginBottom:20}}>
              <div style={{fontSize:15,fontWeight:700,color:C.gold,marginBottom:4}}>⚡ Does a group share the same tiers?</div>
              <div style={{fontSize:13,color:C.icy,marginBottom:12}}>Select members, set once.</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
                {newNames.map(n=>(
                  <button key={n} onClick={()=>{toggle(groupTierSel,setGroupTierSel,n);vibe(8);}} style={{
                    padding:"8px 14px",borderRadius:20,minHeight:40,
                    border:`1px solid ${groupTierSel.has(n)?C.gold:C.border}`,
                    background:groupTierSel.has(n)?C.gold+"22":C.card,
                    color:groupTierSel.has(n)?C.gold:C.icy,fontWeight:600,fontSize:14,cursor:"pointer",
                  }}>{n}</button>
                ))}
              </div>
              {[["🛡️ Infantry",C.inf,"infantry"],["⚔️ Lancer",C.lan,"lancer"],["🏹 Marksman",C.mar,"marksman"]].map(([label,color,key])=>(
                <div key={key} style={{marginBottom:10}}>
                  <div style={{fontSize:12,color,fontWeight:700,marginBottom:6}}>{label}</div>
                  <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
                    {TIER_OPTIONS.map(t=>(
                      <button key={t} onClick={()=>setGroupTroops(prev=>({...prev,[key]:prev[key]===t?null:t}))} style={{
                        padding:"6px 12px",borderRadius:16,flexShrink:0,
                        border:`1px solid ${groupTroops[key]===t?color:C.border}`,
                        background:groupTroops[key]===t?color+"22":C.section,
                        color:groupTroops[key]===t?color:C.muted,
                        fontWeight:600,fontSize:13,cursor:"pointer",minHeight:36,
                      }}>{t}</button>
                    ))}
                  </div>
                </div>
              ))}
              {groupTierSel.size>0 && (
                <div style={{fontSize:13,color:C.green,marginTop:8}}>✓ Applied to {groupTierSel.size} member{groupTierSel.size!==1?"s":""}</div>
              )}
            </div>

            {/* Individual stack */}
            {tierStack.length>0 && (()=>{
              const cur = tierStack[tierIdx];
              const mt = memberTroops[cur]||{infantry:null,lancer:null,marksman:null};
              function setMT(field,val) {
                setMemberTroops(prev=>({...prev,[cur]:{...(prev[cur]||{infantry:null,lancer:null,marksman:null}),[field]:val}}));
              }
              return (
                <div>
                  <div style={{fontSize:13,color:C.icy,marginBottom:12}}>{tierStack.length} remaining individually</div>
                  <div style={{background:C.section,borderRadius:14,padding:18,marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
                      <div style={{fontSize:18,fontWeight:700,color:C.white}}>{cur}</div>
                      <div style={{fontSize:13,color:C.muted}}>{tierIdx+1} / {tierStack.length}</div>
                    </div>
                    {[["🛡️ Infantry",C.inf,"infantry"],["⚔️ Lancer",C.lan,"lancer"],["🏹 Marksman",C.mar,"marksman"]].map(([label,color,key])=>(
                      <div key={key} style={{marginBottom:10}}>
                        <div style={{fontSize:12,color,fontWeight:700,marginBottom:6}}>{label}</div>
                        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
                          {TIER_OPTIONS.map(t=>(
                            <button key={t} onClick={()=>setMT(key,mt[key]===t?null:t)} style={{
                              padding:"6px 12px",borderRadius:16,flexShrink:0,
                              border:`1px solid ${mt[key]===t?color:C.border}`,
                              background:mt[key]===t?color+"22":C.section,
                              color:mt[key]===t?color:C.muted,
                              fontWeight:600,fontSize:13,cursor:"pointer",minHeight:36,
                            }}>{t}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {mt.infantry && (
                      <button onClick={()=>{setMT("lancer",mt.infantry);setMT("marksman",mt.infantry);vibe(8);}} style={{
                        fontSize:13,color:C.gold,background:"none",border:"none",cursor:"pointer",padding:"4px 0",
                      }}>↳ Same for all three</button>
                    )}
                    {/* Stack dots */}
                    <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}>
                      {tierStack.map((_,i)=>(
                        <button key={i} onClick={()=>setTierIdx(i)} style={{
                          width:i===tierIdx?20:8,height:8,borderRadius:4,border:"none",cursor:"pointer",padding:0,
                          background:i<tierIdx?C.green:i===tierIdx?C.gold:C.border,transition:"all 200ms",
                        }} />
                      ))}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10,marginBottom:16}}>
                    {tierIdx>0 && (
                      <button onClick={()=>setTierIdx(i=>i-1)} style={{
                        flex:1,height:48,borderRadius:12,background:C.section,
                        border:`1px solid ${C.border}`,color:C.icy,fontWeight:600,fontSize:15,cursor:"pointer",
                      }}>← Back</button>
                    )}
                    {tierIdx<tierStack.length-1 && (
                      <button onClick={()=>{setTierIdx(i=>i+1);vibe(8);}} style={{
                        flex:2,height:48,borderRadius:12,background:C.gold,
                        color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer",
                      }}>Next →</button>
                    )}
                  </div>
                </div>
              );
            })()}

            <button onClick={()=>{setPhase(3);setHeroIdx(0);vibe(8);}} style={{
              width:"100%",height:54,borderRadius:12,background:C.gold,
              color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginBottom:12,
            }}>Continue →</button>
            <button onClick={()=>setPhase(3)} style={{
              display:"block",margin:"0 auto",background:"none",border:"none",
              color:C.muted,fontSize:13,cursor:"pointer",padding:"8px 0",
            }}>I'll add tiers later →</button>
          </div>
        )}

        {/* ── PHASE 3: HEROES ── */}
        {phase === 3 && (
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Joiner heroes at Skill 5</div>
            <div style={{fontSize:13,color:C.icy,marginBottom:20}}>Only Skill 5 heroes count. Tap to mark owned.</div>

            {/* Group shortcut */}
            <div style={{background:C.section,borderRadius:12,borderLeft:`3px solid ${C.gold}`,padding:16,marginBottom:20}}>
              <div style={{fontSize:15,fontWeight:700,color:C.gold,marginBottom:4}}>⚡ Does a group share the same heroes?</div>
              <div style={{fontSize:13,color:C.icy,marginBottom:12}}>Select members and heroes together.</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
                {newNames.map(n=>(
                  <button key={n} onClick={()=>{toggle(groupHeroSel,setGroupHeroSel,n);vibe(8);}} style={{
                    padding:"8px 14px",borderRadius:20,minHeight:40,
                    border:`1px solid ${groupHeroSel.has(n)?C.gold:C.border}`,
                    background:groupHeroSel.has(n)?C.gold+"22":C.card,
                    color:groupHeroSel.has(n)?C.gold:C.icy,fontWeight:600,fontSize:14,cursor:"pointer",
                  }}>{n}</button>
                ))}
              </div>
              {HEROES_BY_GEN.map(({gen,heroes})=>(
                <div key={gen}>
                  <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",margin:"10px 0 6px"}}>{gen}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {heroes.map(h=>{
                      const owned = groupHeroes.includes(h);
                      return (
                        <button key={h} onClick={()=>setGroupHeroes(prev=>owned?prev.filter(x=>x!==h):[...prev,h])} style={{
                          padding:"6px 12px",borderRadius:16,minHeight:36,
                          border:`1px solid ${owned?C.gold:C.border}`,
                          background:owned?C.gold+"18":C.section,
                          color:owned?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",
                        }}>{owned?"✓ ":""}{h}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {groupHeroSel.size>0 && (
                <div style={{fontSize:13,color:C.green,marginTop:10}}>✓ Applied to {groupHeroSel.size} member{groupHeroSel.size!==1?"s":""}</div>
              )}
            </div>

            {/* Individual stack */}
            {heroStack.length>0 && (()=>{
              const cur = heroStack[heroIdx];
              const curHeroes = memberHeroes[cur]||[];
              const curNone = memberHasNone[cur]||false;
              return (
                <div>
                  <div style={{fontSize:13,color:C.icy,marginBottom:12}}>{heroStack.length} remaining individually</div>
                  <div style={{background:C.section,borderRadius:14,padding:18,marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
                      <div style={{fontSize:18,fontWeight:700,color:C.white}}>{cur}</div>
                      <div style={{fontSize:13,color:C.muted}}>{heroIdx+1} / {heroStack.length}</div>
                    </div>
                    <button onClick={()=>{
                      setMemberHasNone(prev=>({...prev,[cur]:!curNone}));
                      if (!curNone) setMemberHeroes(prev=>({...prev,[cur]:[]}));
                    }} style={{
                      display:"flex",alignItems:"center",gap:10,padding:"10px 14px",width:"100%",
                      background:curNone?C.red+"18":C.card,border:`1px solid ${curNone?C.red:C.border}`,
                      borderRadius:10,color:curNone?C.red:C.muted,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:12,boxSizing:"border-box",
                    }}>{curNone?"✓":"○"} Has none at Skill 5</button>

                    {!curNone && HEROES_BY_GEN.map(({gen,heroes})=>(
                      <div key={gen}>
                        <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",margin:"10px 0 6px"}}>{gen}</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {heroes.map(h=>{
                            const owned = curHeroes.includes(h);
                            return (
                              <button key={h} onClick={()=>setMemberHeroes(prev=>({...prev,[cur]:owned?curHeroes.filter(x=>x!==h):[...curHeroes,h]}))} style={{
                                padding:"6px 12px",borderRadius:16,minHeight:36,
                                border:`1px solid ${owned?C.gold:C.border}`,
                                background:owned?C.gold+"18":C.card,
                                color:owned?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",
                              }}>{owned?"✓ ":""}{h}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}>
                      {heroStack.map((_,i)=>(
                        <button key={i} onClick={()=>setHeroIdx(i)} style={{
                          width:i===heroIdx?20:8,height:8,borderRadius:4,border:"none",cursor:"pointer",padding:0,
                          background:i<heroIdx?C.green:i===heroIdx?C.gold:C.border,transition:"all 200ms",
                        }} />
                      ))}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10,marginBottom:16}}>
                    {heroIdx>0 && (
                      <button onClick={()=>setHeroIdx(i=>i-1)} style={{
                        flex:1,height:48,borderRadius:12,background:C.section,
                        border:`1px solid ${C.border}`,color:C.icy,fontWeight:600,fontSize:15,cursor:"pointer",
                      }}>← Back</button>
                    )}
                    {heroIdx<heroStack.length-1 && (
                      <button onClick={()=>{setHeroIdx(i=>i+1);vibe(8);}} style={{
                        flex:2,height:48,borderRadius:12,background:C.gold,
                        color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer",
                      }}>Next →</button>
                    )}
                  </div>
                </div>
              );
            })()}

            <button onClick={buildAndAdd} style={{
              width:"100%",height:54,borderRadius:12,background:C.gold,
              color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginBottom:12,
            }}>Finish & Add {newNames.length} Member{newNames.length!==1?"s":""}</button>
            <button onClick={buildAndAdd} style={{
              display:"block",margin:"0 auto",background:"none",border:"none",
              color:C.muted,fontSize:13,cursor:"pointer",padding:"8px 0",
            }}>I'll add heroes later →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Player Card ────────────────────────────────────────────────
function PlayerCard({ player, onClick, onDelete }) {
  const { username, alias, allianceTag, country, timezone, troops, heroes, roles, availability, profileLastUpdated } = player;
  const displayName = username || alias || "Unknown";
  const primaryRole = roles?.[0];
  const roleColor = primaryRole ? ROLE_COLORS[primaryRole] : C.muted;

  const glyphs = [];
  if (availability?.discord === "yes") glyphs.push("🎙️");
  if (availability?.timing === "late") glyphs.push("🕐");
  if (availability?.timing === "early") glyphs.push("🚪");
  if (availability?.present === "unavailable") glyphs.push("❌");

  return (
    <div onClick={onClick} style={{
      background:C.card,borderRadius:12,padding:"14px 16px",marginBottom:10,
      display:"flex",alignItems:"center",gap:12,
      cursor:"pointer",WebkitTapHighlightColor:"transparent",userSelect:"none",
    }}>
      {/* Avatar */}
      <div style={{
        width:48,height:48,borderRadius:"50%",flexShrink:0,
        background:roleColor+"33",border:`2px solid ${roleColor}`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontWeight:700,fontSize:17,color:C.white,
      }}>{initials(displayName)}</div>

      {/* Info */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
          <div style={{fontSize:16,fontWeight:700,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {displayName}
          </div>
          {glyphs.map((g,i)=><span key={i} style={{fontSize:13}}>{g}</span>)}
        </div>
        <div style={{fontSize:12,color:C.icy,marginBottom:4}}>
          {[allianceTag&&`[${allianceTag}]`, country, timezone].filter(Boolean).join(" · ")}
        </div>
        {alias && username && (
          <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{alias}</div>
        )}
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {[["🛡️",troops?.infantry,C.inf],["⚔️",troops?.lancer,C.lan],["🏹",troops?.marksman,C.mar]].map(([icon,tier,color],i)=>(
            <span key={i} style={{
              fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:8,
              background:(tier?color:C.muted)+"22",border:`1px solid ${(tier?color:C.muted)}33`,
              color:tier?color:C.muted,
            }}>{icon} {tier||"?"}</span>
          ))}
          {heroes?.slice(0,3).map(h=>(
            <span key={h} style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:8,background:C.gold+"18",border:`1px solid ${C.gold}33`,color:C.gold}}>✓ {h}</span>
          ))}
          {(heroes?.length??0)>3 && <span style={{fontSize:11,color:C.muted}}>+{heroes.length-3}</span>}
        </div>
        {profileLastUpdated && (
          <div style={{fontSize:11,color:C.muted,marginTop:4}}>Updated {fmtDate(profileLastUpdated)}</div>
        )}
      </div>

      {/* Delete */}
      <button onClick={e=>{e.stopPropagation();onDelete(player.id);}} style={{
        background:"none",border:"none",color:C.red+"88",fontSize:18,cursor:"pointer",padding:"8px",flexShrink:0,lineHeight:1,
      }}>✕</button>
    </div>
  );
}

// ── Data Panel ─────────────────────────────────────────────────
function DataPanel({ data, onImport, onClose }) {
  const fileRef = useRef();
  const [mode, setMode] = useState("replace");
  const [msg, setMsg] = useState(null);

  async function handleFileImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importData(file);
      onImport(imported, mode);
      setMsg({text:"✓ Data imported successfully",type:"success"});
      setTimeout(()=>setMsg(null),3000);
    } catch(err) {
      setMsg({text:`Import failed: ${err.message}`,type:"error"});
      setTimeout(()=>setMsg(null),4000);
    }
    e.target.value="";
  }

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:300,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",padding:"16px 20px 60px",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 20px"}} />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:700,color:C.white}}>📦 Export / Import</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>

        {msg && (
          <div style={{padding:"10px 14px",borderRadius:10,marginBottom:16,background:msg.type==="error"?C.red+"18":C.green+"18",color:msg.type==="error"?C.red:C.green,fontSize:14,fontWeight:600}}>
            {msg.text}
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:20}}>
          {[["Players",(data.players||[]).length],["Last saved",data.lastUpdated?fmtDate(data.lastUpdated):"Never"]].map(([label,val])=>(
            <div key={label} style={{background:C.section,borderRadius:10,padding:12,textAlign:"center"}}>
              <div style={{fontSize:val?.toString().length>4?14:22,fontWeight:700,color:C.gold}}>{val}</div>
              <div style={{fontSize:12,color:C.muted}}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:6}}>Export</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:12,lineHeight:1.5}}>
            Downloads all data as JSON. Paste into{" "}
            <code style={{color:C.icy,fontSize:12}}>/src/data/defaultData.json</code>{" "}
            to hardcode as seed data.
          </div>
          <button onClick={()=>exportData(data,data.settings?.allianceTag)} style={{
            width:"100%",height:48,borderRadius:10,background:C.gold,
            color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer",
          }}>⬇️ Download JSON</button>
        </div>

        <div style={{background:C.section,borderRadius:12,padding:16}}>
          <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:6}}>Import</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:12}}>Upload a previously exported JSON file.</div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {[["replace","Replace all"],["merge","Merge"]].map(([val,label])=>(
              <button key={val} onClick={()=>setMode(val)} style={{
                flex:1,height:40,borderRadius:10,
                border:`1px solid ${mode===val?C.gold:C.border}`,
                background:mode===val?C.gold+"22":C.card,
                color:mode===val?C.gold:C.muted,fontWeight:600,fontSize:14,cursor:"pointer",
              }}>{label}</button>
            ))}
          </div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
            {mode==="replace"?"⚠️ Replaces all current data.":"Merges players by ID — incoming wins on conflict."}
          </div>
          <input type="file" accept=".json" ref={fileRef} onChange={handleFileImport} style={{display:"none"}} />
          <button onClick={()=>fileRef.current?.click()} style={{
            width:"100%",height:48,borderRadius:10,background:C.section,
            border:`1px solid ${C.border}`,color:C.icy,fontWeight:700,fontSize:15,cursor:"pointer",
          }}>⬆️ Choose JSON File</button>
        </div>
      </div>
    </div>
  );
}

// ── Settings Panel ─────────────────────────────────────────────
function SettingsPanel({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings||{});
  function upd(k,v) { setS(prev=>({...prev,[k]:v})); }
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:300,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",padding:"16px 20px 60px",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 20px"}} />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:700,color:C.white}}>⚙️ Alliance Settings</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        <Field label="Alliance Name"><Inp value={s.allianceName} onChange={v=>upd("allianceName",v)} placeholder="Your alliance name" /></Field>
        <Field label="Alliance Tag"><Inp value={s.allianceTag} onChange={v=>upd("allianceTag",v)} placeholder="R3K" /></Field>
        <Field label="State ID"><Inp value={s.stateId} onChange={v=>upd("stateId",v)} placeholder="3543" inputMode="numeric" /></Field>
        <button onClick={()=>{onSave(s);onClose();vibe(8);}} style={{
          width:"100%",height:54,borderRadius:12,background:C.gold,
          color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",
        }}>Save Settings</button>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(()=>loadData());
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [dataPanel, setDataPanel] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(()=>{ saveData(data); },[data]);

  function showToast(msg,type="success") {
    setToast({msg,type});
    setTimeout(()=>setToast(null),2800);
  }

  function savePlayer(player) {
    const isEdit = data.players.some(p=>p.id===player.id);
    setData(prev=>{
      const players = isEdit
        ? prev.players.map(p=>p.id===player.id?player:p)
        : [...prev.players, player];
      return {...prev, players, lastUpdated:new Date().toISOString()};
    });
    showToast(isEdit?"Player updated ✓":"Player added ✓");
  }

  function addPlayers(newPlayers) {
    setData(prev=>({...prev, players:[...prev.players,...newPlayers], lastUpdated:new Date().toISOString()}));
    showToast(`${newPlayers.length} player${newPlayers.length!==1?"s":""} added ✓`);
  }

  function deletePlayer(id) {
    setData(prev=>({...prev, players:prev.players.filter(p=>p.id!==id), lastUpdated:new Date().toISOString()}));
    showToast("Player removed");
    setDeleteConfirm(null);
  }

  function handleImport(imported, mode) {
    setData(prev=>{
      if (mode==="merge") return {...mergeData(prev,imported), lastUpdated:new Date().toISOString()};
      return {...prev,...imported, lastUpdated:new Date().toISOString()};
    });
    showToast(`Imported (${mode}) ✓`);
    setDataPanel(false);
  }

  function openAdd() { setEditingPlayer(null); setSheetOpen(true); }
  function openEdit(player) { setEditingPlayer(player); setSheetOpen(true); }
  function handleSheetClose() { setSheetOpen(false); setEditingPlayer(null); }

  const players = data.players||[];
  const filteredPlayers = players.filter(p=>{
    const target = (p.username||p.alias||"").toLowerCase();
    const matchSearch = !search
      || target.includes(search.toLowerCase())
      || (p.allianceTag||"").toLowerCase().includes(search.toLowerCase())
      || (p.country||"").toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole==="All" || p.roles?.includes(filterRole);
    return matchSearch && matchRole;
  });

  const TABS = [
    {icon:"👥", label:"Roster"},
    {icon:"⚔️", label:"Teams"},
    {icon:"📋", label:"Plan"},
    {icon:"📊", label:"Stats"},
  ];

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.white,fontFamily:"system-ui,-apple-system,sans-serif",paddingBottom:80,maxWidth:480,margin:"0 auto"}}>

      {/* Header */}
      <div style={{padding:"20px 20px 14px",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.bg,zIndex:50}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:20,fontWeight:700,color:C.white}}>🏰 {data.settings?.allianceName||"Rally Planner"}</div>
            <div style={{fontSize:13,color:C.muted}}>
              {data.settings?.allianceTag?`[${data.settings.allianceTag}] · `:""}
              State {data.settings?.stateId||"3543"} · {players.length} players
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setDataPanel(true)} style={{height:36,padding:"0 12px",borderRadius:20,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontSize:13,fontWeight:600,cursor:"pointer"}}>📦</button>
            <button onClick={()=>setSettingsPanel(true)} style={{height:36,padding:"0 12px",borderRadius:20,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontSize:13,fontWeight:600,cursor:"pointer"}}>⚙️</button>
          </div>
        </div>
      </div>

      {/* ── ROSTER TAB ── */}
      {tab===0 && (
        <div style={{padding:"16px 20px 0"}}>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search name, tag, country…"
              style={{flex:1,height:48,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"0 14px",fontSize:16,color:C.white,fontFamily:"inherit"}} />
            <button onClick={()=>setBatchOpen(true)} style={{height:48,padding:"0 12px",borderRadius:10,background:"none",border:`1px solid ${C.gold}`,color:C.gold,fontWeight:700,fontSize:14,cursor:"pointer"}}>⚡ Batch</button>
            <button onClick={openAdd} style={{height:48,padding:"0 14px",borderRadius:10,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>＋</button>
          </div>

          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,marginBottom:4}}>
            {["All",...ROLES].map(r=>(
              <button key={r} onClick={()=>setFilterRole(r)} style={{
                padding:"7px 14px",borderRadius:20,whiteSpace:"nowrap",
                background:filterRole===r?C.gold+"22":C.section,
                border:`1px solid ${filterRole===r?C.gold:C.border}`,
                color:filterRole===r?C.gold:C.muted,
                fontWeight:600,fontSize:13,cursor:"pointer",minHeight:36,
              }}>{r}</button>
            ))}
          </div>

          {players.length>0 && (
            <div style={{fontSize:13,color:C.muted,marginBottom:12}}>
              {filteredPlayers.length} of {players.length} player{players.length!==1?"s":""}
            </div>
          )}

          {players.length===0 && (
            <div style={{textAlign:"center",padding:"60px 20px"}}>
              <div style={{fontSize:52,marginBottom:16}}>👥</div>
              <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:8}}>No players yet</div>
              <div style={{fontSize:15,color:C.muted,marginBottom:28}}>Batch add your alliance or add players one by one</div>
              <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                <button onClick={()=>setBatchOpen(true)} style={{height:52,padding:"0 24px",borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>⚡ Batch Add</button>
                <button onClick={openAdd} style={{height:52,padding:"0 24px",borderRadius:12,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:700,fontSize:15,cursor:"pointer"}}>＋ Add One</button>
                <button onClick={()=>setDataPanel(true)} style={{height:52,padding:"0 24px",borderRadius:12,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:700,fontSize:15,cursor:"pointer"}}>⬆️ Import</button>
              </div>
            </div>
          )}

          {players.length>0 && filteredPlayers.length===0 && (
            <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>No results for "{search||filterRole}"</div>
          )}

          {filteredPlayers.map(p=>(
            <PlayerCard key={p.id} player={p} onClick={()=>openEdit(p)} onDelete={id=>setDeleteConfirm(id)} />
          ))}
        </div>
      )}

      {/* ── TEAMS TAB ── */}
      {tab===1 && (
        <div style={{padding:"16px 20px"}}>
          {(()=>{
            const avail = players.filter(p=>p.availability?.present==="available");
            const byRole = ROLES.map(role=>({role,members:avail.filter(p=>p.roles?.includes(role))})).filter(g=>g.members.length>0);
            return (
              <>
                <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}>
                  <div style={{fontSize:13,color:C.icy,marginBottom:4}}>Available for SvS</div>
                  <div style={{fontSize:28,fontWeight:700,color:C.white}}>
                    {avail.length} <span style={{fontSize:16,color:C.muted}}>of {players.length}</span>
                  </div>
                </div>
                {byRole.map(({role,members})=>(
                  <div key={role} style={{marginBottom:16}}>
                    <div style={{fontSize:13,fontWeight:700,color:ROLE_COLORS[role],textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>
                      {ROLE_ICONS[role]} {role} · {members.length}
                    </div>
                    {members.map(m=>(
                      <div key={m.id} onClick={()=>openEdit(m)} style={{
                        background:C.card,borderRadius:10,padding:"10px 14px",marginBottom:6,
                        display:"flex",justifyContent:"space-between",alignItems:"center",
                        cursor:"pointer",WebkitTapHighlightColor:"transparent",
                      }}>
                        <div>
                          <div style={{fontWeight:700,color:C.white,fontSize:15}}>{m.username||m.alias||"Unknown"}</div>
                          <div style={{fontSize:12,color:C.icy}}>
                            {[m.furnaceLevel&&`FC${m.furnaceLevel}`,m.allianceTag&&`[${m.allianceTag}]`,m.timezone].filter(Boolean).join(" · ")}
                            {m.availability?.timing==="late"?" · 🕐":""}
                            {m.availability?.discord==="yes"?" · 🎙️":""}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:4}}>
                          {[m.troops?.infantry,m.troops?.lancer,m.troops?.marksman].map((t,i)=>(
                            <span key={i} style={{fontSize:11,padding:"2px 6px",borderRadius:6,background:[C.inf,C.lan,C.mar][i]+"22",color:[C.inf,C.lan,C.mar][i]}}>{t||"?"}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {players.length===0 && <div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>Add players in the Roster tab first</div>}
              </>
            );
          })()}
        </div>
      )}

      {/* ── PLAN TAB ── */}
      {tab===2 && (
        <div style={{padding:"40px 20px",textAlign:"center",color:C.muted}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontSize:16}}>Plan tab — coming next iteration</div>
        </div>
      )}

      {/* ── STATS TAB ── */}
      {tab===3 && (
        <div style={{padding:"16px 20px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            {[
              ["👥","Total Players",   players.length],
              ["👑","Rally Leads",     players.filter(p=>p.roles?.includes("Rally Lead")).length],
              ["✅","Available",       players.filter(p=>p.availability?.present==="available").length],
              ["⚔️","Skill 5 Heroes", players.filter(p=>p.heroes?.length>0).length],
              ["🎙️","On Discord",     players.filter(p=>p.availability?.discord==="yes").length],
              ["🌏","Countries",      new Set(players.map(p=>p.country).filter(Boolean)).size],
            ].map(([icon,label,val])=>(
              <div key={label} style={{background:C.card,borderRadius:12,padding:16}}>
                <div style={{fontSize:22}}>{icon}</div>
                <div style={{fontSize:28,fontWeight:700,color:C.gold}}>{val}</div>
                <div style={{fontSize:13,color:C.icy}}>{label}</div>
              </div>
            ))}
          </div>

          {/* Country breakdown */}
          {(()=>{
            const counts={};
            players.forEach(p=>{if(p.country)counts[p.country]=(counts[p.country]||0)+1;});
            const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
            if(!sorted.length)return null;
            return (
              <div style={{background:C.card,borderRadius:12,padding:16,marginBottom:16}}>
                <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:12}}>🌏 Countries</div>
                {sorted.map(([country,count])=>(
                  <div key={country} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{fontSize:14,color:C.icy}}>{country}</div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:80,height:6,borderRadius:3,background:C.border,overflow:"hidden"}}>
                        <div style={{width:`${(count/players.length)*100}%`,height:"100%",background:C.gold,borderRadius:3}} />
                      </div>
                      <div style={{fontSize:14,fontWeight:700,color:C.gold,width:20,textAlign:"right"}}>{count}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Top heroes */}
          {(()=>{
            const counts={};
            players.forEach(p=>p.heroes?.forEach(h=>{counts[h]=(counts[h]||0)+1;}));
            const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
            if(!top.length)return null;
            return (
              <div style={{background:C.card,borderRadius:12,padding:16}}>
                <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:12}}>🏅 Top Heroes (Skill 5)</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {top.map(([hero,count])=>(
                    <div key={hero} style={{padding:"8px 12px",borderRadius:20,background:C.gold+"18",border:`1px solid ${C.gold}33`}}>
                      <span style={{color:C.gold,fontWeight:600,fontSize:13}}>✓ {hero}</span>
                      <span style={{color:C.muted,fontSize:12,marginLeft:6}}>×{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {players.length===0 && <div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>Add players to see stats</div>}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{position:"fixed",inset:0,background:"#000b",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:C.card,borderRadius:16,padding:24,width:"100%",maxWidth:320}}>
            <div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:8}}>Remove player?</div>
            <div style={{fontSize:14,color:C.muted,marginBottom:20}}>This can't be undone. Export first if you want a backup.</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setDeleteConfirm(null)} style={{flex:1,height:48,borderRadius:10,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:600,fontSize:15,cursor:"pointer"}}>Cancel</button>
              <button onClick={()=>deletePlayer(deleteConfirm)} style={{flex:1,height:48,borderRadius:10,background:C.red,color:C.white,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>Remove</button>
            </div>
          </div>
        </div>
      )}

      <PlayerSheet open={sheetOpen} player={editingPlayer} onClose={handleSheetClose} onSave={savePlayer} />
      <BatchAddSheet open={batchOpen} onClose={()=>setBatchOpen(false)} members={players} onAdd={addPlayers} />
      {dataPanel && <DataPanel data={data} onImport={handleImport} onClose={()=>setDataPanel(false)} />}
      {settingsPanel && <SettingsPanel settings={data.settings} onSave={s=>setData(prev=>({...prev,settings:s,lastUpdated:new Date().toISOString()}))} onClose={()=>setSettingsPanel(false)} />}

      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Tab bar */}
      <div style={{
        position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
        width:"100%",maxWidth:480,
        display:"grid",gridTemplateColumns:"repeat(4,1fr)",
        background:C.bg,borderTop:`1px solid ${C.border}`,height:60,zIndex:100,
      }}>
        {TABS.map((t,i)=>(
          <button key={i} onClick={()=>{setTab(i);vibe(8);}} style={{
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            background:"none",border:"none",cursor:"pointer",
            color:tab===i?C.gold:C.muted,
            gap:3,fontSize:10,fontWeight:600,transition:"color 150ms ease",
            WebkitTapHighlightColor:"transparent",
          }}>
            <span style={{fontSize:20}}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
