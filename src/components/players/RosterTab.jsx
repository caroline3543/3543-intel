import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { PlayerCard }       from './PlayerCard.jsx';
import { ProfileView }      from './ProfileView.jsx';
import { PlayerSheet }      from './PlayerSheet.jsx';
import { RoleManagerSheet } from './RoleManagerSheet.jsx';
import { RallyLeaderProfileSheet } from './RallyLeaderProfileSheet.jsx';
import BulkNameAdd          from './BulkNameAdd.jsx';
import FieldRegistry        from './FieldRegistry.jsx';
import { FIELD_DEFS, getFieldValues, assignFieldValue } from '../../services/fieldRegistryService.js';

// Auto-derived "role-like" filters computed straight from existing
// troop-tier data — no manual role to create or assign. Only shown as
// filter chips when at least one player actually qualifies, so an
// alliance with nobody at Helios tier yet doesn't see empty chips.
const DERIVED_TIER_FILTERS = [
  { id:'helios-marksman', label:'🏹 Helios Marksman', match:p => p.troops?.marksman === 'T11/Helios' },
  { id:'helios-lancer',   label:'⚔️ Helios Lancer',   match:p => p.troops?.lancer   === 'T11/Helios' },
  { id:'helios-infantry', label:'🛡️ Helios Infantry', match:p => p.troops?.infantry === 'T11/Helios' },
];

const SORT_OPTIONS = [
  { id:'name',       label:'Name (A–Z)' },
  { id:'troopPower', label:'💪 Troop power (high → low)' },
  { id:'missing',    label:'⚠ Missing info first' },
];

// Troop power isn't a standing field on the player profile — it's
// derived from the most recent event snapshot that recorded one (see
// EventsTab.jsx / TROOP_POWER_EVENTS), so there's one source of truth
// instead of a second, separately-maintained number that can drift.
function getCurrentTroopPower(player, events) {
  let best = null;
  (events || []).forEach(ev => {
    const snap = (ev.snapshots || []).find(s => s.playerId === player.id);
    if (snap?.troopPower != null && (!best || new Date(ev.date) > new Date(best.date))) {
      best = { value: snap.troopPower, date: ev.date };
    }
  });
  return best?.value ?? null;
}

