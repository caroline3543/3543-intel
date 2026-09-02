import { useState } from 'react';
import { C, LANGUAGES, TIER_OPTIONS, ALLIANCE_RANKS } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { JOINER_HEROES } from '../../data/joinerMeta.js';
import { addJoinerHeroToPlayer, removeJoinerHeroFromPlayer } from '../../services/joinerRegistryService.js';
import { searchPlayers } from '../../services/playerAutosuggest.js';
import {
  getFieldValues,
  getPlayersWithFieldValue,
  assignFieldValue,
  removeFieldValue,
  addCustomOption,
} from '../../services/fieldRegistryService.js';

// Add a new field here to extend the registry to any other profile
// attribute — nothing else in this file needs to change.
const FIELD_DEFS = [
  {
    id: 'languages', label: 'Languages', icon: '🗣️', multi: true,
    baseOptions: () => LANGUAGES,
    get: (p) => p.languages || [],
  },
  {
    id: 'infantry', label: 'Infantry Tier', icon: '⚔️', multi: false,
    baseOptions: () => TIER_OPTIONS,
    get: (p) => (p.troops?.infantry ? [p.troops.infantry] : []),
  },
  {
    id: 'lancer', label: 'Lancer Tier', icon: '🐎', multi: false,
    baseOptions: () => TIER_OPTIONS,
    get: (p) => (p.troops?.lancer ? [p.troops.lancer] : []),
  },
  {
    id: 'marksman', label: 'Marksman Tier', icon: '🏹', multi: false,
    baseOptions: () => TIER_OPTIONS,
    get: (p) => (p.troops?.marksman ? [p.troops.marksman] : []),
  },
  {
    id: 'joinerHeroes', label: 'Joiner Heroes (Skill 5)', icon: '🦸', multi: true,
    baseOptions: () => JOINER_HEROES,
    get: (p) => (p.joinerHeroes || []).filter(jh => jh.skillLevel >= 5).map(jh => jh.hero),
  },
  {
    id: 'allianceRank', label: 'Alliance Rank', icon: '🎖️', multi: false,
    baseOptions: () => ALLIANCE_RANKS,
    get: (p) => (p.allianceRank ? [p.allianceRank] : []),
  },
];

const TIER_FIELD_IDS = ['infantry', 'lancer', 'marksman'];

function initials(n) { return (n || '?').split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '?'; }

