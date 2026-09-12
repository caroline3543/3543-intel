import { useState, useEffect } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newLeaderProfile, newLeaderTeam } from '../../data/playerSchema.js';
import { LEADER_HERO_OPTIONS, CUSTOM_HERO_OPTIONS, RATIO_PRESETS } from '../svs/battle/battleConstants.js';
import { SheetHandle } from '../common/Primitives.jsx';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal.jsx';

const ROLE_OPTIONS = [
  { id:'none',       label:'Neither' },
  { id:'leader',     label:'Rally Leader' },
  { id:'substitute', label:'Substitute' },
  { id:'both',       label:'Both' },
];

// Same input convention as Live Rally Room's march time fields: last 2
// digits = seconds, the rest = minutes ('412' -> 4m 12s); a colon is
// also accepted directly ('4:12'). Returns total seconds, or null for
// empty/invalid input (seconds > 59).
function parseMarchInput(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s.includes(':')) {
    const [m, sec] = s.split(':').map(n => parseInt(n, 10) || 0);
    return sec > 59 ? null : m * 60 + sec;
  }
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return null;
  const secs = parseInt(digits.slice(-2), 10) || 0;
  const mins = parseInt(digits.slice(0, -2) || '0', 10) || 0;
  return secs > 59 ? null : mins * 60 + secs;
}
function formatMarchSeconds(totalSecs) {
  if (totalSecs == null) return '';
  const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── TeamEditor ─────────────────────────────────────────────────
// One offense or defense team: 3 lead heroes (each with a 0–10 widget
// count), preferred ratio, 4 recommended priority joiner heroes, notes.
function TeamEditor({ team, onChange, onDelete }) {
  function setLeadHero(i, hero) {
    const leadHeroes = [...team.leadHeroes];
    leadHeroes[i] = hero;
    onChange({ ...team, leadHeroes });
  }
  function setWidgets(hero, n) {
    onChange({ ...team, widgets: { ...team.widgets, [hero]: n } });
  }
  function setSkillLevel(hero, n) {
    onChange({ ...team, heroSkillLevels: { ...team.heroSkillLevels, [hero]: n } });
  }
  function setJoinerHero(i, hero) {
    const priorityJoinerHeroes = [...team.priorityJoinerHeroes];
    priorityJoinerHeroes[i] = hero;
    onChange({ ...team, priorityJoinerHeroes });
  }

  return (
    <div style={{ background:C.section, borderRadius:12, padding:14, marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ display:'flex', gap:6 }}>
          {['offense','defense'].map(t => (
            <button key={t} onClick={() => onChange({ ...team, type:t })}
              style={{ padding:'5px 12px', borderRadius:14, border:`1px solid ${team.type===t?C.gold:C.border}`, background:team.type===t?C.gold+'22':C.card, color:team.type===t?C.gold:C.muted, fontWeight:700, fontSize:12, cursor:'pointer', textTransform:'capitalize' }}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={onDelete} style={{ width:30, height:30, borderRadius:8, background:C.red+'18', border:`1px solid ${C.red}44`, color:C.red, fontSize:14, cursor:'pointer' }}>✕</button>
      </div>

      {/* Lead heroes + widgets */}
      <div style={{ marginBottom:10 }}>
        <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Lead heroes (this leader's own 3)</label>
        {[0,1,2].map(i => (
          <div key={i} style={{ marginBottom:10 }}>
            <select value={team.leadHeroes[i] || ''} onChange={e => setLeadHero(i, e.target.value)}
              style={{ width:'100%', height:40, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'0 10px', fontSize:13, color:C.white, fontFamily:'inherit', marginBottom:6, boxSizing:'border-box' }}>
              <option value="">— Hero {i+1} —</option>
              {LEADER_HERO_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            {/* Always rendered (not conditional on a hero being picked)
                so this row's height never changes when a hero is
                selected — that layout shift was pushing the NEXT hero's
                dropdown out from under a fast tap-through-3-heroes
                sequence, causing mis-taps. Disabled/dim until relevant. */}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:11, color:C.muted }}>★</span>
                <input type="number" min={1} max={5} value={team.leadHeroes[i] ? (team.heroSkillLevels?.[team.leadHeroes[i]] ?? '') : ''}
                  onChange={e => team.leadHeroes[i] && setSkillLevel(team.leadHeroes[i], Math.max(1, Math.min(5, Number(e.target.value)||1)))}
                  disabled={!team.leadHeroes[i]}
                  placeholder="—"
                  style={{ width:36, height:40, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'0 6px', fontSize:13, color:team.leadHeroes[i]?C.icy:C.muted, fontWeight:700, fontFamily:'inherit', textAlign:'center', opacity:team.leadHeroes[i]?1:0.4 }}
                />
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:11, color:C.muted }}>Widgets</span>
                <input type="number" min={0} max={10} value={team.leadHeroes[i] ? (team.widgets?.[team.leadHeroes[i]] ?? 0) : ''}
                  onChange={e => team.leadHeroes[i] && setWidgets(team.leadHeroes[i], Math.max(0, Math.min(10, Number(e.target.value)||0)))}
                  disabled={!team.leadHeroes[i]}
                  placeholder="—"
                  style={{ width:44, height:40, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'0 8px', fontSize:13, color:team.leadHeroes[i]?C.gold:C.muted, fontWeight:700, fontFamily:'inherit', textAlign:'center', opacity:team.leadHeroes[i]?1:0.4 }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ratio */}
      <div style={{ marginBottom:10 }}>
        <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Preferred ratio</label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {RATIO_PRESETS.map(r => (
            <button key={r} onClick={() => onChange({ ...team, ratio:r })}
              style={{ padding:'5px 10px', borderRadius:12, border:`1px solid ${team.ratio===r?C.gold:C.border}`, background:team.ratio===r?C.gold+'22':C.card, color:team.ratio===r?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Recommended priority joiner heroes */}
      <div style={{ marginBottom:10 }}>
        <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Recommended priority joiners (4)</label>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          {[0,1,2,3].map(i => (
            <select key={i} value={team.priorityJoinerHeroes[i] || ''} onChange={e => setJoinerHero(i, e.target.value)}
              style={{ height:40, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'0 8px', fontSize:12, color:C.white, fontFamily:'inherit' }}>
              <option value="">— Joiner {i+1} —</option>
              {CUSTOM_HERO_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Notes</label>
        <textarea
          value={team.notes || ''}
          onChange={e => onChange({ ...team, notes:e.target.value })}
          placeholder="e.g. Best used with high-widget Jessie joiners…"
          style={{ width:'100%', minHeight:50, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 10px', fontSize:13, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}
        />
      </div>
    </div>
  );
}

// ── RallyLeaderProfileSheet ────────────────────────────────────
// Props:
//   player    – the player whose profile this is
//   open      – boolean
//   onClose   – () => void
//   onSave    – (updatedPlayer) => void
export function RallyLeaderProfileSheet({ player, open, onClose, onSave }) {
  const [profile, setProfile] = useState(() => player?.leaderProfile || newLeaderProfile());
  const [deleteTeamId, setDeleteTeamId] = useState(null);
  const [marchInput, setMarchInput] = useState('');

  useEffect(() => {
    if (open) {
      const p = player?.leaderProfile || newLeaderProfile();
      setProfile(p);
      setMarchInput(p.marchTime != null ? formatMarchSeconds(p.marchTime) : '');
    }
  }, [open, player]);

  if (!open || !player) return null;

  function updProfile(patch) { setProfile(prev => ({ ...prev, ...patch, updatedAt:new Date().toISOString() })); }

  function addTeam(type) {
    updProfile({ teams:[...profile.teams, newLeaderTeam({ type })] });
    vibe(8);
  }
  function updTeam(id, updated) {
    updProfile({ teams: profile.teams.map(t => t.id===id ? updated : t) });
  }
  function confirmDeleteTeam() {
    updProfile({ teams: profile.teams.filter(t => t.id !== deleteTeamId) });
    setDeleteTeamId(null);
  }

  function save() {
    onSave({ ...player, leaderProfile: profile });
    vibe(8);
    onClose();
  }

  const dn = player.username || player.alias || 'Player';
  const offenseTeams = profile.teams.filter(t => t.type==='offense');
  const defenseTeams = profile.teams.filter(t => t.type==='defense');

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:340, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'90vh', overflowY:'auto', padding:'16px 20px 40px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>👑 Rally Leader Profile</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>
        <div style={{ fontSize:14, color:C.icy, fontWeight:600, marginBottom:16 }}>{dn}</div>

        {/* Role */}
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Role</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {ROLE_OPTIONS.map(r => (
              <button key={r.id} onClick={() => updProfile({ role:r.id })}
                style={{ padding:'8px 14px', borderRadius:16, border:`1px solid ${profile.role===r.id?C.gold:C.border}`, background:profile.role===r.id?C.gold+'22':C.section, color:profile.role===r.id?C.gold:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* March Time — a property of this player's city, not any one
            team, so it lives at the profile level. Same input
            convention as Live Rally Room (last 2 digits = seconds). */}
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>March time</label>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input
              value={marchInput}
              onChange={e => {
                setMarchInput(e.target.value);
                const secs = parseMarchInput(e.target.value);
                updProfile({ marchTime: secs });
              }}
              placeholder="e.g. 412 or 4:12"
              style={{ width:140, height:40, background:C.section, border:`1px solid ${C.border}`, borderRadius:8, padding:'0 12px', fontSize:14, color:C.white, fontFamily:'inherit' }}
            />
            {profile.marchTime != null && (
              <span style={{ fontSize:13, color:C.gold, fontWeight:700 }}>= {formatMarchSeconds(profile.marchTime)}</span>
            )}
            {marchInput && profile.marchTime == null && (
              <span style={{ fontSize:12, color:C.red }}>Invalid — seconds must be 00–59</span>
            )}
          </div>
        </div>

        {/* Offense teams */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.gold, textTransform:'uppercase', letterSpacing:'0.07em' }}>⚔️ Offense teams</label>
            <button onClick={() => addTeam('offense')} style={{ background:'none', border:'none', color:C.gold, fontSize:12, fontWeight:700, cursor:'pointer' }}>＋ Add</button>
          </div>
          {offenseTeams.length===0 && <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>No offense team yet.</div>}
          {offenseTeams.map(team => (
            <TeamEditor key={team.id} team={team} onChange={updated => updTeam(team.id, updated)} onDelete={() => setDeleteTeamId(team.id)} />
          ))}
        </div>

        {/* Defense teams */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.inf, textTransform:'uppercase', letterSpacing:'0.07em' }}>🛡️ Defense teams</label>
            <button onClick={() => addTeam('defense')} style={{ background:'none', border:'none', color:C.inf, fontSize:12, fontWeight:700, cursor:'pointer' }}>＋ Add</button>
          </div>
          {defenseTeams.length===0 && <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>No defense team yet.</div>}
          {defenseTeams.map(team => (
            <TeamEditor key={team.id} team={team} onChange={updated => updTeam(team.id, updated)} onDelete={() => setDeleteTeamId(team.id)} />
          ))}
        </div>

        <button onClick={save} style={{ width:'100%', height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:16, border:'none', cursor:'pointer' }}>
          Save Profile
        </button>
      </div>

      {deleteTeamId && (
        <DeleteConfirmModal
          message="Delete this team setup? This cannot be undone."
          onConfirm={confirmDeleteTeam}
          onCancel={() => setDeleteTeamId(null)}
        />
      )}
    </div>
  );
}
