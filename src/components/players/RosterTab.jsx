import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { PlayerCard }       from './PlayerCard.jsx';
import { ProfileView }      from './ProfileView.jsx';
import { PlayerSheet }      from './PlayerSheet.jsx';
import { RoleManagerSheet } from './RoleManagerSheet.jsx';
import BulkNameAdd          from './BulkNameAdd.jsx';
import FieldRegistry        from './FieldRegistry.jsx';

export function RosterTab({ players, events, roles, onSaveCustomRoles, onSavePlayer, onAddPlayers, onUpdatePlayers, onDeletePlayer, onGoToIntel, showToast }) {
  const [rosterView, setRosterView]       = useState('list');
  const [search, setSearch]               = useState('');
  const [filterRole, setFilterRole]       = useState('All');
  const [sortMissing, setSortMissing]     = useState(false);
  const [viewingPlayer, setViewingPlayer] = useState(null);
  const [profileOpen, setProfileOpen]     = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [sheetOpen, setSheetOpen]         = useState(false);
  const [bulkAddOpen, setBulkAddOpen]     = useState(false);
  const [fieldRegistryOpen, setFieldRegistryOpen] = useState(false);
  const [roleManagerOpen, setRoleManagerOpen] = useState(false);

  // How many of the "should be set" fields are actually missing —
  // higher = more incomplete. Used by the "missing info first" sort.
  function missingCount(p) {
    let n = 0;
    if (!p.furnaceLevel) n++;
    if (!p.troops?.infantry) n++;
    if (!p.troops?.lancer) n++;
    if (!p.troops?.marksman) n++;
    if (!p.roles?.length) n++;
    if (!p.languages?.length) n++;
    if (!(p.joinerHeroes||[]).some(jh=>jh.skillLevel>=5)) n++;
    return n;
  }

  const filteredPlayers = players.filter(p => {
    const t = (p.username||p.alias||'').toLowerCase();
    const ms = !search
      || t.includes(search.toLowerCase())
      || (p.allianceTag||'').toLowerCase().includes(search.toLowerCase())
      || (p.country||'').toLowerCase().includes(search.toLowerCase());
    const mr = filterRole==='All' || p.roles?.includes(filterRole);
    return ms && mr;
  });
  if (sortMissing) filteredPlayers.sort((a,b) => missingCount(b) - missingCount(a));

  function openProfile(player) { setViewingPlayer(player); setProfileOpen(true); }
  function openEdit(player)    { setEditingPlayer(player); setSheetOpen(true); }
  function openAdd()           { setEditingPlayer(null); setSheetOpen(true); }

  return (
    <div style={{ padding:'16px 20px 0' }}>

      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, tag, country…"
          style={{ flex:1, height:48, background:'#152236', border:'1px solid #2A4A64', borderRadius:10, padding:'0 14px', fontSize:16, color:'#FFFFFF', fontFamily:'inherit' }}
        />
        <button onClick={() => setBulkAddOpen(true)} style={{ height:48, padding:'0 12px', borderRadius:10, background:'none', border:`1px solid ${C.gold}`, color:C.gold, fontWeight:700, fontSize:14, cursor:'pointer' }}>➕ Bulk Add</button>
        <button onClick={openAdd} style={{ height:48, padding:'0 14px', borderRadius:10, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>＋</button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <button onClick={() => setRosterView('list')} style={{ flex:1, height:36, borderRadius:20, background:rosterView==='list'?C.gold+'22':C.section, border:`1px solid ${rosterView==='list'?C.gold:C.border}`, color:rosterView==='list'?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>≡ List</button>
        <button onClick={() => setRosterView('roles')} style={{ flex:1, height:36, borderRadius:20, background:rosterView==='roles'?C.gold+'22':C.section, border:`1px solid ${rosterView==='roles'?C.gold:C.border}`, color:rosterView==='roles'?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>⚔️ By Role</button>
      </div>

      {/* Fixed utility row — never scrolls away, unlike the role-filter
          chips below (which grow unbounded as custom roles are added) */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
        <button onClick={() => setFieldRegistryOpen(true)} style={{ padding:'0 12px', minHeight:36, borderRadius:20, whiteSpace:'nowrap', background:'none', border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>📋 Fields</button>
        <button onClick={() => setRoleManagerOpen(true)} style={{ padding:'0 12px', minHeight:36, borderRadius:20, whiteSpace:'nowrap', background:'none', border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>⚙ Roles</button>
        {rosterView==='list' && (
          <button onClick={() => setSortMissing(!sortMissing)} style={{ padding:'0 12px', minHeight:36, borderRadius:20, whiteSpace:'nowrap', background:sortMissing?C.gold+'22':'none', border:`1px solid ${sortMissing?C.gold:C.border}`, color:sortMissing?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>⚠ Missing info first</button>
        )}
      </div>

      {rosterView==='list' && (
        <>
          <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:10, marginBottom:4 }}>
            {['All',...roles.map(r=>r.name)].map(r => (
              <button key={r} onClick={() => setFilterRole(r)} style={{ padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap', background:filterRole===r?C.gold+'22':C.section, border:`1px solid ${filterRole===r?C.gold:C.border}`, color:filterRole===r?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', minHeight:36, flexShrink:0 }}>{r}</button>
            ))}
          </div>
          {players.length > 0 && (
            <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>
              {filteredPlayers.length} of {players.length} player{players.length!==1?'s':''}
            </div>
          )}
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
            <PlayerCard key={p.id} player={p} roles={roles} onClick={() => openProfile(p)} onDelete={onDeletePlayer} events={events} missingCount={sortMissing ? missingCount(p) : 0}/>
          ))}
        </>
      )}

      {rosterView==='roles' && (() => {
        const byRole = roles.map(roleDef => ({ roleDef, members:players.filter(p => p.roles?.includes(roleDef.name)) })).filter(g => g.members.length > 0);
        const unassigned = players.filter(p => !(p.roles||[]).length);
        return (
          <div>
            <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ fontSize:13, color:C.icy, marginBottom:4 }}>Members with a role assigned</div>
              <div style={{ fontSize:28, fontWeight:700, color:C.white }}>
                {players.filter(p => (p.roles||[]).length > 0).length} <span style={{ fontSize:16, color:C.muted }}>of {players.length}</span>
              </div>
            </div>
            {unassigned.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
                  ❔ Unassigned · {unassigned.length}
                </div>
                {unassigned.map(m => (
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
      />
      <PlayerSheet
        open={sheetOpen}
        player={editingPlayer}
        roles={roles}
        onClose={() => { setSheetOpen(false); setEditingPlayer(null); }}
        onSave={onSavePlayer}
        existingTags={[...new Set(players.map(p=>p.allianceTag).filter(Boolean))]}
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
