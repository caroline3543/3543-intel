import { useState, useEffect, useRef } from "react";
import {
  loadData, saveData, exportData, importData, mergeData,
  newEvent, newSnapshot, newPrepEntry, calcMetrics,
  EVENT_TYPES, normalizeName, resolveBatchNames, mergePlayerObjects,
} from "./data/dataManager.js";

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg:"#0A1628", card:"#1E3A52", section:"#152236",
  gold:"#F5A623", white:"#FFFFFF", icy:"#A8C4D8",
  muted:"#5A7A94", inf:"#6B8CAE", lan:"#7BAE8C",
  mar:"#B8859A", red:"#FF453A", green:"#30D158",
  border:"#2A4A64",
};

const TIER_OPTIONS = ["T10","FC1","FC2","FC3","FC4","FC5","T11","T12"];
const ROLES = ["Rally Lead","Attack Team","Joiner","Garrison","Flexible","Reserve"];
const ROLE_COLORS = { "Rally Lead":C.gold,"Attack Team":C.red,"Joiner":C.mar,"Garrison":C.inf,"Flexible":C.lan,"Reserve":C.muted };
const ROLE_ICONS  = { "Rally Lead":"👑","Attack Team":"⚔️","Joiner":"🏹","Garrison":"🛡️","Flexible":"🔄","Reserve":"⏸️" };
const EVENT_ICONS = { "SvS":"⚔️","Foundry":"🔥","Canyon Clash":"🏔️","Bear Trap":"🪤","Sunfire Castle":"🏰","Transfer Season":"🚀","Custom":"📋" };
const PERF_TAGS   = [
  { key:"strong",    label:"⭐ Strong",    color:C.gold  },
  { key:"reliable",  label:"✓ Reliable",   color:C.green },
  { key:"improving", label:"↑ Improving",  color:C.icy   },
  { key:"issue",     label:"⚠️ Issue",     color:C.red   },
  { key:"noshow",    label:"✗ No-show",    color:C.muted },
];

const TIMEZONES = ["Oceania","Southeast Asia","East Asia","South Asia","Middle East","Eastern Europe","Central Europe","Western Europe","UK & Ireland","West Africa","East Africa","South Africa","Eastern North America","Central North America","Western North America","Central America & Caribbean","South America (East)","South America (West)"];
const LANGUAGES  = ["English","Mandarin","Spanish","Portuguese","Russian","Arabic","Turkish","German","French","Indonesian","Vietnamese","Thai","Korean","Japanese","Polish","Italian","Dutch","Hindi","Malay","Other"];
// Israel removed as requested
const COUNTRIES  = ["Afghanistan","Albania","Algeria","Argentina","Australia","Austria","Bangladesh","Belgium","Brazil","Cambodia","Canada","Chile","China","Colombia","Czech Republic","Denmark","Egypt","Ethiopia","Finland","France","Germany","Ghana","Greece","Hungary","India","Indonesia","Iran","Iraq","Ireland","Italy","Japan","Jordan","Kazakhstan","Kenya","Malaysia","Mexico","Morocco","Myanmar","Nepal","Netherlands","New Zealand","Nigeria","Norway","Pakistan","Peru","Philippines","Poland","Portugal","Romania","Russia","Saudi Arabia","Serbia","Singapore","South Africa","South Korea","Spain","Sri Lanka","Sweden","Switzerland","Taiwan","Thailand","Turkey","Ukraine","United Arab Emirates","United Kingdom","United States","Venezuela","Vietnam","Other"];
const HEROES_BY_GEN = [{gen:"Gen 1",heroes:["Jessie","Jasser","Jeronimo","Seo-Yoon","Patrick","Bahiti","Ling Xue","Lumak Bokan"]},{gen:"Gen 2",heroes:["Philly","Alonso"]},{gen:"Gen 3",heroes:["Mia","Logan","Greg"]},{gen:"Gen 4",heroes:["Reina","Ahmose","Lynn"]},{gen:"Gen 5",heroes:["Norah","Hector","Gwen"]},{gen:"Gen 6",heroes:["Wu Ming","Renee","Wayne"]},{gen:"Gen 7",heroes:["Edith","Gordon","Bradley"]},{gen:"Gen 8",heroes:["Gatot","Sonya","Hendrik"]},{gen:"Gen 9",heroes:["Magnus","Fred","Xura"]},{gen:"Gen 10",heroes:["Gregory","Freya","Blanchette"]},{gen:"Gen 11",heroes:["Eleonora","Lloyd","Rufus"]}];

// ── Helpers ────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function vibe(p) { try{navigator.vibrate(p);}catch(e){} }
function initials(name) { return (name||"?").split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase()||"?"; }
function fmtDate(iso) { if(!iso)return null; try{return new Date(iso).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}catch{return null;} }
function fmtDateShort(iso) { if(!iso)return""; try{return new Date(iso).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}catch{return iso;} }
function numFmt(n) { if(n==null||n==="")return"—"; return Number(n).toLocaleString(); }

function newPlayer(overrides={}) {
  return { id:uid(), fid:"", username:"", alias:"", allianceTag:"", country:"", timezone:"", languages:[], furnaceLevel:null, infantryCampLevel:null, lancerCampLevel:null, marksmanCampLevel:null, troops:{infantry:null,lancer:null,marksman:null}, heroes:[], hasNoneChecked:false, roles:[], availability:{present:"available",timing:"unknown",lateBy:null,earlyBy:null,discord:"unknown"}, teamAssignment:null, notes:"", profileLastUpdated:null, createdAt:Date.now(), ...overrides };
}

// ── Shared UI primitives ───────────────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{label}</label>
      {children}
      {hint&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>{hint}</div>}
    </div>
  );
}
function Inp({ value, onChange, placeholder, type="text", inputMode, style={} }) {
  return <input type={type} inputMode={inputMode} value={value??""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:16,color:C.white,boxSizing:"border-box",fontFamily:"inherit",...style}} />;
}
function Sel({ value, onChange, options, placeholder }) {
  return <select value={value||""} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:16,color:value?C.white:C.muted,boxSizing:"border-box",fontFamily:"inherit"}}>{placeholder&&<option value="">{placeholder}</option>}{options.map(o=><option key={o} value={o}>{o}</option>)}</select>;
}
function TierPill({ value, onChange, color }) {
  return <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>{TIER_OPTIONS.map(t=><button key={t} onClick={()=>onChange(value===t?null:t)} style={{padding:"6px 12px",borderRadius:16,border:`1px solid ${value===t?color:C.border}`,background:value===t?color+"22":C.section,color:value===t?color:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",minHeight:36,flexShrink:0}}>{t}</button>)}</div>;
}
function ToggleRow({ label, value, onChange, colorOn=C.green, colorOff=C.red, tristate=false }) {
  function cycle() { if(!tristate){onChange(!value);return;} if(value===null)onChange(true); else if(value===true)onChange(false); else onChange(null); }
  const display = tristate
    ? (value===null?{label:"—",color:C.muted}:value?{label:"✓ Yes",color:colorOn}:{label:"✗ No",color:colorOff})
    : (value?{label:"✓ Yes",color:colorOn}:{label:"✗ No",color:colorOff});
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}22`}}>
      <div style={{fontSize:15,color:C.icy}}>{label}</div>
      <button onClick={cycle} style={{minWidth:72,height:34,borderRadius:20,border:`1px solid ${display.color}44`,background:display.color+"18",color:display.color,fontWeight:700,fontSize:13,cursor:"pointer"}}>{display.label}</button>
    </div>
  );
}
function Toast({ msg, type="success" }) {
  if(!msg)return null;
  const color=type==="error"?C.red:type==="warning"?C.gold:C.green;
  return <div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:C.card+"ee",backdropFilter:"blur(12px)",border:`1px solid ${color}44`,borderRadius:20,padding:"10px 20px",fontSize:15,fontWeight:600,color,zIndex:500,whiteSpace:"nowrap",maxWidth:"90vw",pointerEvents:"none"}}>{msg}</div>;
}
function AvailChip({ label, selected, color, onClick }) {
  return <button onClick={onClick} style={{padding:"8px 14px",borderRadius:20,minHeight:44,border:`1px solid ${selected?color:C.border}`,background:selected?color+"18":C.section,color:selected?color:C.icy,fontWeight:600,fontSize:14,cursor:"pointer",transition:"all 150ms ease"}}>{label}</button>;
}
function ReliabilityBadge({ score }) {
  if(score==null)return null;
  const color=score>=80?C.green:score>=50?C.gold:C.red;
  return <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,background:color+"18",border:`1px solid ${color}44`}}><span style={{fontSize:13,fontWeight:700,color}}>{score}</span><span style={{fontSize:11,color:C.muted}}>reliability</span></div>;
}

// ── Profile View (read-only) ───────────────────────────────────
function ProfileView({ player, open, onClose, onEdit, events }) {
  if (!open || !player) return null;
  const displayName = player.username||player.alias||"Unknown";
  const primaryRole = player.roles?.[0];
  const roleColor = primaryRole?ROLE_COLORS[primaryRole]:C.muted;
  const metrics = calcMetrics(player, events);

  const playerSnapshots = events.flatMap(ev=>
    (ev.snapshots||[]).filter(s=>s.playerId===player.id).map(s=>({...s,eventName:ev.name||ev.type,eventDate:ev.date,eventType:ev.type}))
  ).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:300,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"92vh",overflowY:"auto",padding:"16px 20px 80px"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}} />

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:roleColor+"33",border:`2px solid ${roleColor}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:22,color:C.white,flexShrink:0}}>{initials(displayName)}</div>
            <div>
              <div style={{fontSize:20,fontWeight:700,color:C.white}}>{displayName}</div>
              {player.alias&&player.username&&<div style={{fontSize:13,color:C.muted}}>{player.alias}</div>}
              {metrics&&<ReliabilityBadge score={metrics.reliabilityScore} />}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onEdit} style={{height:36,padding:"0 16px",borderRadius:20,background:C.gold,color:C.bg,fontWeight:700,fontSize:14,border:"none",cursor:"pointer"}}>Edit</button>
            <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button>
          </div>
        </div>

        {/* Identity section */}
        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Identity</div>
          {[
            ["FID", player.fid],
            ["Alliance", player.allianceTag?`[${player.allianceTag}]`:null],
            ["Country", player.country],
            ["Region", player.timezone],
            ["Languages", player.languages?.join(", ")],
            ["Furnace Level", player.furnaceLevel?`FC${player.furnaceLevel}`:null],
          ].filter(([,v])=>v).map(([label,val])=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}22`}}>
              <span style={{fontSize:14,color:C.muted}}>{label}</span>
              <span style={{fontSize:14,color:C.white,fontWeight:600,textAlign:"right",maxWidth:"60%"}}>{val}</span>
            </div>
          ))}
        </div>

        {/* Roles */}
        {player.roles?.length>0&&(
          <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Battle Roles</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {player.roles.map(role=>(
                <span key={role} style={{padding:"6px 14px",borderRadius:20,background:ROLE_COLORS[role]+"22",border:`1px solid ${ROLE_COLORS[role]}44`,color:ROLE_COLORS[role],fontWeight:600,fontSize:14}}>{ROLE_ICONS[role]} {role}</span>
              ))}
            </div>
          </div>
        )}

        {/* Combat stats */}
        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Combat Stats</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
            {[["🛡️ Inf",player.troops?.infantry,C.inf],["⚔️ Lan",player.troops?.lancer,C.lan],["🏹 Mar",player.troops?.marksman,C.mar]].map(([label,tier,color])=>(
              <div key={label} style={{background:C.card,borderRadius:10,padding:10,textAlign:"center"}}>
                <div style={{fontSize:11,color,fontWeight:700,marginBottom:4}}>{label}</div>
                <div style={{fontSize:16,fontWeight:700,color:tier?color:C.muted}}>{tier||"?"}</div>
              </div>
            ))}
          </div>
          {[["🛡️ Inf Camp",player.infantryCampLevel,C.inf],["⚔️ Lan Camp",player.lancerCampLevel,C.lan],["🏹 Mar Camp",player.marksmanCampLevel,C.mar]].some(([,v])=>v)&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[["🛡️ Inf Camp",player.infantryCampLevel,C.inf],["⚔️ Lan Camp",player.lancerCampLevel,C.lan],["🏹 Mar Camp",player.marksmanCampLevel,C.mar]].map(([label,val,color])=>(
                <div key={label} style={{background:C.card,borderRadius:10,padding:10,textAlign:"center"}}>
                  <div style={{fontSize:10,color,fontWeight:700,marginBottom:4}}>{label}</div>
                  <div style={{fontSize:15,fontWeight:700,color:val?color:C.muted}}>{val||"—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Heroes */}
        {player.heroes?.length>0&&(
          <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Skill 5 Heroes</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {player.heroes.map(h=><span key={h} style={{padding:"6px 12px",borderRadius:16,background:C.gold+"18",border:`1px solid ${C.gold}33`,color:C.gold,fontWeight:600,fontSize:13}}>✓ {h}</span>)}
            </div>
          </div>
        )}

        {/* Availability */}
        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Availability</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <span style={{padding:"6px 14px",borderRadius:20,background:(player.availability?.present==="available"?C.green:C.red)+"18",border:`1px solid ${(player.availability?.present==="available"?C.green:C.red)}44`,color:player.availability?.present==="available"?C.green:C.red,fontWeight:600,fontSize:14}}>
              {player.availability?.present==="available"?"✅ Available":"❌ Unavailable"}
            </span>
            {player.availability?.discord==="yes"&&<span style={{padding:"6px 14px",borderRadius:20,background:C.icy+"18",border:`1px solid ${C.icy}44`,color:C.icy,fontWeight:600,fontSize:14}}>🎙️ Discord</span>}
            {player.availability?.timing&&player.availability.timing!=="unknown"&&(
              <span style={{padding:"6px 14px",borderRadius:20,background:C.gold+"18",border:`1px solid ${C.gold}44`,color:C.gold,fontWeight:600,fontSize:14}}>
                {player.availability.timing==="late"?"🕐 Late":player.availability.timing==="early"?"🚪 Leaving Early":"⏰ On Time"}
              </span>
            )}
          </div>
        </div>

        {/* Metrics */}
        {metrics&&(
          <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Event History</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
              {[["Attendance",`${metrics.attendancePct}%`,metrics.attendancePct>=70?C.green:metrics.attendancePct>=40?C.gold:C.red],["Voice",`${metrics.voicePct}%`,C.icy],["Streak",`${metrics.streak}✓`,metrics.streak>=3?C.gold:C.white],["No-shows",metrics.noShows,metrics.noShows===0?C.green:C.red],["Events",`${metrics.attended}/${metrics.totalEvents}`,C.white],["Score",metrics.reliabilityScore,metrics.reliabilityScore>=70?C.green:metrics.reliabilityScore>=40?C.gold:C.red]].map(([label,val,color])=>(
                <div key={label} style={{background:C.card,borderRadius:10,padding:10,textAlign:"center"}}>
                  <div style={{fontSize:18,fontWeight:700,color}}>{val}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{label}</div>
                </div>
              ))}
            </div>
            {playerSnapshots.slice(0,5).map(s=>(
              <div key={s.snapshotId} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}22`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:C.white}}>{EVENT_ICONS[s.eventType]||"📋"} {s.eventName}</div>
                  <div style={{fontSize:11,color:C.muted}}>{fmtDateShort(s.eventDate)}</div>
                </div>
                <div style={{display:"flex",gap:4}}>
                  {s.attendance.attended===true&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:8,background:C.green+"18",color:C.green}}>✓</span>}
                  {s.attendance.noShow&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:8,background:C.red+"18",color:C.red}}>✗</span>}
                  {s.voice.joined===true&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:8,background:C.icy+"18",color:C.icy}}>🎙️</span>}
                  {s.performanceTag&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:8,background:PERF_TAGS.find(t=>t.key===s.performanceTag)?.color+"18",color:PERF_TAGS.find(t=>t.key===s.performanceTag)?.color}}>{PERF_TAGS.find(t=>t.key===s.performanceTag)?.label}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {player.notes&&(
          <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Notes</div>
            <div style={{fontSize:14,color:C.icy,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{player.notes}</div>
          </div>
        )}

        {player.profileLastUpdated&&<div style={{fontSize:11,color:C.muted,textAlign:"center"}}>Last updated {fmtDate(player.profileLastUpdated)}</div>}
      </div>
    </div>
  );
}