export function RosterTab({ players, events, roles, onSaveCustomRoles, onSavePlayer, onAddPlayers, onUpdatePlayers, onDeletePlayer, onGoToIntel, showToast }) {
  const [rosterView, setRosterView]       = useState('list');
  const [search, setSearch]               = useState('');
  const [filterRole, setFilterRole]       = useState('All');
  const [sortBy, setSortBy]               = useState('name');
  const [sortMenuOpen, setSortMenuOpen]   = useState(false);
  const [viewingPlayer, setViewingPlayer] = useState(null);
  const [profileOpen, setProfileOpen]     = useState(false);
  const [leaderProfileOpen, setLeaderProfileOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [sheetOpen, setSheetOpen]         = useState(false);
  const [bulkAddOpen, setBulkAddOpen]     = useState(false);
  const [fieldRegistryOpen, setFieldRegistryOpen] = useState(false);
  const [roleManagerOpen, setRoleManagerOpen] = useState(false);
  const [troopsCopied, setTroopsCopied] = useState(false);
  const [bulkMode, setBulkMode]         = useState(false);
  const [bulkSel, setBulkSel]           = useState(new Set());
  const [activeField, setActiveField]   = useState(null); // which field's value picker is open
  const [stagedFields, setStagedFields] = useState({});   // { [fieldId]: value } — built up before one combined Apply

  // How many of the "should be set" fields are actually missing —
  // higher = more incomplete. NOTE: having zero roles is no longer
  // counted here — Rally Lead is the only role that changes anything
  // functionally (Battle Plan eligibility never checks for a "Joiner"
  // tag), so an untagged member is a normal joiner, not an incomplete
  // profile.
  function missingCount(p) {
    let n = 0;
    if (!p.furnaceLevel) n++;
    if (!p.troops?.infantry) n++;
    if (!p.troops?.lancer) n++;
    if (!p.troops?.marksman) n++;
    if (!p.languages?.length) n++;
    if (!(p.joinerHeroes||[]).some(jh=>jh.skillLevel>=5)) n++;
    return n;
  }

  // One-tap Rally Lead toggle — pass to PlayerCard once it can render
  // a tap target for it; the flip logic lives here either way.
  function toggleRallyLead(player) {
    const has = player.roles?.includes('Rally Lead');
    const nextRoles = has ? (player.roles||[]).filter(r => r !== 'Rally Lead') : [...(player.roles||[]), 'Rally Lead'];
    onSavePlayer({ ...player, roles: nextRoles });
  }

  // Folds every staged field=value pair into one combined update per
  // selected player — e.g. Furnace: FC5 AND Infantry: FC5 AND
  // Marksman: FC5 all land in the same object, then one onUpdatePlayers
  // batch for everyone. Chaining assignFieldValue locally like this
  // (not one onUpdatePlayers call per field) avoids each call needing
  // to read the result of the previous one from parent state that
  // hasn't re-rendered yet.
  function applyBulkFields() {
    const entries = Object.entries(stagedFields);
    if (entries.length === 0) return;
    const selected = players.filter(p => bulkSel.has(p.id));
    const updated = selected.map(p => {
      let result = p;
      entries.forEach(([fieldId, value]) => {
        const field = FIELD_DEFS.find(f => f.id === fieldId);
        if (field) result = assignFieldValue(result, field, value);
      });
      return result;
    });
    onUpdatePlayers(updated);
    showToast?.(`Updated ${updated.length} player${updated.length!==1?'s':''} with ${entries.length} field${entries.length!==1?'s':''} ✓`);
    setBulkSel(new Set()); setBulkMode(false); setActiveField(null); setStagedFields({});
  }

  function toggleBulkSel(id) {
    setBulkSel(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // Discord-ready list of exactly who's missing which troop tier(s) —
  // "missing info" elsewhere is broader (languages, joiner heroes,
  // furnace level too), so this is scoped specifically to troop tiers,
  // since that's the actionable, chase-people-down list an officer
  // would actually post.
  function generateMissingTroopsText() {
    const missing = players.filter(p => !p.troops?.infantry || !p.troops?.lancer || !p.troops?.marksman);
    const lines = ['Missing Troop Levels', ''];
    missing.forEach(p => {
      const dn = p.username || p.alias || '?';
      const gaps = [];
      if (!p.troops?.infantry) gaps.push('Infantry');
      if (!p.troops?.lancer)   gaps.push('Lancer');
      if (!p.troops?.marksman) gaps.push('Marksman');
      lines.push(`${dn} — missing ${gaps.join(', ')}`);
    });
    return lines.join('\n').trim();
  }
  function copyMissingTroops() {
    navigator.clipboard.writeText(generateMissingTroopsText()).then(() => {
      setTroopsCopied(true);
      setTimeout(() => setTroopsCopied(false), 2000);
    });
  }

  const activeDerivedFilters = DERIVED_TIER_FILTERS.filter(d => players.some(d.match));
  const derivedMatch = DERIVED_TIER_FILTERS.find(d => d.id === filterRole);

  const filteredPlayers = players.filter(p => {
    const t = (p.username||p.alias||'').toLowerCase();
    const ms = !search
      || t.includes(search.toLowerCase())
      || (p.allianceTag||'').toLowerCase().includes(search.toLowerCase())
      || (p.country||'').toLowerCase().includes(search.toLowerCase())
      || (p.fid||'').toLowerCase().includes(search.toLowerCase());
    const mr = filterRole==='All' || (derivedMatch ? derivedMatch.match(p) : p.roles?.includes(filterRole));
    return ms && mr;
  });
  if (sortBy === 'missing') {
    filteredPlayers.sort((a,b) => missingCount(b) - missingCount(a));
  } else if (sortBy === 'troopPower') {
    filteredPlayers.sort((a,b) => (getCurrentTroopPower(b,events) ?? -1) - (getCurrentTroopPower(a,events) ?? -1));
  } else {
    filteredPlayers.sort((a,b) => (a.username||a.alias||'').localeCompare(b.username||b.alias||''));
  }

  function openProfile(player) { setViewingPlayer(player); setProfileOpen(true); }
  function openEdit(player)    { setEditingPlayer(player); setSheetOpen(true); }
  function openAdd()           { setEditingPlayer(null); setSheetOpen(true); }

  return (
    <div style={{ padding:'16px 20px 0' }}>

      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, tag, country, player ID…"
          style={{ flex:1, height:48, background:'#152236', border:'1px solid #2A4A64', borderRadius:10, padding:'0 14px', fontSize:16, color:'#FFFFFF', fontFamily:'inherit' }}
        />
        <button onClick={() => setBulkAddOpen(true)} style={{ height:48, padding:'0 12px', borderRadius:10, background:'none', border:`1px solid ${C.gold}`, color:C.gold, fontWeight:700, fontSize:14, cursor:'pointer' }}>➕ Bulk Add</button>
        <button onClick={openAdd} style={{ height:48, padding:'0 14px', borderRadius:10, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>＋</button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <button onClick={() => setRosterView('list')} style={{ flex:1, height:36, borderRadius:20, background:rosterView==='list'?C.gold+'22':C.section, border:`1px solid ${rosterView==='list'?C.gold:C.border}`, color:rosterView==='list'?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>≡ List</button>
        <button onClick={() => setRosterView('roles')} style={{ flex:1, height:36, borderRadius:20, background:rosterView==='roles'?C.gold+'22':C.section, border:`1px solid ${rosterView==='roles'?C.gold:C.border}`, color:rosterView==='roles'?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>⚔️ By Role</button>
      </div>

      {/* Utility row — Fields and Roles are now always-visible, labeled
          buttons instead of hidden behind an unlabeled "⋯" overflow menu.
          Nobody could tell that menu existed, let alone what was in it —
          these are two of the most important entry points in the app
          (they're how data actually gets filled in), so they get equal
          visual weight to Sort, not a mystery icon. */}
      <div style={{ display:'flex', gap:6, marginBottom:12, position:'relative' }}>
        {rosterView==='list' && (
          <button onClick={() => setSortMenuOpen(!sortMenuOpen)}
            style={{ flex:1, minWidth:0, height:36, padding:'0 12px', borderRadius:20, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{SORT_OPTIONS.find(o=>o.id===sortBy)?.label}</span>
            <span style={{ fontSize:10, flexShrink:0 }}>▼</span>
          </button>
        )}
        <button onClick={() => setFieldRegistryOpen(true)}
          style={{ ...(rosterView==='list' ? { flexShrink:0 } : { flex:1 }), height:36, padding:'0 14px', borderRadius:20, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
          📋 Fields
        </button>
        <button onClick={() => setRoleManagerOpen(true)}
          style={{ ...(rosterView==='list' ? { flexShrink:0 } : { flex:1 }), height:36, padding:'0 14px', borderRadius:20, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
          ⚙ Roles
        </button>
        {rosterView==='list' && (
          <button onClick={() => { setBulkMode(v => !v); setBulkSel(new Set()); setActiveField(null); setStagedFields({}); }}
            style={{ flexShrink:0, height:36, padding:'0 14px', borderRadius:20, background:bulkMode?C.gold+'22':C.section, border:`1px solid ${bulkMode?C.gold:C.border}`, color:bulkMode?C.gold:C.icy, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
            ☑️ {bulkMode ? `${bulkSel.size} selected` : 'Select'}
          </button>
        )}

        {sortMenuOpen && (
          <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', zIndex:30, boxShadow:'0 8px 24px #000a' }}>
            {SORT_OPTIONS.map(o => (
              <button key={o.id} onClick={() => { setSortBy(o.id); setSortMenuOpen(false); }}
                style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:sortBy===o.id?C.gold+'18':'none', border:'none', color:sortBy===o.id?C.gold:C.white, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contextual nudge — surfaces the Field Registry exactly when it's
          useful (incomplete profiles exist) rather than relying on the
          officer to remember it's there at all. Only shown when it's
          actually true, so it never nags an alliance with a clean roster. */}
      {(() => {
        if (!players.length) return null;
        const incompleteCount = players.filter(p => missingCount(p) > 0).length;
        if (!incompleteCount) return null;
        const troopGapCount = players.filter(p => !p.troops?.infantry || !p.troops?.lancer || !p.troops?.marksman).length;
        return (
          <div style={{ background:C.gold+'14', border:`1px solid ${C.gold}55`, borderRadius:12, padding:'12px 14px', marginBottom:12 }}>
            <div
              onClick={() => setFieldRegistryOpen(true)}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, cursor:'pointer', WebkitTapHighlightColor:'transparent' }}
            >
              <div style={{ fontSize:13, color:C.white, fontWeight:600 }}>
                ⚠ {incompleteCount} player{incompleteCount!==1?'s':''} missing info
              </div>
              <div style={{ fontSize:12, color:C.gold, fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>
                Open Field Registry ›
              </div>
            </div>
            {sortBy==='missing' && troopGapCount > 0 && (
              <button
                onClick={e => { e.stopPropagation(); copyMissingTroops(); }}
                style={{ marginTop:10, width:'100%', height:32, borderRadius:8, background:'none', border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:600, fontSize:12, cursor:'pointer' }}
              >
                {troopsCopied ? '✓ Copied' : `📋 Copy missing troop levels (${troopGapCount})`}
              </button>
            )}
          </div>
        );
      })()}

      {rosterView==='list' && (
        <>
          <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:10, marginBottom:4 }}>
            {['All', ...roles.map(r=>r.name)].map(r => (
              <button key={r} onClick={() => setFilterRole(r)} style={{ padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap', background:filterRole===r?C.gold+'22':C.section, border:`1px solid ${filterRole===r?C.gold:C.border}`, color:filterRole===r?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', minHeight:36, flexShrink:0 }}>{r}</button>
            ))}
            {activeDerivedFilters.map(d => (
              <button key={d.id} onClick={() => setFilterRole(d.id)} style={{ padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap', background:filterRole===d.id?C.icy+'22':C.section, border:`1px solid ${filterRole===d.id?C.icy:C.border}`, color:filterRole===d.id?C.icy:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', minHeight:36, flexShrink:0 }}>{d.label}</button>
            ))}
          </div>
          {players.length > 0 && (
            <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>
              {filteredPlayers.length} of {players.length} player{players.length!==1?'s':''}
            </div>
          )}
          {bulkMode && bulkSel.size > 0 && (() => {
            const activeFieldDef = FIELD_DEFS.find(f => f.id === activeField);
            const options = activeFieldDef ? getFieldValues(players, activeFieldDef) : [];
            const stagedEntries = Object.entries(stagedFields);
            return (
              <div style={{ background:C.card, border:`1px solid ${C.gold}44`, borderRadius:12, padding:14, marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:10 }}>Assign to {bulkSel.size} selected</div>

                {stagedEntries.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                    {stagedEntries.map(([fid, val]) => {
                      const f = FIELD_DEFS.find(fd => fd.id === fid);
                      return (
                        <span key={fid} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', borderRadius:16, background:C.green+'18', border:`1px solid ${C.green}44`, color:C.green, fontSize:12, fontWeight:600 }}>
                          {f?.icon} {f?.label}: {val}
                          <button onClick={() => setStagedFields(prev => { const n = { ...prev }; delete n[fid]; return n; })}
                            style={{ background:'none', border:'none', color:C.green, cursor:'pointer', fontWeight:700, padding:0, fontSize:13, lineHeight:1 }}>✕</button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:activeField?10:0 }}>
                  {FIELD_DEFS.map(f => {
                    const staged = stagedFields[f.id] !== undefined;
                    const open = activeField === f.id;
                    return (
                      <button key={f.id} onClick={() => setActiveField(open ? null : f.id)}
                        style={{ padding:'7px 12px', borderRadius:16, whiteSpace:'nowrap', background:open?C.gold+'22':(staged?C.green+'14':C.section), border:`1px solid ${open?C.gold:(staged?C.green+'66':C.border)}`, color:open?C.gold:(staged?C.green:C.muted), fontWeight:600, fontSize:12, cursor:'pointer', flexShrink:0 }}>
                        {staged?'✓ ':''}{f.icon} {f.label}
                      </button>
                    );
                  })}
                </div>

                {activeFieldDef && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                    {options.length === 0 && <div style={{ fontSize:12, color:C.muted }}>No existing values yet — add one via 📋 Fields first.</div>}
                    {options.map(opt => (
                      <button key={opt} onClick={() => { setStagedFields(prev => ({ ...prev, [activeField]: opt })); setActiveField(null); }}
                        style={{ padding:'6px 12px', borderRadius:16, background:stagedFields[activeField]===opt?C.gold+'22':C.section, border:`1px solid ${stagedFields[activeField]===opt?C.gold:C.border}`, color:stagedFields[activeField]===opt?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                <button onClick={applyBulkFields} disabled={stagedEntries.length===0}
                  style={{ width:'100%', height:44, borderRadius:10, background:stagedEntries.length?C.gold:C.section, color:stagedEntries.length?C.bg:C.muted, fontWeight:700, fontSize:14, border:stagedEntries.length?'none':`1px solid ${C.border}`, cursor:stagedEntries.length?'pointer':'default' }}>
                  Apply {stagedEntries.length || ''} field{stagedEntries.length!==1?'s':''} to {bulkSel.size} player{bulkSel.size!==1?'s':''}
                </button>
              </div>
            );
          })()}
          {players.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px 20px' }}>
              <div style={{ fontSize:52, marginBottom:16 }}>👥</div>
              <div style={{ fontSize:18, fontWeight:700, color:C.white, marginBottom:8 }}>No players yet</div>
              <div style={{ fontSize:15, color:C.muted, marginBottom:28 }}>Bulk add names, then fill in details via Field Registry — or add one by one</div>
              <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                <button onClick={() => setBulkAddOpen(true)} style={{ height:52, padding:'0 24px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>➕ Bulk Add</button>
                <button onClick={openAdd} style={{ height:52, padding:'0 24px', borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:700, fontSize:15, cursor:'pointer' }}>＋ Add One</button>
              </div>
            </div>
          )}
          {players.length > 0 && filteredPlayers.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:C.muted }}>No results for "{search||filterRole}"</div>
          )}
          {filteredPlayers.map(p => (
            <PlayerCard
              key={p.id}
              player={p}
              roles={roles}
              onClick={() => { if (bulkMode) toggleBulkSel(p.id); else openProfile(p); }}
              onDelete={onDeletePlayer}
              events={events}
              missingCount={sortBy==='missing' ? missingCount(p) : 0}
              troopPower={getCurrentTroopPower(p, events)}
              onToggleRallyLead={() => toggleRallyLead(p)}
              onOpenFields={() => setFieldRegistryOpen(true)}
              bulkMode={bulkMode}
              isSelected={bulkSel.has(p.id)}
            />
          ))}
        </>
      )}

      {rosterView==='roles' && (() => {
        const byRole = roles.map(roleDef => ({ roleDef, members:players.filter(p => p.roles?.includes(roleDef.name)) })).filter(g => g.members.length > 0);
        const joiners = players.filter(p => !(p.roles||[]).length);
        const rallyLeadCount = players.filter(p => p.roles?.includes('Rally Lead')).length;
        return (
          <div>
            <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ fontSize:13, color:C.icy, marginBottom:4 }}>Rally Leads assigned</div>
              <div style={{ fontSize:28, fontWeight:700, color:C.white }}>
                {rallyLeadCount} <span style={{ fontSize:16, color:C.muted }}>of {players.length}</span>
              </div>
              <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>Everyone else is available as a joiner by default — no role needed.</div>
            </div>
            {joiners.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
                  🎯 Joiners · {joiners.length}
                </div>
                {joiners.map(m => (
                  <div key={m.id} onClick={() => openProfile(m)} style={{ background:C.card, borderRadius:10, padding:'10px 14px', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', WebkitTapHighlightColor:'transparent' }}>
                    <div>
                      <div style={{ fontWeight:700, color:C.white, fontSize:15 }}>{m.username||m.alias||'?'}</div>
                      <div style={{ fontSize:12, color:C.icy }}>
                        {[m.furnaceLevel&&`${m.furnaceLevel}`, m.allianceTag&&`[${m.allianceTag}]`].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      {[m.troops?.infantry, m.troops?.lancer, m.troops?.marksman].map((t,i) => (
                        <span key={i} style={{ fontSize:11, padding:'2px 6px', borderRadius:6, background:[C.inf,C.lan,C.mar][i]+'22', color:[C.inf,C.lan,C.mar][i] }}>{t||'?'}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {byRole.map(({ roleDef, members }) => (
              <div key={roleDef.id} style={{ marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:roleDef.color, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
                  {roleDef.icon} {roleDef.name} · {members.length}
                </div>
                {members.map(m => (
                  <div key={m.id} onClick={() => openProfile(m)} style={{ background:C.card, borderRadius:10, padding:'10px 14px', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', WebkitTapHighlightColor:'transparent' }}>
                    <div>
                      <div style={{ fontWeight:700, color:C.white, fontSize:15 }}>{m.username||m.alias||'?'}</div>
                      <div style={{ fontSize:12, color:C.icy }}>
                        {[m.furnaceLevel&&`${m.furnaceLevel}`, m.allianceTag&&`[${m.allianceTag}]`].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      {[m.troops?.infantry, m.troops?.lancer, m.troops?.marksman].map((t,i) => (
                        <span key={i} style={{ fontSize:11, padding:'2px 6px', borderRadius:6, background:[C.inf,C.lan,C.mar][i]+'22', color:[C.inf,C.lan,C.mar][i] }}>{t||'?'}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {players.length === 0 && <div style={{ textAlign:'center', padding:'40px 0', color:C.muted }}>Add players in List view first</div>}
          </div>
        );
      })()}

      <ProfileView
        player={viewingPlayer}
        roles={roles}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onEdit={() => { setProfileOpen(false); openEdit(viewingPlayer); }}
        events={events}
        onOpenLeaderProfile={() => setLeaderProfileOpen(true)}
      />
      <RallyLeaderProfileSheet
        player={viewingPlayer}
        open={leaderProfileOpen}
        onClose={() => setLeaderProfileOpen(false)}
        onSave={updated => { onSavePlayer(updated); setViewingPlayer(updated); }}
      />
      <PlayerSheet
        open={sheetOpen}
        player={editingPlayer}
        roles={roles}
        onClose={() => { setSheetOpen(false); setEditingPlayer(null); }}
        onSave={onSavePlayer}
        existingTags={[...new Set(players.map(p=>p.allianceTag).filter(Boolean))]}
        existingPlayers={players}
        onOpenExisting={openProfile}
        onGoToIntel={onGoToIntel}
      />
      <RoleManagerSheet
        open={roleManagerOpen}
        onClose={() => setRoleManagerOpen(false)}
        roles={roles}
        onSaveCustomRoles={onSaveCustomRoles}
        players={players}
        onUpdatePlayers={onUpdatePlayers}
      />

      {bulkAddOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:600 }}>
          <BulkNameAdd
            onAddPlayers={onAddPlayers}
            onClose={() => setBulkAddOpen(false)}
            showToast={showToast}
            onGoToFieldRegistry={() => { setBulkAddOpen(false); setFieldRegistryOpen(true); }}
            existingPlayers={players}
          />
        </div>
      )}

      {fieldRegistryOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:600, background:C.bg }}>
          <FieldRegistry
            players={players}
            onUpdatePlayer={onSavePlayer}
            onClose={() => setFieldRegistryOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
