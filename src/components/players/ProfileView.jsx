import { useState, useEffect } from 'react';
import { C, TROOP_POWER_EVENTS, ALLIANCE_RANKS } from '../../utils/constants.js';
import { roleColor, roleIcon } from '../../utils/roles.js';
import { fmtDateShort } from '../../utils/dates.js';
import { calcMetrics } from '../../data/metrics.js';
import { ReliabilityBadge, SheetHandle } from '../common/Primitives.jsx';
import { TroopPowerChart } from './TroopPowerChart.jsx';

function initials(n) {
  return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
}

function Section({ title, children }) {
  return (
    <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:12 }}>
      <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${C.border}22` }}>
      <span style={{ fontSize:14, color:C.muted }}>{label}</span>
      <span style={{ fontSize:14, color:C.white, fontWeight:600 }}>{value}</span>
    </div>
  );
}

export function ProfileView({ player, roles = [], open, onClose, onEdit, events, onOpenLeaderProfile, onSave }) {
  const [addingHero, setAddingHero] = useState(false);
  const [heroName, setHeroName]     = useState('');
  const [heroSkill, setHeroSkill]   = useState(5);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open||!player) return null;

  const dn      = player.username||player.alias||'Unknown';
  const rc      = roleColor(player.roles?.[0], roles);
  const metrics = calcMetrics(player, events||[]);
  const joiners = player.joinerHeroes || [];
  const snaps   = (events||[])
    .flatMap(ev=>(ev.snapshots||[]).filter(s=>s.playerId===player.id).map(s=>({...s,eventName:ev.name||ev.type,eventDate:ev.date})))
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  const troopPowerHistory = (events||[])
    .filter(ev => TROOP_POWER_EVENTS.includes(ev.type))
    .flatMap(ev => (ev.snapshots||[])
      .filter(s => s.playerId===player.id && s.troopPower != null)
      .map(s => ({ date: ev.date, value: s.troopPower })))
    .sort((a,b) => new Date(a.date) - new Date(b.date))
    .map(p => ({ label: fmtDateShort(p.date), value: p.value }));

  // Typing a name that already exists (case-insensitive) replaces that
  // entry's skill level rather than creating a duplicate.
  function addHero() {
    const name = heroName.trim();
    if (!name) return;
    const existing = joiners.filter(jh => jh.hero.toLowerCase() !== name.toLowerCase());
    onSave({ ...player, joinerHeroes: [...existing, { hero: name, skillLevel: heroSkill, verified: false, updatedAt: new Date().toISOString() }] });
    setHeroName(''); setHeroSkill(5); setAddingHero(false);
  }

  function removeHero(hero) {
    onSave({ ...player, joinerHeroes: joiners.filter(jh => jh.hero !== hero) });
  }

  function setAllianceRank(rank) {
    onSave({ ...player, allianceRank: player.allianceRank === rank ? null : rank });
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'92vh', overflowY:'auto', padding:'16px 20px 80px' }}>
        <SheetHandle />

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div style={{ display:'flex', gap:14, alignItems:'center' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:rc+'33', border:`2px solid ${rc}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:22, color:C.white, flexShrink:0 }}>
              {initials(dn)}
            </div>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:C.white }}>{dn}</div>
              {player.alias&&player.username&&<div style={{ fontSize:13, color:C.muted }}>{player.alias}</div>}
              <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap', alignItems:'center' }}>
                {player.allianceTag&&<span style={{ fontSize:12, color:C.icy, fontWeight:600 }}>[{player.allianceTag}]</span>}
                {player.allianceRank&&<span style={{ fontSize:12, color:C.gold, fontWeight:700, padding:'1px 8px', borderRadius:8, background:C.gold+'18' }}>🎖️ {player.allianceRank}</span>}
                {player.furnaceLevel&&<span style={{ fontSize:12, color:C.gold, fontWeight:700 }}>{player.furnaceLevel}</span>}
                {metrics&&<ReliabilityBadge score={metrics.reliabilityScore}/>}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onEdit} style={{ height:36, padding:'0 16px', borderRadius:20, background:C.gold, color:C.bg, fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>Edit</button>
            <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
          </div>
        </div>

        {/* Rally Leader Profile — preset offense/defense squads. Not
            gated behind the "Rally Lead" role tag, since a player's
            saved leader profile and their role tag are deliberately
            separate concepts (see playerSchema.js) — anyone could have
            presets set up regardless of their current roles. */}
        <button
          onClick={onOpenLeaderProfile}
          style={{ width:'100%', height:44, borderRadius:10, background:'none', border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:600, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:12 }}
        >
          👑 Rally Leader Profile — preset squads →
        </button>

        {/* Alliance Rank — settable directly here instead of only
            being visible as a read-only badge in the header. */}
        <Section title="Alliance Rank">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {ALLIANCE_RANKS.map(rank => {
              const sel = player.allianceRank === rank;
              return (
                <button key={rank} onClick={() => setAllianceRank(rank)}
                  style={{ minWidth:52, height:44, borderRadius:10, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.card, color:sel?C.gold:C.muted, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                  {rank}
                </button>
              );
            })}
          </div>
        </Section>

        {/* 1. Role in SvS — most important, shown first */}
        {player.roles?.length>0 && (
          <Section title="Role in SvS">
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {player.roles.map(r=>{
                const rColor = roleColor(r, roles);
                return (
                  <span key={r} style={{ padding:'8px 16px', borderRadius:20, background:rColor+'22', border:`1px solid ${rColor}44`, color:rColor, fontWeight:700, fontSize:14 }}>
                    {roleIcon(r, roles)} {r}
                  </span>
                );
              })}
            </div>
          </Section>
        )}

        {/* 1.5. Rally Leader setup — inline summary so this is visible
            without tapping into the separate profile sheet, per the
            brief's requirement that hero/skill/widget info show
            directly on the profile. The button below still opens the
            full editor for changes. */}
        {(player.leaderProfile?.teams || []).length > 0 && (
          <Section title="Rally Leader Setup">
            {player.leaderProfile.marchTime != null && (
              <div style={{ fontSize:13, color:C.gold, fontWeight:700, marginBottom:10 }}>
                🏃 March time: {Math.floor(player.leaderProfile.marchTime / 60)}:{String(player.leaderProfile.marchTime % 60).padStart(2,'0')}
              </div>
            )}
            {player.leaderProfile.teams.map(team => {
              const heroes = (team.leadHeroes || []).filter(Boolean);
              if (!heroes.length) return null;
              return (
                <div key={team.id} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{team.type === 'offense' ? '⚔️ Offense' : '🛡️ Defense'}{team.ratio ? ` · ${team.ratio}` : ''}</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {heroes.map(h => {
                      const skill = team.heroSkillLevels?.[h];
                      const widgets = team.widgets?.[h];
                      return (
                        <span key={h} style={{ padding:'6px 12px', borderRadius:16, background:C.gold+'18', border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:600, fontSize:13 }}>
                          {h}{skill != null ? ` • ★${skill}` : ''}{widgets != null ? ` • ${widgets}w` : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </Section>
        )}

        {/* 2. Troops — needed for assignment */}
        <Section title="Troops">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {[['🛡️ Infantry',player.troops?.infantry,C.inf],['⚔️ Lancer',player.troops?.lancer,C.lan],['🏹 Marksman',player.troops?.marksman,C.mar]].map(([label,t,c])=>(
              <div key={label} style={{ background:C.card, borderRadius:10, padding:12, textAlign:'center' }}>
                <div style={{ fontSize:11, color:c, fontWeight:700, marginBottom:6 }}>{label}</div>
                <div style={{ fontSize:18, fontWeight:700, color:t?c:C.muted }}>{t||'—'}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* 3. Joiner heroes — checked before every SvS. Now editable
            right here instead of only through the separate Joiner
            Registry screen. */}
        <Section title="Joiner Heroes">
          {joiners.length>0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              {joiners.map(jh=>(
                <span key={jh.hero} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 12px 8px 16px', borderRadius:20, background:C.gold+'18', border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:600, fontSize:14 }}>
                  {jh.hero}{jh.skillLevel!=null?` · ★${jh.skillLevel}`:''}
                  <button onClick={() => removeHero(jh.hero)} aria-label={`Remove ${jh.hero}`}
                    style={{ width:20, height:20, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'none', color:C.gold+'99', fontSize:13, cursor:'pointer', padding:0 }}>✕</button>
                </span>
              ))}
            </div>
          )}
          {addingHero ? (
            <div style={{ background:C.card, borderRadius:10, padding:12 }}>
              <input
                value={heroName}
                onChange={e => setHeroName(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); addHero(); } }}
                placeholder="Hero name…"
                autoFocus
                style={{ width:'100%', height:44, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 14px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit', marginBottom:10 }}
              />
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <span style={{ fontSize:12, color:C.muted }}>Skill</span>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setHeroSkill(n)}
                    style={{ width:36, height:36, borderRadius:'50%', border:`1px solid ${heroSkill===n?C.gold:C.border}`, background:heroSkill===n?C.gold+'22':C.section, color:heroSkill===n?C.gold:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => { setAddingHero(false); setHeroName(''); }}
                  style={{ flex:1, height:44, borderRadius:10, background:'none', border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>Cancel</button>
                <button onClick={addHero} disabled={!heroName.trim()}
                  style={{ flex:2, height:44, borderRadius:10, background:heroName.trim()?C.gold:C.section, border:'none', color:heroName.trim()?C.bg:C.muted, fontWeight:700, fontSize:14, cursor:heroName.trim()?'pointer':'default' }}>Add Hero</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingHero(true)}
              style={{ width:'100%', height:44, borderRadius:10, background:'none', border:`1px dashed ${C.border}`, color:C.icy, fontWeight:600, fontSize:14, cursor:'pointer' }}>
              + Add Joiner Hero
            </button>
          )}
        </Section>

        {/* 5. Identity — reference info, lower priority */}
        <Section title="Identity">
          <Row label="Player ID" value={player.fid}/>
          <Row label="Country"   value={player.country}/>
          <Row label="Languages" value={player.languages?.join(', ')}/>
        </Section>

        {/* 6. Event history */}
        {metrics&&(
          <Section title="Event History">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
              {[['Attendance',`${metrics.attendancePct}%`,metrics.attendancePct>=70?C.green:C.gold],['Discord',`${metrics.voicePct}%`,C.icy],['Reliability',metrics.reliabilityScore,metrics.reliabilityScore>=70?C.green:C.gold]].map(([l,v,c])=>(
                <div key={l} style={{ background:C.card, borderRadius:10, padding:10, textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:700, color:c }}>{v}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
            {snaps.slice(0,4).map(s=>(
              <div key={s.snapshotId} style={{ padding:'8px 0', borderBottom:`1px solid ${C.border}22`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.white }}>{s.eventName}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{fmtDateShort(s.eventDate)}</div>
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  {s.attendance.attended===true&&<span style={{ fontSize:11, padding:'2px 6px', borderRadius:8, background:C.green+'18', color:C.green }}>✓</span>}
                  {s.attendance.noShow&&<span style={{ fontSize:11, padding:'2px 6px', borderRadius:8, background:C.red+'18', color:C.red }}>✗</span>}
                  {s.voice.joined===true&&<span style={{ fontSize:11, padding:'2px 6px', borderRadius:8, background:C.icy+'18', color:C.icy }}>🎙️</span>}
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* 6.5 Troop Power — Foundry / Canyon Clash only */}
        {troopPowerHistory.length > 0 && (
          <Section title="Troop Power">
            <TroopPowerChart points={troopPowerHistory}/>
            <div style={{ fontSize:11, color:C.muted, marginTop:8, textAlign:'center' }}>Across Foundry / Canyon Clash events</div>
          </Section>
        )}

        {/* 7. Notes */}
        {player.notes&&(
          <Section title="Notes">
            <div style={{ fontSize:14, color:C.icy, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{player.notes}</div>
          </Section>
        )}

        <button onClick={onClose} style={{ width:'100%', height:48, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Close</button>
      </div>
    </div>
  );
}
