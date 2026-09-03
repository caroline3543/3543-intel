import { useState } from 'react';
import { C, LANGUAGES, TIER_OPTIONS, ALLIANCE_RANKS, HEROES_BY_GEN, FC_OPTIONS } from '../../utils/constants.js';
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
  getCustomHeroGen,
  setCustomHeroGen,
} from '../../services/fieldRegistryService.js';
import { matchNamesToPlayers } from '../../utils/nameList.js';

// Generation label for a joiner hero — built-in heroes resolve from
// HEROES_BY_GEN (constants.js); anything an officer typed in that
// isn't in that table falls back to the custom-hero-generation store.
function heroGenLabel(hero) {
  const builtIn = HEROES_BY_GEN.find(g => g.heroes.some(h => h.toLowerCase() === hero.toLowerCase()));
  return builtIn ? builtIn.gen : getCustomHeroGen(hero);
}

// Add a new field here to extend the registry to any other profile
// attribute — nothing else in this file needs to change.
const FIELD_DEFS = [
  {
    id: 'languages', label: 'Languages', icon: '🗣️', multi: true,
    baseOptions: () => LANGUAGES,
    get: (p) => p.languages || [],
  },
  {
    id: 'furnace', label: 'Furnace Level', icon: '🔥', multi: false,
    baseOptions: () => FC_OPTIONS,
    get: (p) => (p.furnaceLevel ? [p.furnaceLevel] : []),
  },
  {
    id: 'allianceTag', label: 'Alliance', icon: '🚩', multi: false,
    // No fixed base list — alliance tags are entirely alliance-defined,
    // not a preset table. Values come from whatever's already on
    // someone's profile, plus anything typed into the custom-add row.
    baseOptions: () => [],
    get: (p) => (p.allianceTag ? [p.allianceTag] : []),
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
  if (field.id === 'furnace') {
    return [...values].sort((a, b) => FC_OPTIONS.indexOf(a) - FC_OPTIONS.indexOf(b));
  }
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
  const [assignMode, setAssignMode] = useState('search'); // 'search' | 'paste'
  const [pasteText, setPasteText] = useState('');

  const owners = getPlayersWithFieldValue(players, field, value);
  const count = owners.length;
  const isJoinerHero = field.id === 'joinerHeroes';
  const unassignedPool = players.filter(p => !field.get(p).includes(value));
  const { matched: pasteMatched, unmatched: pasteUnmatched } = matchNamesToPlayers(pasteText, unassignedPool);

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

  function addOwnersBatch(playersToAdd) {
    playersToAdd.forEach(p => {
      if (isJoinerHero) onUpdatePlayer(addJoinerHeroToPlayer(p, value));
      else onUpdatePlayer(assignFieldValue(p, field, value));
    });
    setPasteText('');
    vibe(8);
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
          <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>
            {value}
            {isJoinerHero && heroGenLabel(value) && (
              <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginLeft: 8 }}>· {heroGenLabel(value)}</span>
            )}
          </div>
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
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button onClick={() => setAssignMode('search')} style={{ flex: 1, height: 32, borderRadius: 16, background: assignMode==='search'?C.gold+'22':C.section, border: `1px solid ${assignMode==='search'?C.gold:C.border}`, color: assignMode==='search'?C.gold:C.muted, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>🔍 Search one at a time</button>
            <button onClick={() => setAssignMode('paste')} style={{ flex: 1, height: 32, borderRadius: 16, background: assignMode==='paste'?C.gold+'22':C.section, border: `1px solid ${assignMode==='paste'?C.gold:C.border}`, color: assignMode==='paste'?C.gold:C.muted, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>📋 Paste a list</button>
          </div>
          {assignMode === 'search' ? (
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
          ) : (
          <div>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={'Paste names, comma or newline separated…'}
              rows={3}
              style={{ width: '100%', background: C.section, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: C.white, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', marginBottom: 8 }}
            />
            {(pasteMatched.length > 0 || pasteUnmatched.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {pasteMatched.map(p => (
                  <span key={p.id} style={{ padding: '5px 10px', borderRadius: 14, background: C.green + '18', border: `1px solid ${C.green}44`, color: C.green, fontSize: 12 }}>✓ {p.username || p.alias}</span>
                ))}
                {pasteUnmatched.map((n, i) => (
                  <span key={i} title="No roster match for this name" style={{ padding: '5px 10px', borderRadius: 14, background: C.red + '14', border: `1px solid ${C.red}44`, color: C.red + 'cc', fontSize: 12 }}>? {n}</span>
                ))}
              </div>
            )}
            <button
              onClick={() => addOwnersBatch(pasteMatched)}
              disabled={pasteMatched.length === 0}
              style={{ width: '100%', height: 44, borderRadius: 10, background: pasteMatched.length ? C.gold + '22' : C.section, border: `1px solid ${pasteMatched.length ? C.gold : C.border}`, color: pasteMatched.length ? C.gold : C.muted, fontWeight: 700, fontSize: 14, cursor: pasteMatched.length ? 'pointer' : 'default' }}
            >
              {field.multi ? `Add ${pasteMatched.length || ''} player${pasteMatched.length !== 1 ? 's' : ''}` : `Set ${pasteMatched.length || ''} player${pasteMatched.length !== 1 ? 's' : ''}`}
            </button>
          </div>
          )}
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

// ── Add a brand-new joiner hero, tagged with its generation ──────
// Separate from AddValueRow (used by every other field) because this
// is the one field where a new value needs a second piece of metadata
// captured alongside it — the generation isn't guessable from the name.
function AddJoinerHeroRow({ onAdd }) {
  const [text, setText] = useState('');
  const [gen, setGen] = useState('');
  const knownGen = HEROES_BY_GEN.find(g => g.heroes.some(h => h.toLowerCase() === text.trim().toLowerCase()))?.gen;
  const needsGenChoice = !!text.trim() && !knownGen; // genuinely new — not in the built-in meta table

  function submit() {
    if (!text.trim()) return;
    if (needsGenChoice && !gen) return; // require a generation before adding an unrecognized hero
    onAdd(text.trim(), knownGen || gen || null);
    setText(''); setGen('');
    vibe(8);
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: needsGenChoice ? 10 : 0 }}>
        <input
          value={text}
          onChange={e => { setText(e.target.value); setGen(''); }}
          onKeyDown={e => { if (e.key === 'Enter' && !(needsGenChoice && !gen)) submit(); }}
          placeholder="New joiner hero…"
          style={{ flex: 1, background: C.section, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: C.white, boxSizing: 'border-box', fontFamily: 'inherit', minHeight: 44 }}
        />
        <button
          onClick={submit}
          disabled={needsGenChoice && !gen}
          style={{ padding: '0 16px', borderRadius: 10, background: (needsGenChoice && !gen) ? C.section : C.gold + '22', border: `1px solid ${(needsGenChoice && !gen) ? C.border : C.gold}`, color: (needsGenChoice && !gen) ? C.muted : C.gold, fontWeight: 700, fontSize: 14, cursor: (needsGenChoice && !gen) ? 'default' : 'pointer', minHeight: 44 }}
        >
          + Add
        </button>
      </div>
      {needsGenChoice && (
        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Not in the built-in meta table — which generation is "{text.trim()}" from?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {HEROES_BY_GEN.map(g => (
              <button key={g.gen} onClick={() => setGen(g.gen)}
                style={{ padding: '6px 12px', borderRadius: 16, minHeight: 36, border: `1px solid ${gen===g.gen?C.gold:C.border}`, background: gen===g.gen?C.gold+'22':C.section, color: gen===g.gen?C.gold:C.muted, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                {g.gen}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── FieldRegistry (main export) ──────────────────────────────────
export default function FieldRegistry({ players, onUpdatePlayer, onClose }) {
  const [fieldId, setFieldId] = useState(FIELD_DEFS[0].id);
  const [, bumpRefresh] = useState(0); // custom options live in localStorage, not player state — force a re-render after adding one

  const field = FIELD_DEFS.find(f => f.id === fieldId);
  const values = sortValues(field, getFieldValues(players, field));

  function handleAddCustomOption(value, gen) {
    addCustomOption(field.id, value);
    if (field.id === 'joinerHeroes' && gen) setCustomHeroGen(value, gen);
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
        {field.id === 'joinerHeroes'
          ? <AddJoinerHeroRow onAdd={handleAddCustomOption} />
          : <AddValueRow field={field} onAdd={handleAddCustomOption} />}
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