// ── Player Edit Sheet ──────────────────────────────────────────
function PlayerSheet({ player, open, onClose, onSave, events }) {
  const [p, setP] = useState(()=>player||newPlayer());
  const [activeTab, setActiveTab] = useState("identity");

  useEffect(()=>{ if(open){setP(player?{...player}:newPlayer());setActiveTab("identity");} },[open,player?.id]);

  function upd(key,val) { setP(prev=>({...prev,[key]:val,profileLastUpdated:new Date().toISOString()})); }
  function updTroop(key,val) { setP(prev=>({...prev,troops:{...prev.troops,[key]:val},profileLastUpdated:new Date().toISOString()})); }
  function updAvail(patch) { setP(prev=>({...prev,availability:{...prev.availability,...patch},profileLastUpdated:new Date().toISOString()})); }
  function handleSave() { onSave({...p,profileLastUpdated:p.profileLastUpdated||new Date().toISOString()}); onClose(); vibe(8); }

  const TABS = [{id:"identity",label:"👤 Identity"},{id:"combat",label:"⚔️ Combat"},{id:"avail",label:"📅 Availability"}];

  if(!open)return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:350,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"92vh",overflowY:"auto",padding:"16px 20px 100px"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}} />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:18,fontWeight:700,color:C.white}}>{player?"Edit Player":"Add Player"}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto"}}>
          {TABS.map(t=><button key={t.id} onClick={()=>setActiveTab(t.id)} style={{padding:"8px 14px",borderRadius:20,whiteSpace:"nowrap",background:activeTab===t.id?C.gold+"22":C.section,border:`1px solid ${activeTab===t.id?C.gold:C.border}`,color:activeTab===t.id?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{t.label}</button>)}
        </div>

        {activeTab==="identity"&&(
          <div>
            <Field label="In-Game Username"><Inp value={p.username} onChange={v=>upd("username",v)} placeholder="WOS username" /></Field>
            <Field label="Alias / Real Name"><Inp value={p.alias} onChange={v=>upd("alias",v)} placeholder="Nickname or real name" /></Field>
            <Field label="WOS User ID / FID"><Inp value={p.fid} onChange={v=>upd("fid",v)} placeholder="e.g. 12345678" inputMode="numeric" /></Field>
            <Field label="Alliance Tag"><Inp value={p.allianceTag} onChange={v=>upd("allianceTag",v)} placeholder="e.g. R3K" /></Field>
            <Field label="Country"><Sel value={p.country} onChange={v=>upd("country",v)} options={COUNTRIES} placeholder="Select country…" /></Field>
            <Field label="Region / Timezone"><Sel value={p.timezone} onChange={v=>upd("timezone",v)} options={TIMEZONES} placeholder="Select region…" /></Field>
            <Field label="Languages">
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {LANGUAGES.map(lang=>{const sel=p.languages?.includes(lang);return <button key={lang} onClick={()=>{const cur=p.languages||[];upd("languages",sel?cur.filter(l=>l!==lang):[...cur,lang]);}} style={{padding:"6px 12px",borderRadius:16,minHeight:36,border:`1px solid ${sel?C.icy:C.border}`,background:sel?C.icy+"22":C.section,color:sel?C.icy:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{lang}</button>;})}
              </div>
            </Field>
            <Field label="Furnace Level"><Inp value={p.furnaceLevel??""} onChange={v=>upd("furnaceLevel",v?parseInt(v):null)} placeholder="e.g. 28" inputMode="numeric" type="number" /></Field>
            <Field label="Notes"><textarea value={p.notes||""} onChange={e=>upd("notes",e.target.value)} placeholder="Any notes…" style={{width:"100%",minHeight:80,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:16,color:C.white,resize:"none",boxSizing:"border-box",fontFamily:"inherit"}} /></Field>
            {p.profileLastUpdated&&<div style={{fontSize:11,color:C.muted,marginBottom:16}}>Last updated: {fmtDate(p.profileLastUpdated)}</div>}
          </div>
        )}

        {activeTab==="combat"&&(
          <div>
            <Field label="Camp Levels">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:4}}>
                {[["🛡️ Inf","infantryCampLevel",C.inf],["⚔️ Lan","lancerCampLevel",C.lan],["🏹 Mar","marksmanCampLevel",C.mar]].map(([label,key,color])=>(
                  <div key={key} style={{background:C.section,borderRadius:10,padding:10,textAlign:"center"}}>
                    <div style={{fontSize:11,color,fontWeight:700,marginBottom:6}}>{label}</div>
                    <input type="number" inputMode="numeric" value={p[key]??""} placeholder="–" onChange={e=>upd(key,e.target.value?parseInt(e.target.value):null)} style={{width:"100%",background:C.card,border:`1px solid ${color}44`,borderRadius:8,padding:"8px 0",fontSize:18,fontWeight:700,color,textAlign:"center",boxSizing:"border-box",fontFamily:"inherit"}} />
                  </div>
                ))}
              </div>
            </Field>
            <Field label="🛡️ Infantry Tier"><TierPill value={p.troops.infantry} onChange={v=>updTroop("infantry",v)} color={C.inf} /></Field>
            <Field label="⚔️ Lancer Tier"><TierPill value={p.troops.lancer} onChange={v=>updTroop("lancer",v)} color={C.lan} /></Field>
            <Field label="🏹 Marksman Tier"><TierPill value={p.troops.marksman} onChange={v=>updTroop("marksman",v)} color={C.mar} /></Field>
            <Field label="Battle Roles" hint="Select all that apply">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {ROLES.map(role=>{const sel=p.roles?.includes(role);const color=ROLE_COLORS[role];return <button key={role} onClick={()=>{const cur=p.roles||[];upd("roles",sel?cur.filter(r=>r!==role):[...cur,role]);}} style={{padding:"12px 14px",borderRadius:12,minHeight:48,textAlign:"left",position:"relative",border:`1px solid ${sel?color:C.border}`,background:sel?color+"18":C.section,color:sel?color:C.muted,fontWeight:600,fontSize:14,cursor:"pointer"}}>{sel&&<span style={{position:"absolute",top:8,right:10,fontSize:12}}>✓</span>}{ROLE_ICONS[role]} {role}</button>;})}
              </div>
            </Field>
            <Field label="Joiner Heroes at Skill 5" hint="Only Skill 5 counts">
              <button onClick={()=>{const next=!p.hasNoneChecked;upd("hasNoneChecked",next);if(next)upd("heroes",[]);}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",width:"100%",marginBottom:12,background:p.hasNoneChecked?C.red+"18":C.section,border:`1px solid ${p.hasNoneChecked?C.red:C.border}`,borderRadius:10,color:p.hasNoneChecked?C.red:C.muted,fontSize:14,fontWeight:600,cursor:"pointer",boxSizing:"border-box"}}>{p.hasNoneChecked?"✓":"○"} Has none at Skill 5</button>
              {!p.hasNoneChecked&&HEROES_BY_GEN.map(({gen,heroes})=>(
                <div key={gen}><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",margin:"12px 0 8px"}}>{gen}</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{heroes.map(h=>{const owned=p.heroes?.includes(h);return <button key={h} onClick={()=>{const cur=p.heroes||[];upd("heroes",owned?cur.filter(x=>x!==h):[...cur,h]);}} style={{padding:"6px 12px",borderRadius:16,minHeight:36,border:`1px solid ${owned?C.gold:C.border}`,background:owned?C.gold+"18":C.section,color:owned?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{owned?"✓ ":""}{h}</button>;})}
                </div></div>
              ))}
            </Field>
          </div>
        )}

        {activeTab==="avail"&&(
          <div>
            <Field label="SvS Availability">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[["✅ Available","available",C.green],["❌ Unavailable","unavailable",C.red]].map(([label,val,color])=>(
                  <button key={val} onClick={()=>updAvail({present:val})} style={{height:52,borderRadius:12,border:`1px solid ${p.availability.present===val?color:C.border}`,background:p.availability.present===val?color+"18":C.section,color:p.availability.present===val?color:C.muted,fontWeight:600,fontSize:15,cursor:"pointer"}}>{label}</button>
                ))}
              </div>
            </Field>
            <Field label="Timing">
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[["⏰ On Time","on-time"],["🕐 Late","late"],["🚪 Leaving Early","early"],["❓ Unknown","unknown"]].map(([label,val])=>(
                  <button key={val} onClick={()=>updAvail({timing:val})} style={{padding:"8px 14px",borderRadius:20,minHeight:40,border:`1px solid ${p.availability.timing===val?C.gold:C.border}`,background:p.availability.timing===val?C.gold+"18":C.section,color:p.availability.timing===val?C.gold:C.muted,fontWeight:600,fontSize:14,cursor:"pointer"}}>{label}</button>
                ))}
              </div>
            </Field>
            <Field label="Discord During SvS">
              <div style={{display:"flex",gap:8}}>
                {[["🎙️ On Discord","yes"],["🔇 Not on Discord","no"],["❓ Unknown","unknown"]].map(([label,val])=>(
                  <button key={val} onClick={()=>updAvail({discord:val})} style={{flex:1,height:44,borderRadius:12,border:`1px solid ${p.availability.discord===val?C.icy:C.border}`,background:p.availability.discord===val?C.icy+"18":C.section,color:p.availability.discord===val?C.icy:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{label}</button>
                ))}
              </div>
            </Field>
          </div>
        )}

        <button onClick={handleSave} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginTop:8}}>Save Player</button>
      </div>
    </div>
  );
}

