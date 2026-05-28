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