function sortValues(field, values) {
  if (TIER_FIELD_IDS.includes(field.id)) {
    return [...values].sort((a, b) => TIER_OPTIONS.indexOf(a) - TIER_OPTIONS.indexOf(b));
  }
  if (field.id === 'allianceRank') {
    return [...values].sort((a, b) => ALLIANCE_RANKS.indexOf(a) - ALLIANCE_RANKS.indexOf(b));
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

// ── Value Card — one card per possible value of the selected field ──
function ValueCard({ field, value, players, onUpdatePlayer }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const owners = getPlayersWithFieldValue(players, field, value);
  const count = owners.length;
  const isJoinerHero = field.id === 'joinerHeroes';

  function search(q) {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    const pool = players.filter(p => !field.get(p).includes(value));
    setResults(searchPlayers(pool, q, 5));
  }

  function addOwner(player) {
    if (isJoinerHero) {
      onUpdatePlayer(addJoinerHeroToPlayer(player, value));
    } else {
      onUpdatePlayer(assignFieldValue(player, field, value));
    }
    setQuery(''); setResults([]);
  }

  function removeOwner(player) {
    if (isJoinerHero) {
      onUpdatePlayer(removeJoinerHeroFromPlayer(player, value));
    } else {
      onUpdatePlayer(removeFieldValue(player, field, value));
    }
  }

  return (
    <div style={{ background: C.card, borderRadius: 12, padding: 14, marginBottom: 8 }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>{value}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{count} player{count !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: count > 0 ? C.gold : C.muted }}>{count}</div>
          <span style={{ fontSize: 16, color: C.muted }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          {owners.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {field.multi ? 'Assigned' : 'Currently set'}
              </div>
              {owners.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}22` }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.muted + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: C.white, flexShrink: 0 }}>{initials(p.username || p.alias || '?')}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{p.username || p.alias || '?'}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.allianceTag ? `[${p.allianceTag}]` : ''}{p.furnaceLevel ? ` FC${p.furnaceLevel}` : ''}</div>
                  </div>
                  <button onClick={() => removeOwner(p)} style={{ background: 'none', border: 'none', color: C.red + '88', fontSize: 16, cursor: 'pointer', padding: '4px' }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            {field.multi ? 'Add Player' : 'Set Player — replaces their existing value'}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              value={query}
              onChange={e => search(e.target.value)}
              placeholder="Search player by name…"
              style={{ width: '100%', background: C.section, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 15, color: C.white, boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            {results.length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', zIndex: 600, boxShadow: '0 8px 24px #000a' }}>
                {results.map(p => {
                  const existing = field.get(p)[0];
                  const willReplace = !field.multi && existing;
                  return (
                    <button key={p.id} onClick={() => { addOwner(p); vibe(8); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: `1px solid ${C.border}22`, cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.muted + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: C.white, flexShrink: 0 }}>{initials(p.username || p.alias || '?')}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{p.username || p.alias || '?'}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>
                          {p.allianceTag ? `[${p.allianceTag}] ` : ''}{willReplace ? `currently ${existing}` : ''}
                        </div>
                      </div>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: willReplace ? C.gold : C.green, fontWeight: 600 }}>{willReplace ? 'Replace ›' : 'Add ›'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add a brand-new value that isn't in the predefined list yet ──
function AddValueRow({ field, onAdd }) {
  const [text, setText] = useState('');
  function submit() {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
    vibe(8);
  }
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        placeholder={`New ${field.label.toLowerCase()} value…`}
        style={{ flex: 1, background: C.section, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: C.white, boxSizing: 'border-box', fontFamily: 'inherit', minHeight: 44 }}
      />
      <button
        onClick={submit}
        style={{ padding: '0 16px', borderRadius: 10, background: C.gold + '22', border: `1px solid ${C.gold}`, color: C.gold, fontWeight: 700, fontSize: 14, cursor: 'pointer', minHeight: 44 }}
      >
        + Add
      </button>
    </div>
  );
}

// ── FieldRegistry (main export) ──────────────────────────────────
export default function FieldRegistry({ players, onUpdatePlayer, onClose }) {
  const [fieldId, setFieldId] = useState(FIELD_DEFS[0].id);
  const [, bumpRefresh] = useState(0); // custom options live in localStorage, not player state — force a re-render after adding one

  const field = FIELD_DEFS.find(f => f.id === fieldId);
  const values = sortValues(field, getFieldValues(players, field));

  function handleAddCustomOption(value) {
    addCustomOption(field.id, value);
    bumpRefresh(n => n + 1);
  }

  return (
    <div style={{ height: '100vh', fontFamily: 'system-ui,-apple-system,sans-serif', color: C.white, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, background: C.bg, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0 }}>← Back</button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.white }}>📋 Field Registry</div>
            <div style={{ fontSize: 12, color: C.muted }}>Pick a field, then assign players to each value · {players.length} players</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginTop: 12 }}>
          {FIELD_DEFS.map(f => (
            <button key={f.id} onClick={() => setFieldId(f.id)} style={{ padding: '7px 14px', borderRadius: 20, whiteSpace: 'nowrap', background: fieldId === f.id ? C.gold + '22' : C.section, border: `1px solid ${fieldId === f.id ? C.gold : C.border}`, color: fieldId === f.id ? C.gold : C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0, minHeight: 36 }}>
              {f.icon} {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', paddingBottom: 40 }}>
        <AddValueRow field={field} onAdd={handleAddCustomOption} />
        {values.length === 0 && (
          <div style={{ fontSize: 14, color: C.muted, textAlign: 'center', padding: '20px 0' }}>No values yet — add one above.</div>
        )}
        {values.map(v => (
          <ValueCard key={v} field={field} value={v} players={players} onUpdatePlayer={onUpdatePlayer} />
        ))}
      </div>
    </div>
  );
}