// ── Batch Add Sheet ────────────────────────────────────────────
function BatchAddSheet({ open, onClose, members, onAddNew, onUpdateExisting }) {
  const [phase, setPhase] = useState(0); // 0=input, 1=preview/review, 2=availability, 3=tiers, 4=heroes
  const [raw, setRaw] = useState("");
  const [tagAll, setTagAll] = useState("");
  const [tzAll, setTzAll] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  // Resolution results
  const [resolved, setResolved] = useState(null); // { exact, fuzzy, fresh }
  // fuzzyDecisions: name -> "update" | "create" | "skip"
  const [fuzzyDecisions, setFuzzyDecisions] = useState({});

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

  const parsedNames = raw.split(/[\n,]/).map(n=>n.trim()).filter(Boolean);

  // All names that will be processed (excludes "skip" fuzzy decisions)
  function getActiveNames() {
    if (!resolved) return [];
    const names = [];
    resolved.exact.forEach(r=>names.push(r.name));
    resolved.fuzzy.forEach(r=>{ const d=fuzzyDecisions[r.name]; if(d==="update"||d==="create")names.push(r.name); });
    resolved.fresh.forEach(r=>names.push(r.name));
    return names;
  }
  const activeNames = getActiveNames();
  const tierStack = activeNames.filter(n=>!groupTierSel.has(n));
  const heroStack  = activeNames.filter(n=>!groupHeroSel.has(n));

  function resetAll() {
    setPhase(0);setRaw("");setTagAll("");setTzAll("");setShowOptional(false);
    setResolved(null);setFuzzyDecisions({});
    setVoiceSet(new Set());setLateSet(new Set());setLateBy("unknown");
    setEarlySet(new Set());setEarlyBy("unknown");setUnavailSet(new Set());
    setGroupTierSel(new Set());setGroupTroops({infantry:null,lancer:null,marksman:null});
    setMemberTroops({});setTierIdx(0);
    setGroupHeroSel(new Set());setGroupHeroes([]);setMemberHeroes({});setMemberHasNone({});setHeroIdx(0);
  }
  function handleClose() { resetAll(); onClose(); }
  function tog(set,setFn,key) { const n=new Set(set);n.has(key)?n.delete(key):n.add(key);setFn(n); }

  function handleResolve() {
    const res = resolveBatchNames(parsedNames, members);
    setResolved(res);
    // Default fuzzy decisions to "update"
    const decisions={};
    res.fuzzy.forEach(r=>{decisions[r.name]="update";});
    setFuzzyDecisions(decisions);
    setPhase(1);
    vibe(8);
  }

  function buildAvailability(name) {
    return {
      present: unavailSet.has(name)?"unavailable":"available",
      timing: lateSet.has(name)?"late":earlySet.has(name)?"early":"unknown",
      lateBy: lateSet.has(name)?lateBy:null,
      earlyBy: earlySet.has(name)?earlyBy:null,
      discord: voiceSet.has(name)?"yes":"unknown",
    };
  }
  function buildTroops(name) {
    return groupTierSel.has(name)?{...groupTroops}:(memberTroops[name]||{infantry:null,lancer:null,marksman:null});
  }
  function buildHeroes(name) {
    return groupHeroSel.has(name)?[...groupHeroes]:(memberHeroes[name]||[]);
  }

  function buildAndSave() {
    const toCreate = [];
    const toUpdate = [];

    // Exact matches → update
    (resolved?.exact||[]).forEach(r=>{
      const patch = {
        availability: buildAvailability(r.name),
        troops: buildTroops(r.name),
        heroes: buildHeroes(r.name),
        hasNoneChecked: memberHasNone[r.name]||false,
      };
      if (tagAll) patch.allianceTag = tagAll;
      if (tzAll)  patch.timezone    = tzAll;
      toUpdate.push(mergePlayerObjects(r.existingPlayer, patch));
    });

    // Fuzzy → based on decision
    (resolved?.fuzzy||[]).forEach(r=>{
      const d = fuzzyDecisions[r.name];
      if (d==="skip") return;
      const patch = {
        availability: buildAvailability(r.name),
        troops: buildTroops(r.name),
        heroes: buildHeroes(r.name),
        hasNoneChecked: memberHasNone[r.name]||false,
      };
      if (tagAll) patch.allianceTag = tagAll;
      if (tzAll)  patch.timezone    = tzAll;
      if (d==="update") {
        toUpdate.push(mergePlayerObjects(r.existingPlayer, patch));
      } else {
        toCreate.push(newPlayer({ username:r.name, allianceTag:tagAll, timezone:tzAll, ...patch }));
      }
    });

    // Fresh → create new
    (resolved?.fresh||[]).forEach(r=>{
      const hasNone = memberHasNone[r.name]||false;
      toCreate.push(newPlayer({
        username: r.name,
        allianceTag: tagAll,
        timezone: tzAll,
        troops: buildTroops(r.name),
        heroes: hasNone?[]:buildHeroes(r.name),
        hasNoneChecked: hasNone,
        availability: buildAvailability(r.name),
      }));
    });

    if (toUpdate.length) onUpdateExisting(toUpdate);
    if (toCreate.length) onAddNew(toCreate);
    vibe([10,50,10]);
    handleClose();
  }

  const PHASES_LABEL = ["Names","Review","Availability","Troop Tiers","Heroes"];

  if (!open) return null;

  return (
    <div style={{position:"fixed",inset:0,background:"#000a",zIndex:200,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"92vh",overflowY:"auto",padding:"16px 20px 80px"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}} />

        {/* Phase indicator */}
        <div style={{display:"flex",alignItems:"center",marginBottom:24}}>
          {PHASES_LABEL.map((label,i)=>(
            <div key={label} style={{display:"flex",alignItems:"center",flex:1}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1}}>
                <div style={{width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:i<phase?C.green:i===phase?C.gold:C.border,color:i<=phase?C.bg:C.muted,fontWeight:700,fontSize:12}}>{i<phase?"✓":i+1}</div>
                <div style={{fontSize:9,color:i===phase?C.gold:C.muted,marginTop:3,textAlign:"center"}}>{label}</div>
              </div>
              {i<PHASES_LABEL.length-1&&<div style={{height:2,flex:0.3,background:i<phase?C.green:C.border,marginBottom:14}} />}
            </div>
          ))}
        </div>

        {/* Phase 0: Names input */}
        {phase===0&&(
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Who's joining?</div>
            <div style={{fontSize:13,color:C.icy,marginBottom:16,lineHeight:1.6}}>
              Type or paste usernames — one per line or comma-separated. Existing players will be updated, not duplicated.
            </div>
            <textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder={"Marcus\nCaroline, ZhangWei\nKira"} style={{width:"100%",minHeight:140,background:C.section,border:`1px solid ${C.border}`,borderRadius:12,padding:14,fontSize:18,color:C.white,lineHeight:1.8,resize:"none",boxSizing:"border-box",fontFamily:"inherit"}} />
            {parsedNames.length>0&&<div style={{fontSize:13,color:C.icy,margin:"10px 0"}}><span style={{color:C.white,fontWeight:600}}>{parsedNames.length}</span> entries to process</div>}
            <button onClick={()=>setShowOptional(!showOptional)} style={{background:"none",border:"none",color:C.gold,fontSize:14,cursor:"pointer",padding:"4px 0",marginBottom:12}}>{showOptional?"▾":"▸"} Set for all (optional)</button>
            {showOptional&&(
              <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}>
                <div style={{marginBottom:12}}><label style={{fontSize:12,color:C.muted,display:"block",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Alliance Tag</label><Inp value={tagAll} onChange={setTagAll} placeholder="R3K" /></div>
                <div><label style={{fontSize:12,color:C.muted,display:"block",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Region</label><Sel value={tzAll} onChange={setTzAll} options={TIMEZONES} placeholder="Select region…" /></div>
              </div>
            )}
            <button disabled={parsedNames.length===0} onClick={handleResolve} style={{width:"100%",height:54,borderRadius:12,background:parsedNames.length>0?C.gold:C.border,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:parsedNames.length>0?"pointer":"default"}}>
              Continue →
            </button>
          </div>
        )}

        {/* Phase 1: Preview & fuzzy review */}
        {phase===1&&resolved&&(
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Review</div>
            <div style={{fontSize:13,color:C.icy,marginBottom:20}}>Confirm how each name will be handled.</div>

            {/* Summary */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:20}}>
              {[
                [resolved.fresh.length,"New players",C.green],
                [resolved.exact.length,"Will update",C.gold],
                [resolved.fuzzy.length,"Need review",C.mar],
              ].map(([count,label,color])=>(
                <div key={label} style={{background:C.section,borderRadius:10,padding:12,textAlign:"center"}}>
                  <div style={{fontSize:24,fontWeight:700,color}}>{count}</div>
                  <div style={{fontSize:12,color:C.muted}}>{label}</div>
                </div>
              ))}
            </div>

            {/* Exact updates */}
            {resolved.exact.length>0&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:8}}>✓ Will update existing players</div>
                {resolved.exact.map(r=>(
                  <div key={r.name} style={{background:C.section,borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:C.white}}>{r.name}</div>
                      <div style={{fontSize:11,color:C.muted}}>matches "{r.existingPlayer.username||r.existingPlayer.alias}"</div>
                    </div>
                    <span style={{fontSize:12,color:C.gold,fontWeight:600}}>Update</span>
                  </div>
                ))}
              </div>
            )}

            {/* Fuzzy — needs decision */}
            {resolved.fuzzy.length>0&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:700,color:C.mar,marginBottom:8}}>⚠️ Possible duplicates — choose action</div>
                {resolved.fuzzy.map(r=>{
                  const d=fuzzyDecisions[r.name]||"update";
                  return (
                    <div key={r.name} style={{background:C.section,borderRadius:10,padding:14,marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:C.white}}>{r.name}</div>
                          <div style={{fontSize:11,color:C.muted}}>similar to "{r.existingPlayer.username||r.existingPlayer.alias}" ({Math.round(r.score*100)}% match)</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        {[["update","Update existing",C.gold],["create","Create new",C.green],["skip","Skip",C.muted]].map(([val,label,color])=>(
                          <button key={val} onClick={()=>setFuzzyDecisions(prev=>({...prev,[r.name]:val}))} style={{flex:1,height:36,borderRadius:10,border:`1px solid ${d===val?color:C.border}`,background:d===val?color+"22":C.card,color:d===val?color:C.muted,fontWeight:600,fontSize:12,cursor:"pointer"}}>{label}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Fresh */}
            {resolved.fresh.length>0&&(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:700,color:C.green,marginBottom:8}}>＋ New players to create</div>
                {resolved.fresh.map(r=>(
                  <div key={r.name} style={{background:C.section,borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.white}}>{r.name}</div>
                    <span style={{fontSize:12,color:C.green,fontWeight:600}}>New</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={()=>{setPhase(2);vibe(8);}} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginBottom:12}}>Continue →</button>
            <button onClick={()=>setPhase(0)} style={{display:"block",margin:"0 auto",background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",padding:"8px 0"}}>← Back to names</button>
          </div>
        )}

        {/* Phase 2: Availability */}
        {phase===2&&(
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Before the battle</div>
            <div style={{fontSize:13,color:C.icy,marginBottom:24}}>Tap members to set their status.</div>
            {[
              {label:"🎙️ Who's on Discord voice?",set:voiceSet,setFn:setVoiceSet,color:C.gold},
              {label:"🕐 Who's arriving late?",set:lateSet,setFn:setLateSet,color:C.icy,extra:lateSet.size>0&&(<div style={{marginTop:10}}><div style={{fontSize:12,color:C.muted,marginBottom:8}}>How late?</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["15 min","30 min","1 hr","Unknown"].map(opt=><button key={opt} onClick={()=>setLateBy(opt)} style={{padding:"6px 14px",borderRadius:20,minHeight:36,border:`1px solid ${lateBy===opt?C.icy:C.border}`,background:lateBy===opt?C.icy+"22":C.section,color:lateBy===opt?C.icy:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{opt}</button>)}</div></div>)},
              {label:"🚪 Who's leaving early?",set:earlySet,setFn:setEarlySet,color:C.mar,extra:earlySet.size>0&&(<div style={{marginTop:10}}><div style={{fontSize:12,color:C.muted,marginBottom:8}}>How early?</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["30 min","1 hr","Unknown"].map(opt=><button key={opt} onClick={()=>setEarlyBy(opt)} style={{padding:"6px 14px",borderRadius:20,minHeight:36,border:`1px solid ${earlyBy===opt?C.mar:C.border}`,background:earlyBy===opt?C.mar+"22":C.section,color:earlyBy===opt?C.mar:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{opt}</button>)}</div></div>)},
              {label:"❌ Who won't make it?",set:unavailSet,setFn:setUnavailSet,color:C.red},
            ].map(({label,set,setFn,color,extra})=>(
              <div key={label} style={{marginBottom:28}}>
                <div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:8}}>{label}</div>
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  <button onClick={()=>setFn(new Set(activeNames))} style={{fontSize:13,color:C.gold,background:"none",border:"none",cursor:"pointer"}}>Select all</button>
                  <span style={{color:C.muted}}>·</span>
                  <button onClick={()=>setFn(new Set())} style={{fontSize:13,color:C.gold,background:"none",border:"none",cursor:"pointer"}}>Clear</button>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{activeNames.map(n=><AvailChip key={n} label={n} selected={set.has(n)} color={color} onClick={()=>{tog(set,setFn,n);vibe(8);}} />)}</div>
                {extra}
              </div>
            ))}
            <button onClick={()=>{setPhase(3);vibe(8);}} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginBottom:12}}>Continue →</button>
            <button onClick={()=>setPhase(3)} style={{display:"block",margin:"0 auto",background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",padding:"8px 0"}}>I'll update availability later →</button>
          </div>
        )}

        {/* Phase 3: Tiers */}
        {phase===3&&(
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Troop tiers</div>
            <div style={{fontSize:13,color:C.icy,marginBottom:20}}>Set highest unlocked tier. Only applies to new players or updates existing if blank.</div>
            <div style={{background:C.section,borderRadius:12,borderLeft:`3px solid ${C.gold}`,padding:16,marginBottom:20}}>
              <div style={{fontSize:15,fontWeight:700,color:C.gold,marginBottom:4}}>⚡ Group shortcut</div>
              <div style={{fontSize:13,color:C.icy,marginBottom:12}}>Select members who share the same tiers.</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>{activeNames.map(n=><button key={n} onClick={()=>{tog(groupTierSel,setGroupTierSel,n);vibe(8);}} style={{padding:"8px 14px",borderRadius:20,minHeight:40,border:`1px solid ${groupTierSel.has(n)?C.gold:C.border}`,background:groupTierSel.has(n)?C.gold+"22":C.card,color:groupTierSel.has(n)?C.gold:C.icy,fontWeight:600,fontSize:14,cursor:"pointer"}}>{n}</button>)}</div>
              {[["🛡️ Infantry",C.inf,"infantry"],["⚔️ Lancer",C.lan,"lancer"],["🏹 Marksman",C.mar,"marksman"]].map(([label,color,key])=>(
                <div key={key} style={{marginBottom:10}}>
                  <div style={{fontSize:12,color,fontWeight:700,marginBottom:6}}>{label}</div>
                  <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>{TIER_OPTIONS.map(t=><button key={t} onClick={()=>setGroupTroops(prev=>({...prev,[key]:prev[key]===t?null:t}))} style={{padding:"6px 12px",borderRadius:16,flexShrink:0,border:`1px solid ${groupTroops[key]===t?color:C.border}`,background:groupTroops[key]===t?color+"22":C.section,color:groupTroops[key]===t?color:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",minHeight:36}}>{t}</button>)}</div>
                </div>
              ))}
              {groupTierSel.size>0&&<div style={{fontSize:13,color:C.green,marginTop:8}}>✓ Applied to {groupTierSel.size} member{groupTierSel.size!==1?"s":""}</div>}
            </div>
            {tierStack.length>0&&(()=>{
              const cur=tierStack[tierIdx];
              const mt=memberTroops[cur]||{infantry:null,lancer:null,marksman:null};
              function setMT(f,v){setMemberTroops(prev=>({...prev,[cur]:{...(prev[cur]||{infantry:null,lancer:null,marksman:null}),[f]:v}}));}
              return (
                <div>
                  <div style={{fontSize:13,color:C.icy,marginBottom:12}}>{tierStack.length} remaining individually</div>
                  <div style={{background:C.section,borderRadius:14,padding:18,marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><div style={{fontSize:18,fontWeight:700,color:C.white}}>{cur}</div><div style={{fontSize:13,color:C.muted}}>{tierIdx+1}/{tierStack.length}</div></div>
                    {[["🛡️ Infantry",C.inf,"infantry"],["⚔️ Lancer",C.lan,"lancer"],["🏹 Marksman",C.mar,"marksman"]].map(([label,color,key])=>(
                      <div key={key} style={{marginBottom:10}}>
                        <div style={{fontSize:12,color,fontWeight:700,marginBottom:6}}>{label}</div>
                        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>{TIER_OPTIONS.map(t=><button key={t} onClick={()=>setMT(key,mt[key]===t?null:t)} style={{padding:"6px 12px",borderRadius:16,flexShrink:0,border:`1px solid ${mt[key]===t?color:C.border}`,background:mt[key]===t?color+"22":C.section,color:mt[key]===t?color:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",minHeight:36}}>{t}</button>)}</div>
                      </div>
                    ))}
                    {mt.infantry&&<button onClick={()=>{setMT("lancer",mt.infantry);setMT("marksman",mt.infantry);vibe(8);}} style={{fontSize:13,color:C.gold,background:"none",border:"none",cursor:"pointer",padding:"4px 0"}}>↳ Same for all three</button>}
                    <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}>{tierStack.map((_,i)=><button key={i} onClick={()=>setTierIdx(i)} style={{width:i===tierIdx?20:8,height:8,borderRadius:4,border:"none",cursor:"pointer",padding:0,background:i<tierIdx?C.green:i===tierIdx?C.gold:C.border,transition:"all 200ms"}} />)}</div>
                  </div>
                  <div style={{display:"flex",gap:10,marginBottom:16}}>
                    {tierIdx>0&&<button onClick={()=>setTierIdx(i=>i-1)} style={{flex:1,height:48,borderRadius:12,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:600,fontSize:15,cursor:"pointer"}}>← Back</button>}
                    {tierIdx<tierStack.length-1&&<button onClick={()=>{setTierIdx(i=>i+1);vibe(8);}} style={{flex:2,height:48,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>Next →</button>}
                  </div>
                </div>
              );
            })()}
            <button onClick={()=>{setPhase(4);setHeroIdx(0);vibe(8);}} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginBottom:12}}>Continue →</button>
            <button onClick={()=>setPhase(4)} style={{display:"block",margin:"0 auto",background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",padding:"8px 0"}}>I'll add tiers later →</button>
          </div>
        )}

        {/* Phase 4: Heroes */}
        {phase===4&&(
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Joiner heroes at Skill 5</div>
            <div style={{fontSize:13,color:C.icy,marginBottom:20}}>Only Skill 5 heroes count.</div>
            <div style={{background:C.section,borderRadius:12,borderLeft:`3px solid ${C.gold}`,padding:16,marginBottom:20}}>
              <div style={{fontSize:15,fontWeight:700,color:C.gold,marginBottom:4}}>⚡ Group shortcut</div>
              <div style={{fontSize:13,color:C.icy,marginBottom:12}}>Select members who share the same heroes.</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>{activeNames.map(n=><button key={n} onClick={()=>{tog(groupHeroSel,setGroupHeroSel,n);vibe(8);}} style={{padding:"8px 14px",borderRadius:20,minHeight:40,border:`1px solid ${groupHeroSel.has(n)?C.gold:C.border}`,background:groupHeroSel.has(n)?C.gold+"22":C.card,color:groupHeroSel.has(n)?C.gold:C.icy,fontWeight:600,fontSize:14,cursor:"pointer"}}>{n}</button>)}</div>
              {HEROES_BY_GEN.map(({gen,heroes})=>(
                <div key={gen}><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",margin:"10px 0 6px"}}>{gen}</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{heroes.map(h=>{const owned=groupHeroes.includes(h);return <button key={h} onClick={()=>setGroupHeroes(prev=>owned?prev.filter(x=>x!==h):[...prev,h])} style={{padding:"6px 12px",borderRadius:16,minHeight:36,border:`1px solid ${owned?C.gold:C.border}`,background:owned?C.gold+"18":C.section,color:owned?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{owned?"✓ ":""}{h}</button>;})}
                </div></div>
              ))}
              {groupHeroSel.size>0&&<div style={{fontSize:13,color:C.green,marginTop:10}}>✓ Applied to {groupHeroSel.size} member{groupHeroSel.size!==1?"s":""}</div>}
            </div>
            {heroStack.length>0&&(()=>{
              const cur=heroStack[heroIdx];const curHeroes=memberHeroes[cur]||[];const curNone=memberHasNone[cur]||false;
              return (
                <div>
                  <div style={{fontSize:13,color:C.icy,marginBottom:12}}>{heroStack.length} remaining individually</div>
                  <div style={{background:C.section,borderRadius:14,padding:18,marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><div style={{fontSize:18,fontWeight:700,color:C.white}}>{cur}</div><div style={{fontSize:13,color:C.muted}}>{heroIdx+1}/{heroStack.length}</div></div>
                    <button onClick={()=>{setMemberHasNone(prev=>({...prev,[cur]:!curNone}));if(!curNone)setMemberHeroes(prev=>({...prev,[cur]:[]}));}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",width:"100%",background:curNone?C.red+"18":C.card,border:`1px solid ${curNone?C.red:C.border}`,borderRadius:10,color:curNone?C.red:C.muted,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:12,boxSizing:"border-box"}}>{curNone?"✓":"○"} Has none at Skill 5</button>
                    {!curNone&&HEROES_BY_GEN.map(({gen,heroes})=>(
                      <div key={gen}><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",margin:"10px 0 6px"}}>{gen}</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{heroes.map(h=>{const owned=curHeroes.includes(h);return <button key={h} onClick={()=>setMemberHeroes(prev=>({...prev,[cur]:owned?curHeroes.filter(x=>x!==h):[...curHeroes,h]}))} style={{padding:"6px 12px",borderRadius:16,minHeight:36,border:`1px solid ${owned?C.gold:C.border}`,background:owned?C.gold+"18":C.card,color:owned?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{owned?"✓ ":""}{h}</button>;})}
                      </div></div>
                    ))}
                    <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}>{heroStack.map((_,i)=><button key={i} onClick={()=>setHeroIdx(i)} style={{width:i===heroIdx?20:8,height:8,borderRadius:4,border:"none",cursor:"pointer",padding:0,background:i<heroIdx?C.green:i===heroIdx?C.gold:C.border,transition:"all 200ms"}} />)}</div>
                  </div>
                  <div style={{display:"flex",gap:10,marginBottom:16}}>
                    {heroIdx>0&&<button onClick={()=>setHeroIdx(i=>i-1)} style={{flex:1,height:48,borderRadius:12,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:600,fontSize:15,cursor:"pointer"}}>← Back</button>}
                    {heroIdx<heroStack.length-1&&<button onClick={()=>{setHeroIdx(i=>i+1);vibe(8);}} style={{flex:2,height:48,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>Next →</button>}
                  </div>
                </div>
              );
            })()}
            <button onClick={buildAndSave} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginBottom:12}}>
              Finish & Save {activeNames.length} Player{activeNames.length!==1?"s":""}
            </button>
            <button onClick={buildAndSave} style={{display:"block",margin:"0 auto",background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",padding:"8px 0"}}>I'll add heroes later →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Player Card ────────────────────────────────────────────────
function PlayerCard({ player, onClick, onDelete, events }) {
  const displayName=player.username||player.alias||"Unknown";
  const primaryRole=player.roles?.[0];
  const roleColor=primaryRole?ROLE_COLORS[primaryRole]:C.muted;
  const metrics=calcMetrics(player,events);
  const glyphs=[];
  if(player.availability?.discord==="yes")glyphs.push("🎙️");
  if(player.availability?.timing==="late")glyphs.push("🕐");
  if(player.availability?.timing==="early")glyphs.push("🚪");
  if(player.availability?.present==="unavailable")glyphs.push("❌");

  return (
    <div onClick={onClick} style={{background:C.card,borderRadius:12,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:12,cursor:"pointer",WebkitTapHighlightColor:"transparent",userSelect:"none"}}>
      <div style={{width:48,height:48,borderRadius:"50%",flexShrink:0,background:roleColor+"33",border:`2px solid ${roleColor}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:17,color:C.white}}>{initials(displayName)}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
          <div style={{fontSize:16,fontWeight:700,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayName}</div>
          {glyphs.map((g,i)=><span key={i} style={{fontSize:13}}>{g}</span>)}
          {metrics&&<span style={{fontSize:11,fontWeight:700,color:metrics.reliabilityScore>=70?C.green:metrics.reliabilityScore>=40?C.gold:C.red,marginLeft:2}}>{metrics.reliabilityScore}pts</span>}
        </div>
        <div style={{fontSize:12,color:C.icy,marginBottom:4}}>{[player.allianceTag&&`[${player.allianceTag}]`,player.country,player.timezone].filter(Boolean).join(" · ")}</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {[["🛡️",player.troops?.infantry,C.inf],["⚔️",player.troops?.lancer,C.lan],["🏹",player.troops?.marksman,C.mar]].map(([icon,tier,color],i)=>(
            <span key={i} style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:8,background:(tier?color:C.muted)+"22",border:`1px solid ${(tier?color:C.muted)}33`,color:tier?color:C.muted}}>{icon} {tier||"?"}</span>
          ))}
          {player.heroes?.slice(0,3).map(h=><span key={h} style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:8,background:C.gold+"18",border:`1px solid ${C.gold}33`,color:C.gold}}>✓ {h}</span>)}
          {(player.heroes?.length??0)>3&&<span style={{fontSize:11,color:C.muted}}>+{player.heroes.length-3}</span>}
        </div>
        {player.profileLastUpdated&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>Updated {fmtDate(player.profileLastUpdated)}</div>}
      </div>
      <button onClick={e=>{e.stopPropagation();onDelete(player.id);}} style={{background:"none",border:"none",color:C.red+"88",fontSize:18,cursor:"pointer",padding:"8px",flexShrink:0,lineHeight:1}}>✕</button>
    </div>
  );
}

// ── Prep Score Tab ─────────────────────────────────────────────
function PrepScoreTab({ prepScores, players, onUpdate }) {
  const [sortBy, setSortBy] = useState("score_desc");
  const [filterTag, setFilterTag] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState(()=>newPrepEntry());
  const [batchRaw, setBatchRaw] = useState("");
  const [batchMode, setBatchMode] = useState(false);

  const allTags = [...new Set(prepScores.map(e=>e.allianceTag).filter(Boolean))];

  function save(entry) {
    const exists = prepScores.find(e=>e.id===entry.id);
    let updated;
    if (exists) {
      // Append to history if score changed
      const hist = entry.prepScore !== exists.prepScore
        ? [...(exists.history||[]), { score:exists.prepScore, timestamp:exists.lastUpdated }]
        : (exists.history||[]);
      updated = prepScores.map(e=>e.id===entry.id?{...entry,history:hist,lastUpdated:new Date().toISOString()}:e);
    } else {
      updated = [...prepScores, {...entry,lastUpdated:new Date().toISOString()}];
    }
    onUpdate(updated);
    setEditingId(null);
    setShowAdd(false);
    setNewEntry(newPrepEntry());
    vibe(8);
  }

  function deleteEntry(id) {
    onUpdate(prepScores.filter(e=>e.id!==id));
  }

  function applyBatch() {
    // Parse: "Name, Alliance, Score, Target"
    const lines = batchRaw.split("\n").map(l=>l.trim()).filter(Boolean);
    const newEntries = [];
    lines.forEach(line=>{
      const parts = line.split(/[,\t]/).map(p=>p.trim());
      if (!parts[0]) return;
      const playerName = parts[0];
      const allianceTag = parts[1]||"";
      const score = parts[2]?parseFloat(parts[2]):null;
      const target = parts[3]?parseFloat(parts[3]):null;
      // Try to link to existing player
      const linkedPlayer = players.find(p=>normalizeName(p.username||p.alias||"")===normalizeName(playerName));
      // Check if entry already exists
      const existing = prepScores.find(e=>normalizeName(e.playerName)===normalizeName(playerName));
      if (existing) {
        const hist = score!==null&&score!==existing.prepScore?[...(existing.history||[]),{score:existing.prepScore,timestamp:existing.lastUpdated}]:(existing.history||[]);
        newEntries.push({...existing,prepScore:score??existing.prepScore,targetScore:target??existing.targetScore,allianceTag:allianceTag||existing.allianceTag,history:hist,lastUpdated:new Date().toISOString()});
      } else {
        newEntries.push(newPrepEntry({playerName,allianceTag,prepScore:score,targetScore:target,playerId:linkedPlayer?.id||null}));
      }
    });
    // Merge
    const existingIds = new Set(newEntries.map(e=>e.id));
    const kept = prepScores.filter(e=>!newEntries.some(n=>normalizeName(n.playerName)===normalizeName(e.playerName)));
    onUpdate([...kept,...newEntries]);
    setBatchRaw("");
    setBatchMode(false);
    vibe(8);
  }

  let sorted = [...prepScores];
  if (filterTag) sorted = sorted.filter(e=>e.allianceTag===filterTag);
  sorted.sort((a,b)=>{
    if (sortBy==="score_desc") return (b.prepScore||0)-(a.prepScore||0);
    if (sortBy==="score_asc")  return (a.prepScore||0)-(b.prepScore||0);
    if (sortBy==="diff")       return ((b.targetScore||0)-(b.prepScore||0))-((a.targetScore||0)-(a.prepScore||0));
    if (sortBy==="name")       return (a.playerName||"").localeCompare(b.playerName||"");
    return 0;
  });

  function EntryForm({ entry, onSave, onCancel }) {
    const [e, setE] = useState({...entry});
    function upd(k,v){setE(prev=>({...prev,[k]:v}));}
    // Try to link to player
    const linked = players.find(p=>p.id===e.playerId||normalizeName(p.username||p.alias||"")===normalizeName(e.playerName));
    return (
      <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}>
        <Field label="Player Name"><Inp value={e.playerName} onChange={v=>upd("playerName",v)} placeholder="Player name" /></Field>
        {linked&&<div style={{fontSize:12,color:C.green,marginBottom:10}}>✓ Linked to roster: {linked.username||linked.alias}</div>}
        <Field label="Alliance Tag"><Inp value={e.allianceTag} onChange={v=>upd("allianceTag",v)} placeholder="R3K" /></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <Field label="Prep Score"><Inp value={e.prepScore??""} onChange={v=>upd("prepScore",v?parseFloat(v):null)} placeholder="0" type="number" inputMode="decimal" /></Field>
          <Field label="Target Score"><Inp value={e.targetScore??""} onChange={v=>upd("targetScore",v?parseFloat(v):null)} placeholder="0" type="number" inputMode="decimal" /></Field>
        </div>
        <Field label="Notes"><Inp value={e.notes||""} onChange={v=>upd("notes",v)} placeholder="Optional notes…" /></Field>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,height:44,borderRadius:10,background:C.card,border:`1px solid ${C.border}`,color:C.muted,fontWeight:600,fontSize:15,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>onSave(e)} style={{flex:2,height:44,borderRadius:10,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{padding:"16px 20px 0"}}>
      {/* Toolbar */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={()=>{setShowAdd(!showAdd);setNewEntry(newPrepEntry());}} style={{flex:1,height:44,borderRadius:10,background:C.gold,color:C.bg,fontWeight:700,fontSize:14,border:"none",cursor:"pointer"}}>＋ Add Entry</button>
        <button onClick={()=>setBatchMode(!batchMode)} style={{flex:1,height:44,borderRadius:10,background:batchMode?C.gold+"22":C.section,border:`1px solid ${batchMode?C.gold:C.border}`,color:batchMode?C.gold:C.icy,fontWeight:700,fontSize:14,cursor:"pointer"}}>⚡ Batch</button>
      </div>

      {/* Batch input */}
      {batchMode&&(
        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:6}}>Batch Update Prep Scores</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Format: Name, Alliance, Score, Target (one per line)</div>
          <textarea value={batchRaw} onChange={e=>setBatchRaw(e.target.value)} placeholder={"Caroline, R3K, 850000, 1000000\nMarcus, R3K, 720000, 1000000"} style={{width:"100%",minHeight:120,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:12,fontSize:15,color:C.white,resize:"none",boxSizing:"border-box",fontFamily:"inherit",lineHeight:1.8}} />
          <button onClick={applyBatch} disabled={!batchRaw.trim()} style={{width:"100%",height:44,borderRadius:10,background:batchRaw.trim()?C.gold:C.border,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:batchRaw.trim()?"pointer":"default",marginTop:10}}>Apply Batch</button>
        </div>
      )}

      {/* Add form */}
      {showAdd&&<EntryForm entry={newEntry} onSave={save} onCancel={()=>setShowAdd(false)} />}

      {/* Sort + filter */}
      <div style={{display:"flex",gap:8,marginBottom:12,overflowX:"auto"}}>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{height:36,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"0 10px",fontSize:13,color:C.white,cursor:"pointer"}}>
          <option value="score_desc">Score ↓</option>
          <option value="score_asc">Score ↑</option>
          <option value="diff">Gap to target ↓</option>
          <option value="name">Name A–Z</option>
        </select>
        {allTags.length>0&&(
          <select value={filterTag} onChange={e=>setFilterTag(e.target.value)} style={{height:36,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"0 10px",fontSize:13,color:C.white,cursor:"pointer"}}>
            <option value="">All alliances</option>
            {allTags.map(t=><option key={t} value={t}>[{t}]</option>)}
          </select>
        )}
      </div>

      {sorted.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:40,marginBottom:12}}>📈</div>
          <div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:8}}>No prep scores yet</div>
          <div style={{fontSize:14,color:C.muted}}>Add entries manually or use batch import</div>
        </div>
      )}

      {sorted.map(entry=>{
        const diff = entry.targetScore&&entry.prepScore!=null ? entry.targetScore-entry.prepScore : null;
        const pct  = entry.targetScore&&entry.prepScore!=null ? Math.min(100,Math.round((entry.prepScore/entry.targetScore)*100)) : null;
        const isEditing = editingId===entry.id;
        const linked = players.find(p=>p.id===entry.playerId);

        if (isEditing) return <EntryForm key={entry.id} entry={entry} onSave={save} onCancel={()=>setEditingId(null)} />;

        return (
          <div key={entry.id} style={{background:C.card,borderRadius:12,padding:"14px 16px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                  <div style={{fontSize:16,fontWeight:700,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.playerName}</div>
                  {entry.allianceTag&&<span style={{fontSize:12,color:C.icy,fontWeight:600}}>[{entry.allianceTag}]</span>}
                  {linked&&<span style={{fontSize:11,color:C.green}}>● roster</span>}
                </div>
                <div style={{fontSize:22,fontWeight:700,color:C.gold}}>{numFmt(entry.prepScore)}</div>
                {entry.targetScore&&<div style={{fontSize:13,color:C.muted}}>Target: {numFmt(entry.targetScore)}</div>}
              </div>
              <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <button onClick={()=>setEditingId(entry.id)} style={{height:32,padding:"0 12px",borderRadius:16,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontSize:13,cursor:"pointer"}}>Edit</button>
                <button onClick={()=>deleteEntry(entry.id)} style={{height:32,width:32,borderRadius:16,background:"none",border:"none",color:C.red+"88",fontSize:16,cursor:"pointer",lineHeight:1}}>✕</button>
              </div>
            </div>

            {/* Progress bar */}
            {pct!=null&&(
              <div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:12,color:pct>=100?C.green:pct>=70?C.gold:C.red,fontWeight:600}}>{pct}% of target</span>
                  {diff!=null&&diff>0&&<span style={{fontSize:12,color:C.muted}}>−{numFmt(diff)} to go</span>}
                  {diff!=null&&diff<=0&&<span style={{fontSize:12,color:C.green,fontWeight:700}}>✓ Target reached!</span>}
                </div>
                <div style={{height:6,borderRadius:3,background:C.border,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",borderRadius:3,background:pct>=100?C.green:pct>=70?C.gold:C.red,transition:"width 300ms ease"}} />
                </div>
              </div>
            )}

            {/* History sparkline (text) */}
            {(entry.history||[]).length>0&&(
              <div style={{fontSize:11,color:C.muted,marginBottom:6}}>
                History: {[...entry.history].slice(-4).map((h,i)=>(
                  <span key={i} style={{marginRight:8}}>{numFmt(h.score)} <span style={{color:C.border}}>({fmtDateShort(h.timestamp)})</span></span>
                ))}
              </div>
            )}

            {entry.notes&&<div style={{fontSize:13,color:C.icy,fontStyle:"italic"}}>"{entry.notes}"</div>}
            <div style={{fontSize:11,color:C.muted,marginTop:6}}>Updated {fmtDate(entry.lastUpdated)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Event Sheet ────────────────────────────────────────────────
function EventSheet({ event, open, onClose, onSave }) {
  const [ev,setEv]=useState(()=>event||newEvent());
  useEffect(()=>{if(open)setEv(event?{...event}:newEvent());},[open,event?.id]);
  function upd(k,v){setEv(prev=>({...prev,[k]:v}));}
  if(!open)return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:300,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"85vh",overflowY:"auto",padding:"16px 20px 80px"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}} />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:700,color:C.white}}>{event?"Edit Event":"New Event"}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        <Field label="Event Type">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {EVENT_TYPES.map(t=><button key={t} onClick={()=>upd("type",t)} style={{padding:"12px 14px",borderRadius:12,border:`1px solid ${ev.type===t?C.gold:C.border}`,background:ev.type===t?C.gold+"18":C.section,color:ev.type===t?C.gold:C.muted,fontWeight:600,fontSize:14,cursor:"pointer",textAlign:"left"}}>{EVENT_ICONS[t]||"📋"} {t}</button>)}
          </div>
        </Field>
        <Field label="Event Name / Label"><Inp value={ev.name} onChange={v=>upd("name",v)} placeholder="e.g. SvS Week 3 — May 2026" /></Field>
        <Field label="Date"><Inp type="date" value={ev.date} onChange={v=>upd("date",v)} /></Field>
        <Field label="Notes"><textarea value={ev.notes||""} onChange={e=>upd("notes",e.target.value)} placeholder="Pre-event notes…" style={{width:"100%",minHeight:72,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:16,color:C.white,resize:"none",boxSizing:"border-box",fontFamily:"inherit"}} /></Field>
        <button onClick={()=>{onSave(ev);onClose();vibe(8);}} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer"}}>Save Event</button>
      </div>
    </div>
  );
}

// ── Snapshot Editor ────────────────────────────────────────────
function SnapshotEditor({ snapshot, playerName, open, onClose, onSave }) {
  const [s,setS]=useState(()=>snapshot||{});
  useEffect(()=>{if(open&&snapshot)setS({...snapshot});},[open,snapshot?.snapshotId]);
  function updA(patch){setS(prev=>({...prev,attendance:{...prev.attendance,...patch}}));}
  function updV(patch){setS(prev=>({...prev,voice:{...prev.voice,...patch}}));}
  function updC(patch){setS(prev=>({...prev,combat:{...prev.combat,...patch}}));}
  function setTag(t){setS(prev=>({...prev,performanceTag:prev.performanceTag===t?null:t}));}
  if(!open||!snapshot)return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:400,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"92vh",overflowY:"auto",padding:"16px 20px 100px"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}} />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div><div style={{fontSize:18,fontWeight:700,color:C.white}}>{playerName}</div><div style={{fontSize:13,color:C.muted}}>Event record</div></div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Performance Tag</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{PERF_TAGS.map(t=><button key={t.key} onClick={()=>setTag(t.key)} style={{padding:"8px 14px",borderRadius:20,minHeight:36,border:`1px solid ${s.performanceTag===t.key?t.color:C.border}`,background:s.performanceTag===t.key?t.color+"18":C.section,color:s.performanceTag===t.key?t.color:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{t.label}</button>)}</div>
        </div>
        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:12}}>📅 Attendance</div>
          <ToggleRow label="Attended" value={s.attendance?.attended} onChange={v=>updA({attended:v})} tristate={true} />
          <ToggleRow label="Late" value={s.attendance?.late} onChange={v=>updA({late:v})} colorOn={C.gold} colorOff={C.muted} />
          <ToggleRow label="Left Early" value={s.attendance?.leftEarly} onChange={v=>updA({leftEarly:v})} colorOn={C.mar} colorOff={C.muted} />
          <ToggleRow label="No-show" value={s.attendance?.noShow} onChange={v=>updA({noShow:v})} colorOn={C.red} colorOff={C.muted} />
          <ToggleRow label="Stayed full event" value={s.attendance?.stayedFull} onChange={v=>updA({stayedFull:v})} />
          <ToggleRow label="Prep phase" value={s.attendance?.prepPhase} onChange={v=>updA({prepPhase:v})} />
          <ToggleRow label="Battle phase" value={s.attendance?.battlePhase} onChange={v=>updA({battlePhase:v})} />
        </div>
        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:12}}>🎙️ Discord Voice</div>
          <ToggleRow label="Joined voice" value={s.voice?.joined} onChange={v=>updV({joined:v})} tristate={true} />
          <ToggleRow label="On time" value={s.voice?.onTime} onChange={v=>updV({onTime:v})} />
          <ToggleRow label="Joined late" value={s.voice?.joinedLate} onChange={v=>updV({joinedLate:v})} colorOn={C.gold} colorOff={C.muted} />
          <ToggleRow label="Left voice early" value={s.voice?.leftEarly} onChange={v=>updV({leftEarly:v})} colorOn={C.mar} colorOff={C.muted} />
          <div style={{marginTop:12}}><label style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:6}}>Voice quality note</label><Inp value={s.voice?.qualityNote||""} onChange={v=>updV({qualityNote:v})} placeholder="Optional…" /></div>
        </div>
        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:12}}>⚔️ Combat</div>
          <ToggleRow label="Joined rallies" value={s.combat?.joinedRallies} onChange={v=>updC({joinedRallies:v})} />
          <ToggleRow label="Led rallies" value={s.combat?.ledRallies} onChange={v=>updC({ledRallies:v})} colorOn={C.gold} colorOff={C.muted} />
          <ToggleRow label="Defended structures" value={s.combat?.defendedStructures} onChange={v=>updC({defendedStructures:v})} />
          <ToggleRow label="Followed orders" value={s.combat?.followedOrders} onChange={v=>updC({followedOrders:v})} tristate={true} />
          <ToggleRow label="Went rogue ⚠️" value={s.combat?.wentRogue} onChange={v=>updC({wentRogue:v})} colorOn={C.red} colorOff={C.muted} />
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:8}}>Officer Notes</label>
          <textarea value={s.notes||""} onChange={e=>setS(prev=>({...prev,notes:e.target.value}))} placeholder="Performance notes, issues, highlights…" style={{width:"100%",minHeight:80,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:16,color:C.white,resize:"none",boxSizing:"border-box",fontFamily:"inherit"}} />
        </div>
        <button onClick={()=>{onSave(s);onClose();vibe(8);}} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer"}}>Save Record</button>
      </div>
    </div>
  );
}

// ── Events Tab ─────────────────────────────────────────────────
function EventsTab({ events, players, onCreateEvent, onUpdateEvent, onDeleteEvent }) {
  const [filterType,setFilterType]=useState("All");
  const [editingEvent,setEditingEvent]=useState(null);
  const [eventSheetOpen,setEventSheetOpen]=useState(false);
  const [activeEventId,setActiveEventId]=useState(null);
  const [snapshotEditing,setSnapshotEditing]=useState(null);
  const [snapshotOpen,setSnapshotOpen]=useState(false);
  const [bulkMode,setBulkMode]=useState(false);
  const [bulkSelected,setBulkSelected]=useState(new Set());

  const activeEvent=events.find(e=>e.id===activeEventId);
  const filtered=filterType==="All"?events:events.filter(e=>e.type===filterType);
  const sorted=[...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date));

  function getSnapshot(event,playerId){return(event.snapshots||[]).find(s=>s.playerId===playerId);}
  function ensureSnapshot(event,player){const ex=getSnapshot(event,player.id);if(ex)return ex;return newSnapshot(player.id,player,event.id);}

  function openSnapshotEditor(event,player){
    const snap=ensureSnapshot(event,player);
    setSnapshotEditing({snapshot:snap,playerName:player.username||player.alias||"Unknown",eventId:event.id,playerId:player.id});
    setSnapshotOpen(true);
  }

  function saveSnapshot(updatedSnapshot){
    const {eventId,playerId}=snapshotEditing;
    const event=events.find(e=>e.id===eventId);if(!event)return;
    const snapshots=[...(event.snapshots||[])];
    const idx=snapshots.findIndex(s=>s.playerId===playerId);
    if(idx>=0)snapshots[idx]=updatedSnapshot;else snapshots.push(updatedSnapshot);
    onUpdateEvent({...event,snapshots});
  }

  function applyBulkAttendance(tag){
    if(!activeEvent||!bulkSelected.size)return;
    const snapshots=[...(activeEvent.snapshots||[])];
    bulkSelected.forEach(pid=>{
      const player=players.find(p=>p.id===pid);if(!player)return;
      const idx=snapshots.findIndex(s=>s.playerId===pid);
      let snap=idx>=0?{...snapshots[idx]}:newSnapshot(pid,player,activeEvent.id);
      if(tag==="attended") snap={...snap,attendance:{...snap.attendance,attended:true,noShow:false}};
      if(tag==="noshow")   snap={...snap,attendance:{...snap.attendance,attended:false,noShow:true}};
      if(tag==="late")     snap={...snap,attendance:{...snap.attendance,late:true}};
      if(tag==="voice")    snap={...snap,voice:{...snap.voice,joined:true}};
      if(idx>=0)snapshots[idx]=snap;else snapshots.push(snap);
    });
    onUpdateEvent({...activeEvent,snapshots});
    setBulkSelected(new Set());setBulkMode(false);vibe(8);
  }

  function eventSummary(event){
    const snaps=event.snapshots||[];
    return{total:snaps.length,attended:snaps.filter(s=>s.attendance.attended===true).length,noShow:snaps.filter(s=>s.attendance.noShow).length,voice:snaps.filter(s=>s.voice.joined===true).length};
  }

  return (
    <div style={{padding:"16px 20px 0"}}>
      {activeEvent?(
        <div>
          <button onClick={()=>{setActiveEventId(null);setBulkMode(false);setBulkSelected(new Set());}} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",color:C.gold,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:16,padding:0}}>← Back to Events</button>
          <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontSize:20,fontWeight:700,color:C.white}}>{EVENT_ICONS[activeEvent.type]||"📋"} {activeEvent.name||activeEvent.type}</div>
                <div style={{fontSize:13,color:C.muted}}>{fmtDateShort(activeEvent.date)} · {activeEvent.type}</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setEditingEvent(activeEvent);setEventSheetOpen(true);}} style={{height:34,padding:"0 12px",borderRadius:20,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontSize:13,cursor:"pointer"}}>Edit</button>
                <button onClick={()=>{const next=activeEvent.status==="active"?"completed":activeEvent.status==="completed"?"upcoming":"active";onUpdateEvent({...activeEvent,status:next});}} style={{height:34,padding:"0 12px",borderRadius:20,background:activeEvent.status==="active"?C.green+"22":C.section,border:`1px solid ${activeEvent.status==="active"?C.green:C.border}`,color:activeEvent.status==="active"?C.green:C.muted,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  {activeEvent.status==="active"?"🔴 Live":activeEvent.status==="completed"?"✓ Done":"Upcoming"}
                </button>
              </div>
            </div>
            {(()=>{const s=eventSummary(activeEvent);return s.total>0?(<div style={{display:"flex",gap:12}}><span style={{fontSize:13,color:C.green}}>✓ {s.attended}</span><span style={{fontSize:13,color:C.red}}>✗ {s.noShow}</span><span style={{fontSize:13,color:C.icy}}>🎙️ {s.voice}</span></div>):<div style={{fontSize:13,color:C.muted}}>No records yet</div>;})()}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto"}}>
            <button onClick={()=>{setBulkMode(!bulkMode);setBulkSelected(new Set());}} style={{height:36,padding:"0 14px",borderRadius:20,background:bulkMode?C.gold+"22":C.section,border:`1px solid ${bulkMode?C.gold:C.border}`,color:bulkMode?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}>{bulkMode?`✓ ${bulkSelected.size} selected`:"⚡ Bulk Edit"}</button>
            {bulkMode&&bulkSelected.size>0&&[["✓ Attended","attended",C.green],["✗ No-show","noshow",C.red],["🕐 Late","late",C.gold],["🎙️ Voice","voice",C.icy]].map(([label,tag,color])=>(
              <button key={tag} onClick={()=>applyBulkAttendance(tag)} style={{height:36,padding:"0 12px",borderRadius:20,background:color+"18",border:`1px solid ${color}44`,color,fontWeight:600,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}>{label}</button>
            ))}
          </div>
          {players.length===0?<div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>Add players in the Roster tab first</div>:players.map(player=>{
            const snap=getSnapshot(activeEvent,player.id);
            const displayName=player.username||player.alias||"Unknown";
            const isBulkSelected=bulkSelected.has(player.id);
            function handleRowClick(){if(bulkMode){const next=new Set(bulkSelected);isBulkSelected?next.delete(player.id):next.add(player.id);setBulkSelected(next);}else openSnapshotEditor(activeEvent,player);}
            const tagInfo=PERF_TAGS.find(t=>t.key===snap?.performanceTag);
            return (
              <div key={player.id} onClick={handleRowClick} style={{background:isBulkSelected?C.gold+"18":C.card,borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10,cursor:"pointer",border:`1px solid ${isBulkSelected?C.gold:C.border+"44"}`,WebkitTapHighlightColor:"transparent"}}>
                {bulkMode&&<div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${isBulkSelected?C.gold:C.border}`,background:isBulkSelected?C.gold:"none",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{isBulkSelected&&<span style={{fontSize:12,color:C.bg,fontWeight:700}}>✓</span>}</div>}
                <div style={{width:36,height:36,borderRadius:"50%",background:(ROLE_COLORS[player.roles?.[0]]||C.muted)+"33",border:`1.5px solid ${ROLE_COLORS[player.roles?.[0]]||C.muted}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:C.white,flexShrink:0}}>{initials(displayName)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayName}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:3}}>
                    {snap?.attendance?.attended===true&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:C.green+"18",color:C.green,fontWeight:600}}>✓</span>}
                    {snap?.attendance?.noShow&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:C.red+"18",color:C.red,fontWeight:600}}>✗</span>}
                    {snap?.attendance?.attended===null&&!snap?.attendance?.noShow&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:C.muted+"22",color:C.muted,fontWeight:600}}>—</span>}
                    {snap?.attendance?.late&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:C.gold+"18",color:C.gold,fontWeight:600}}>🕐</span>}
                    {snap?.voice?.joined===true&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:C.icy+"18",color:C.icy,fontWeight:600}}>🎙️</span>}
                    {snap?.combat?.wentRogue&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:C.red+"18",color:C.red,fontWeight:600}}>⚠️</span>}
                    {tagInfo&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:tagInfo.color+"18",color:tagInfo.color,fontWeight:600}}>{tagInfo.label}</span>}
                  </div>
                </div>
                {!bulkMode&&<span style={{fontSize:18,color:C.muted}}>›</span>}
              </div>
            );
          })}
        </div>
      ):(
        <>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,marginBottom:16}}>
            {["All",...EVENT_TYPES].map(t=><button key={t} onClick={()=>setFilterType(t)} style={{padding:"7px 14px",borderRadius:20,whiteSpace:"nowrap",background:filterType===t?C.gold+"22":C.section,border:`1px solid ${filterType===t?C.gold:C.border}`,color:filterType===t?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",minHeight:36}}>{EVENT_ICONS[t]||""} {t}</button>)}
          </div>
          <button onClick={()=>{setEditingEvent(null);setEventSheetOpen(true);}} style={{width:"100%",height:48,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer",marginBottom:16}}>＋ New Event</button>
          {sorted.length===0?<div style={{textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:8}}>No events yet</div><div style={{fontSize:14,color:C.muted}}>Create your first event to start tracking</div></div>:sorted.map(event=>{
            const s=eventSummary(event);
            const statusColor=event.status==="active"?C.green:event.status==="completed"?C.muted:C.icy;
            return (
              <div key={event.id} onClick={()=>setActiveEventId(event.id)} style={{background:C.card,borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer",border:`1px solid ${event.status==="active"?C.green+"44":C.border+"44"}`,WebkitTapHighlightColor:"transparent"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:16,fontWeight:700,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{EVENT_ICONS[event.type]||"📋"} {event.name||event.type}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{fmtDateShort(event.date)}</div></div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                    <span style={{fontSize:11,fontWeight:700,color:statusColor,padding:"2px 8px",borderRadius:10,background:statusColor+"18",border:`1px solid ${statusColor}33`}}>{event.status==="active"?"🔴 Live":event.status==="completed"?"✓ Done":"Upcoming"}</span>
                    <button onClick={e=>{e.stopPropagation();if(window.confirm("Delete this event?"))onDeleteEvent(event.id);}} style={{fontSize:11,color:C.red+"88",background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}>Delete</button>
                  </div>
                </div>
                {s.total>0&&<div style={{display:"flex",gap:10}}><span style={{fontSize:12,color:C.green}}>✓ {s.attended}</span><span style={{fontSize:12,color:C.red}}>✗ {s.noShow}</span><span style={{fontSize:12,color:C.icy}}>🎙️ {s.voice}</span><span style={{fontSize:12,color:C.muted}}>{s.total} recorded</span></div>}
              </div>
            );
          })}
        </>
      )}
      <EventSheet event={editingEvent} open={eventSheetOpen} onClose={()=>setEventSheetOpen(false)} onSave={ev=>{if(editingEvent)onUpdateEvent(ev);else onCreateEvent(ev);}} />
      <SnapshotEditor snapshot={snapshotEditing?.snapshot} playerName={snapshotEditing?.playerName} open={snapshotOpen} onClose={()=>setSnapshotOpen(false)} onSave={saveSnapshot} />
    </div>
  );
}

// ── Data Panel ─────────────────────────────────────────────────
function DataPanel({ data, onImport, onClose }) {
  const fileRef=useRef();
  const [mode,setMode]=useState("replace");
  const [msg,setMsg]=useState(null);
  async function handleFileImport(e){
    const file=e.target.files?.[0];if(!file)return;
    try{const imported=await importData(file);onImport(imported,mode);setMsg({text:"✓ Data imported successfully",type:"success"});setTimeout(()=>setMsg(null),3000);}
    catch(err){setMsg({text:`Import failed: ${err.message}`,type:"error"});setTimeout(()=>setMsg(null),4000);}
    e.target.value="";
  }
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:300,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",padding:"16px 20px 60px",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 20px"}} />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontSize:18,fontWeight:700,color:C.white}}>📦 Export / Import</div><button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button></div>
        {msg&&<div style={{padding:"10px 14px",borderRadius:10,marginBottom:16,background:msg.type==="error"?C.red+"18":C.green+"18",color:msg.type==="error"?C.red:C.green,fontSize:14,fontWeight:600}}>{msg.text}</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}}>
          {[["Players",(data.players||[]).length],["Events",(data.events||[]).length],["Saved",data.lastUpdated?fmtDate(data.lastUpdated):"Never"]].map(([label,val])=>(
            <div key={label} style={{background:C.section,borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:typeof val==="number"?22:13,fontWeight:700,color:C.gold}}>{val}</div><div style={{fontSize:12,color:C.muted}}>{label}</div></div>
          ))}
        </div>
        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:6}}>Export</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:12,lineHeight:1.5}}>Downloads all data including event history and prep scores as JSON.</div>
          <button onClick={()=>exportData(data,data.settings?.allianceTag)} style={{width:"100%",height:48,borderRadius:10,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>⬇️ Download JSON</button>
        </div>
        <div style={{background:C.section,borderRadius:12,padding:16}}>
          <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:6}}>Import</div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>{[["replace","Replace all"],["merge","Merge"]].map(([val,label])=><button key={val} onClick={()=>setMode(val)} style={{flex:1,height:40,borderRadius:10,border:`1px solid ${mode===val?C.gold:C.border}`,background:mode===val?C.gold+"22":C.card,color:mode===val?C.gold:C.muted,fontWeight:600,fontSize:14,cursor:"pointer"}}>{label}</button>)}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>{mode==="replace"?"⚠️ Replaces all current data.":"Merges players and events by ID."}</div>
          <input type="file" accept=".json" ref={fileRef} onChange={handleFileImport} style={{display:"none"}} />
          <button onClick={()=>fileRef.current?.click()} style={{width:"100%",height:48,borderRadius:10,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:700,fontSize:15,cursor:"pointer"}}>⬆️ Choose JSON File</button>
        </div>
      </div>
    </div>
  );
}

// ── Settings Panel ─────────────────────────────────────────────
function SettingsPanel({ settings, onSave, onClose }) {
  const [s,setS]=useState(settings||{});
  function upd(k,v){setS(prev=>({...prev,[k]:v}));}
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:300,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",padding:"16px 20px 60px",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 20px"}} />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontSize:18,fontWeight:700,color:C.white}}>⚙️ Alliance Settings</div><button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button></div>
        <Field label="Alliance Name"><Inp value={s.allianceName} onChange={v=>upd("allianceName",v)} placeholder="Your alliance name" /></Field>
        <Field label="Alliance Tag"><Inp value={s.allianceTag} onChange={v=>upd("allianceTag",v)} placeholder="R3K" /></Field>
        <Field label="State ID"><Inp value={s.stateId} onChange={v=>upd("stateId",v)} placeholder="3543" inputMode="numeric" /></Field>
        <button onClick={()=>{onSave(s);onClose();vibe(8);}} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer"}}>Save Settings</button>
      </div>
    </div>
  );
}

// ── Stats Tab ──────────────────────────────────────────────────
function StatsTab({ players, events }) {
  const withMetrics=players.map(p=>({player:p,metrics:calcMetrics(p,events)})).filter(x=>x.metrics).sort((a,b)=>b.metrics.reliabilityScore-a.metrics.reliabilityScore);
  const atRisk=players.map(p=>({player:p,metrics:calcMetrics(p,events)})).filter(x=>x.metrics&&x.metrics.consecutiveMisses>=3).sort((a,b)=>b.metrics.consecutiveMisses-a.metrics.consecutiveMisses);
  return (
    <div style={{padding:"16px 20px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        {[["👥","Total Players",players.length],["📋","Total Events",events.length],["👑","Rally Leads",players.filter(p=>p.roles?.includes("Rally Lead")).length],["✅","Available",players.filter(p=>p.availability?.present==="available").length],["⚔️","Skill 5 Heroes",players.filter(p=>p.heroes?.length>0).length],["🌏","Countries",new Set(players.map(p=>p.country).filter(Boolean)).size]].map(([icon,label,val])=>(
          <div key={label} style={{background:C.card,borderRadius:12,padding:16}}><div style={{fontSize:22}}>{icon}</div><div style={{fontSize:28,fontWeight:700,color:C.gold}}>{val}</div><div style={{fontSize:13,color:C.icy}}>{label}</div></div>
        ))}
      </div>
      {withMetrics.length>0&&(
        <div style={{background:C.card,borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:12}}>🏅 Reliability Leaderboard</div>
          {withMetrics.slice(0,8).map(({player,metrics},i)=>(
            <div key={player.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}22`}}>
              <div style={{fontSize:13,fontWeight:700,color:i<3?C.gold:C.muted,width:20,textAlign:"center"}}>{i+1}</div>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:C.white}}>{player.username||player.alias||"Unknown"}</div><div style={{fontSize:11,color:C.muted}}>{metrics.attended}/{metrics.totalEvents} events · {metrics.attendancePct}%</div></div>
              <div style={{fontSize:16,fontWeight:700,color:metrics.reliabilityScore>=70?C.green:metrics.reliabilityScore>=40?C.gold:C.red}}>{metrics.reliabilityScore}</div>
            </div>
          ))}
        </div>
      )}
      {atRisk.length>0&&(
        <div style={{background:C.card,borderRadius:12,padding:16,marginBottom:16,border:`1px solid ${C.red}33`}}>
          <div style={{fontSize:15,fontWeight:700,color:C.red,marginBottom:12}}>⚠️ Absent 3+ Events in a Row</div>
          {atRisk.map(({player,metrics})=>(
            <div key={player.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}22`}}>
              <div style={{fontSize:14,color:C.white}}>{player.username||player.alias||"Unknown"}</div>
              <div style={{fontSize:13,fontWeight:700,color:C.red}}>{metrics.consecutiveMisses} missed</div>
            </div>
          ))}
        </div>
      )}
      {(()=>{const counts={};players.forEach(p=>{if(p.country)counts[p.country]=(counts[p.country]||0)+1;});const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);if(!sorted.length)return null;
        return <div style={{background:C.card,borderRadius:12,padding:16,marginBottom:16}}><div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:12}}>🌏 Countries</div>{sorted.map(([country,count])=><div key={country} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:14,color:C.icy}}>{country}</div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:80,height:6,borderRadius:3,background:C.border,overflow:"hidden"}}><div style={{width:`${(count/players.length)*100}%`,height:"100%",background:C.gold,borderRadius:3}} /></div><div style={{fontSize:14,fontWeight:700,color:C.gold,width:20,textAlign:"right"}}>{count}</div></div></div>)}</div>;
      })()}
      {(()=>{const counts={};players.forEach(p=>p.heroes?.forEach(h=>{counts[h]=(counts[h]||0)+1;}));const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);if(!top.length)return null;
        return <div style={{background:C.card,borderRadius:12,padding:16}}><div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:12}}>🏅 Top Heroes (Skill 5)</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{top.map(([hero,count])=><div key={hero} style={{padding:"8px 12px",borderRadius:20,background:C.gold+"18",border:`1px solid ${C.gold}33`}}><span style={{color:C.gold,fontWeight:600,fontSize:13}}>✓ {hero}</span><span style={{color:C.muted,fontSize:12,marginLeft:6}}>×{count}</span></div>)}</div></div>;
      })()}
      {players.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>Add players to see stats</div>}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(()=>loadData());
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");

  // Profile view state — click opens view, edit opens edit
  const [viewingPlayer, setViewingPlayer] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [batchOpen, setBatchOpen] = useState(false);
  const [dataPanel, setDataPanel] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(()=>{ saveData(data); },[data]);

  function showToast(msg,type="success") { setToast({msg,type}); setTimeout(()=>setToast(null),2800); }

  function savePlayer(player) {
    const isEdit=data.players.some(p=>p.id===player.id);
    setData(prev=>({...prev,players:isEdit?prev.players.map(p=>p.id===player.id?player:p):[...prev.players,player],lastUpdated:new Date().toISOString()}));
    showToast(isEdit?"Player updated ✓":"Player added ✓");
  }

  // Batch creates new players
  function addPlayers(newPlayers) {
    setData(prev=>({...prev,players:[...prev.players,...newPlayers],lastUpdated:new Date().toISOString()}));
    if (newPlayers.length) showToast(`${newPlayers.length} player${newPlayers.length!==1?"s":""} added ✓`);
  }

  // Batch updates existing players
  function updatePlayers(updatedPlayers) {
    setData(prev=>({
      ...prev,
      players: prev.players.map(p=>{
        const u=updatedPlayers.find(u=>u.id===p.id);
        return u?u:p;
      }),
      lastUpdated:new Date().toISOString(),
    }));
    if (updatedPlayers.length) showToast(`${updatedPlayers.length} player${updatedPlayers.length!==1?"s":""} updated ✓`);
  }

  function deletePlayer(id) {
    setData(prev=>({...prev,players:prev.players.filter(p=>p.id!==id),lastUpdated:new Date().toISOString()}));
    showToast("Player removed"); setDeleteConfirm(null);
  }
  function handleImport(imported,mode) {
    setData(prev=>{ if(mode==="merge")return{...mergeData(prev,imported),lastUpdated:new Date().toISOString()}; return{...prev,...imported,lastUpdated:new Date().toISOString()}; });
    showToast(`Imported (${mode}) ✓`); setDataPanel(false);
  }
  function createEvent(ev) { setData(prev=>({...prev,events:[...(prev.events||[]),ev],lastUpdated:new Date().toISOString()})); showToast("Event created ✓"); }
  function updateEvent(ev) { setData(prev=>({...prev,events:(prev.events||[]).map(e=>e.id===ev.id?ev:e),lastUpdated:new Date().toISOString()})); }
  function deleteEvent(id) { setData(prev=>({...prev,events:(prev.events||[]).filter(e=>e.id!==id),lastUpdated:new Date().toISOString()})); showToast("Event deleted"); }
  function updatePrepScores(scores) { setData(prev=>({...prev,prepScores:scores,lastUpdated:new Date().toISOString()})); }

  // Open profile view (read-only)
  function openProfile(player) { setViewingPlayer(player); setProfileOpen(true); }
  // Open edit from profile view
  function openEditFromProfile() { setEditingPlayer(viewingPlayer); setProfileOpen(false); setSheetOpen(true); }
  // Open add
  function openAdd() { setEditingPlayer(null); setSheetOpen(true); }
  function handleSheetClose() { setSheetOpen(false); setEditingPlayer(null); }

  const players = data.players||[];
  const events  = data.events||[];
  const prepScores = data.prepScores||[];

  const filteredPlayers = players.filter(p=>{
    const target=(p.username||p.alias||"").toLowerCase();
    const matchSearch=!search||target.includes(search.toLowerCase())||(p.allianceTag||"").toLowerCase().includes(search.toLowerCase())||(p.country||"").toLowerCase().includes(search.toLowerCase());
    const matchRole=filterRole==="All"||p.roles?.includes(filterRole);
    return matchSearch&&matchRole;
  });

  // 5 tabs: Roster, Teams, Events, Prep, Stats
  const TABS = [
    {icon:"👥",label:"Roster"},
    {icon:"⚔️",label:"Teams"},
    {icon:"📋",label:"Events"},
    {icon:"📈",label:"Prep"},
    {icon:"📊",label:"Stats"},
  ];

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.white,fontFamily:"system-ui,-apple-system,sans-serif",paddingBottom:80,maxWidth:480,margin:"0 auto"}}>

      {/* Header */}
      <div style={{padding:"20px 20px 14px",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.bg,zIndex:50}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:20,fontWeight:700,color:C.white}}>🏰 {data.settings?.allianceName||"Rally Planner"}</div>
            <div style={{fontSize:13,color:C.muted}}>{data.settings?.allianceTag?`[${data.settings.allianceTag}] · `:""}State {data.settings?.stateId||"3543"} · {players.length} players</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setDataPanel(true)} style={{height:36,padding:"0 12px",borderRadius:20,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontSize:13,fontWeight:600,cursor:"pointer"}}>📦</button>
            <button onClick={()=>setSettingsPanel(true)} style={{height:36,padding:"0 12px",borderRadius:20,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontSize:13,fontWeight:600,cursor:"pointer"}}>⚙️</button>
          </div>
        </div>
      </div>

      {/* ROSTER */}
      {tab===0&&(
        <div style={{padding:"16px 20px 0"}}>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, tag, country…" style={{flex:1,height:48,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"0 14px",fontSize:16,color:C.white,fontFamily:"inherit"}} />
            <button onClick={()=>setBatchOpen(true)} style={{height:48,padding:"0 12px",borderRadius:10,background:"none",border:`1px solid ${C.gold}`,color:C.gold,fontWeight:700,fontSize:14,cursor:"pointer"}}>⚡ Batch</button>
            <button onClick={openAdd} style={{height:48,padding:"0 14px",borderRadius:10,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>＋</button>
          </div>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,marginBottom:4}}>
            {["All",...ROLES].map(r=><button key={r} onClick={()=>setFilterRole(r)} style={{padding:"7px 14px",borderRadius:20,whiteSpace:"nowrap",background:filterRole===r?C.gold+"22":C.section,border:`1px solid ${filterRole===r?C.gold:C.border}`,color:filterRole===r?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",minHeight:36}}>{r}</button>)}
          </div>
          {players.length>0&&<div style={{fontSize:13,color:C.muted,marginBottom:12}}>{filteredPlayers.length} of {players.length} player{players.length!==1?"s":""}</div>}
          {players.length===0&&(
            <div style={{textAlign:"center",padding:"60px 20px"}}>
              <div style={{fontSize:52,marginBottom:16}}>👥</div>
              <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:8}}>No players yet</div>
              <div style={{fontSize:15,color:C.muted,marginBottom:28}}>Batch add your alliance or add one by one</div>
              <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                <button onClick={()=>setBatchOpen(true)} style={{height:52,padding:"0 24px",borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>⚡ Batch Add</button>
                <button onClick={openAdd} style={{height:52,padding:"0 24px",borderRadius:12,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:700,fontSize:15,cursor:"pointer"}}>＋ Add One</button>
                <button onClick={()=>setDataPanel(true)} style={{height:52,padding:"0 24px",borderRadius:12,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:700,fontSize:15,cursor:"pointer"}}>⬆️ Import</button>
              </div>
            </div>
          )}
          {players.length>0&&filteredPlayers.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>No results for "{search||filterRole}"</div>}
          {filteredPlayers.map(p=><PlayerCard key={p.id} player={p} onClick={()=>openProfile(p)} onDelete={id=>setDeleteConfirm(id)} events={events} />)}
        </div>
      )}

      {/* TEAMS */}
      {tab===1&&(
        <div style={{padding:"16px 20px"}}>
          {(()=>{
            const avail=players.filter(p=>p.availability?.present==="available");
            const byRole=ROLES.map(role=>({role,members:avail.filter(p=>p.roles?.includes(role))})).filter(g=>g.members.length>0);
            return (
              <>
                <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}><div style={{fontSize:13,color:C.icy,marginBottom:4}}>Available for SvS</div><div style={{fontSize:28,fontWeight:700,color:C.white}}>{avail.length} <span style={{fontSize:16,color:C.muted}}>of {players.length}</span></div></div>
                {byRole.map(({role,members})=>(
                  <div key={role} style={{marginBottom:16}}>
                    <div style={{fontSize:13,fontWeight:700,color:ROLE_COLORS[role],textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{ROLE_ICONS[role]} {role} · {members.length}</div>
                    {members.map(m=>(
                      <div key={m.id} onClick={()=>openProfile(m)} style={{background:C.card,borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                        <div><div style={{fontWeight:700,color:C.white,fontSize:15}}>{m.username||m.alias||"Unknown"}</div><div style={{fontSize:12,color:C.icy}}>{[m.furnaceLevel&&`FC${m.furnaceLevel}`,m.allianceTag&&`[${m.allianceTag}]`,m.timezone].filter(Boolean).join(" · ")}{m.availability?.timing==="late"?" · 🕐":""}{m.availability?.discord==="yes"?" · 🎙️":""}</div></div>
                        <div style={{display:"flex",gap:4}}>{[m.troops?.infantry,m.troops?.lancer,m.troops?.marksman].map((t,i)=><span key={i} style={{fontSize:11,padding:"2px 6px",borderRadius:6,background:[C.inf,C.lan,C.mar][i]+"22",color:[C.inf,C.lan,C.mar][i]}}>{t||"?"}</span>)}</div>
                      </div>
                    ))}
                  </div>
                ))}
                {players.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>Add players in the Roster tab first</div>}
              </>
            );
          })()}
        </div>
      )}

      {/* EVENTS */}
      {tab===2&&<EventsTab events={events} players={players} onCreateEvent={createEvent} onUpdateEvent={updateEvent} onDeleteEvent={deleteEvent} />}

      {/* PREP SCORES */}
      {tab===3&&<PrepScoreTab prepScores={prepScores} players={players} onUpdate={updatePrepScores} />}

      {/* STATS */}
      {tab===4&&<StatsTab players={players} events={events} />}

      {/* Delete confirm */}
      {deleteConfirm&&(
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

      {/* Profile view (read-only) — opens first on card tap */}
      <ProfileView
        player={viewingPlayer}
        open={profileOpen}
        onClose={()=>setProfileOpen(false)}
        onEdit={openEditFromProfile}
        events={events}
      />

      {/* Edit sheet — only opens via Edit button in ProfileView or Add button */}
      <PlayerSheet
        open={sheetOpen}
        player={editingPlayer}
        onClose={handleSheetClose}
        onSave={savePlayer}
        events={events}
      />

      <BatchAddSheet
        open={batchOpen}
        onClose={()=>setBatchOpen(false)}
        members={players}
        onAddNew={addPlayers}
        onUpdateExisting={updatePlayers}
      />

      {dataPanel&&<DataPanel data={data} onImport={handleImport} onClose={()=>setDataPanel(false)} />}
      {settingsPanel&&<SettingsPanel settings={data.settings} onSave={s=>setData(prev=>({...prev,settings:s,lastUpdated:new Date().toISOString()}))} onClose={()=>setSettingsPanel(false)} />}

      {toast&&<Toast msg={toast.msg} type={toast.type} />}

      {/* Tab bar — 5 tabs */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,display:"grid",gridTemplateColumns:"repeat(5,1fr)",background:C.bg,borderTop:`1px solid ${C.border}`,height:60,zIndex:100}}>
        {TABS.map((t,i)=>(
          <button key={i} onClick={()=>{setTab(i);vibe(8);}} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",color:tab===i?C.gold:C.muted,gap:3,fontSize:9,fontWeight:600,transition:"color 150ms ease",WebkitTapHighlightColor:"transparent"}}>
            <span style={{fontSize:19}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
