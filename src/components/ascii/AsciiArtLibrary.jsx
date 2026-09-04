import { useState, useEffect } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newAsciiArt } from '../../data/asciiArtSchema.js';
import { Field, Inp, SheetHandle } from '../common/Primitives.jsx';

// Shared preview styling — used identically on the card list, the
// create/edit live preview, and the insert picker, so what you see
// while typing is exactly what you'll see saved, and exactly what you
// see is exactly what gets copied. Monospace, no wrapping (horizontal
// scroll instead — see overflowX), no whitespace collapsing.
const PREVIEW_STYLE = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: '14px 16px',
  fontSize: 13,
  color: C.icy,
  fontFamily: 'monospace',
  whiteSpace: 'pre',
  overflowX: 'auto',
  margin: 0,
};

// ── Add/Edit sheet ─────────────────────────────────────────────
function ArtSheet({ art, allArt, open, onClose, onSave }) {
  const [a, setA] = useState(() => art || newAsciiArt());

  useEffect(() => {
    if (open) setA(art ? { ...art } : newAsciiArt());
  }, [open, art?.id]);

  // Nothing here ever calls .trim() or reformats a.art itself — the
  // only trimming is on a COPY of the title/art for the enable-check
  // below, never on the value that actually gets saved.
  function upd(k, v) { setA(prev => ({ ...prev, [k]: v, updatedAt: new Date().toISOString() })); }
  const canSave = a.title.trim() && a.art.trim();
  if (!open) return null;

  const existingCategories = [...new Set(allArt.map(x => x.category).filter(Boolean))].sort();

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:900, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'92vh', overflowY:'auto', padding:'16px 20px 40px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{art ? 'Edit Art' : 'Create ASCII'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>

        <Field label="Title">
          <Inp value={a.title} onChange={v => upd('title', v)} placeholder="e.g. Alliance Logo" />
        </Field>

        <Field label="Category" hint="Tap an existing one, or type a new category — there's no fixed list">
          {existingCategories.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
              {existingCategories.map(cat => (
                <button key={cat} onClick={() => upd('category', cat)}
                  style={{ padding:'6px 12px', borderRadius:16, background:a.category===cat?C.gold+'22':C.section, border:`1px solid ${a.category===cat?C.gold:C.border}`, color:a.category===cat?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                  {cat}
                </button>
              ))}
            </div>
          )}
          <Inp value={a.category} onChange={v => upd('category', v)} placeholder="Category name" />
        </Field>

        <Field label="ASCII Art" hint="Exactly what gets copied, character for character — every space, line break, and tab is preserved">
          <textarea
            value={a.art}
            onChange={e => upd('art', e.target.value)}
            placeholder={'Paste or type your ASCII art here…'}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            style={{ width:'100%', minHeight:220, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:13, color:C.white, resize:'vertical', boxSizing:'border-box', fontFamily:'monospace', whiteSpace:'pre', tabSize:4 }}
          />
        </Field>

        <Field label="Preview" hint="Updates live — this is exactly how it will look saved">
          <pre style={{ ...PREVIEW_STYLE, minHeight:80 }}>{a.art || ' '}</pre>
        </Field>

        <Field label="Tags" hint="Comma separated, optional — used for search">
          <Inp value={(a.tags||[]).join(', ')} onChange={v => upd('tags', v.split(',').map(s=>s.trim()).filter(Boolean))} placeholder="e.g. banner, svs, warning" />
        </Field>

        <div style={{ display:'flex', gap:10, marginTop:6 }}>
          <button onClick={onClose} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:15, cursor:'pointer' }}>Cancel</button>
          <button onClick={() => { onSave(a); onClose(); vibe(8); }} disabled={!canSave}
            style={{ flex:2, height:52, borderRadius:12, background:canSave?C.gold:C.section, color:canSave?C.bg:C.muted, fontWeight:700, fontSize:16, border:'none', cursor:canSave?'pointer':'default' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Picker sheet — for inserting art into a Notice, not for managing
// the library itself. Kept lightweight and separate from the full
// browse screen below so composing a notice doesn't have to leave the
// composer to go dig through the whole library.
export function AsciiArtPickerSheet({ asciiArts = [], open, onClose, onPick }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:950, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'70vh', overflowY:'auto', padding:'16px 20px 30px' }}>
        <SheetHandle />
        <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:14 }}>Insert ASCII Art</div>
        {asciiArts.length === 0 && <div style={{ fontSize:13, color:C.muted }}>No art saved yet.</div>}
        {asciiArts.map(a => (
          <button key={a.id} onClick={() => { onPick(a.art); onClose(); }}
            style={{ display:'block', width:'100%', textAlign:'left', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', marginBottom:8, cursor:'pointer' }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:4 }}>{a.title}</div>
            <pre style={{ ...PREVIEW_STYLE, fontSize:11, padding:'8px 10px', maxHeight:48, overflowY:'hidden' }}>{a.art}</pre>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── AsciiArtLibrary (main export) — standalone browse/save/copy screen
export default function AsciiArtLibrary({ asciiArts = [], onSaveArt, onDeleteArt, onClose }) {
  const [search, setSearch]       = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingArt, setEditingArt] = useState(null);
  const [copiedId, setCopiedId]   = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const categories = [...new Set(asciiArts.map(a => a.category).filter(Boolean))].sort();

  const filtered = asciiArts
    .filter(a => filterCat === 'All' || a.category === filterCat)
    .filter(a => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return a.title.toLowerCase().includes(q)
        || (a.category||'').toLowerCase().includes(q)
        || (a.tags||[]).some(t => t.toLowerCase().includes(q));
    });

  // Copies the raw art string exactly as stored — no code fences, no
  // added quotes, no alteration of any character. This is what gets
  // pasted straight into the game or Discord, so it has to be pixel-
  // perfect (well — character-perfect) with what's on screen.
  function copyArt(a) {
    navigator.clipboard.writeText(a.art).then(() => {
      setCopiedId(a.id);
      setTimeout(() => setCopiedId(null), 2000);
      vibe(8);
    });
  }

  return (
    <div style={{ height:'100vh', fontFamily:'system-ui,-apple-system,sans-serif', color:C.white, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, background:C.bg, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', padding:0 }}>← Back</button>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:C.white }}>🎨 ASCII Art Library</div>
            <div style={{ fontSize:12, color:C.muted }}>{asciiArts.length} saved</div>
          </div>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, category, tags…"
          style={{ width:'100%', height:40, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 14px', fontSize:14, color:C.white, boxSizing:'border-box', fontFamily:'inherit', marginBottom:10 }} />
        {categories.length > 0 && (
          <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
            {['All', ...categories].map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)}
                style={{ padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap', background:filterCat===cat?C.gold+'22':C.section, border:`1px solid ${filterCat===cat?C.gold:C.border}`, color:filterCat===cat?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', flexShrink:0, minHeight:36 }}>
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', paddingBottom:100 }}>
        <button onClick={() => { setEditingArt(null); setSheetOpen(true); }}
          style={{ width:'100%', height:48, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer', marginBottom:16 }}>
          ＋ Create ASCII
        </button>

        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🎨</div>
            <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{asciiArts.length === 0 ? 'Nothing here yet' : 'No matches'}</div>
          </div>
        )}

        {filtered.map(a => (
          <div key={a.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10, gap:10 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:4 }}>{a.title}</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {a.category && <span style={{ fontSize:11, fontWeight:700, color:C.muted, padding:'1px 8px', borderRadius:8, background:C.section }}>{a.category}</span>}
                  {(a.tags||[]).map(t => (
                    <span key={t} style={{ fontSize:11, color:C.icy, padding:'1px 8px', borderRadius:8, background:C.icy+'14' }}>#{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:10, flexShrink:0 }}>
                <button onClick={() => { setEditingArt(a); setSheetOpen(true); }} style={{ background:'none', border:'none', color:C.muted, fontSize:15, cursor:'pointer', padding:0 }}>✏️</button>
                <button onClick={() => setDeleteConfirmId(a.id)} style={{ background:'none', border:'none', color:C.red+'88', fontSize:15, cursor:'pointer', padding:0 }}>✕</button>
              </div>
            </div>
            <pre style={{ ...PREVIEW_STYLE, marginBottom:10, maxHeight:220, overflowY:'auto' }}>{a.art}</pre>
            <button onClick={() => copyArt(a)}
              style={{ width:'100%', height:40, borderRadius:10, background:copiedId===a.id?C.green+'18':C.gold+'18', border:`1px solid ${copiedId===a.id?C.green:C.gold}44`, color:copiedId===a.id?C.green:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {copiedId===a.id ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
        ))}
      </div>

      <ArtSheet
        art={editingArt}
        allArt={asciiArts}
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditingArt(null); }}
        onSave={onSaveArt}
      />

      {deleteConfirmId && (
        <div onClick={() => setDeleteConfirmId(null)} style={{ position:'fixed', inset:0, background:'#000c', zIndex:950, display:'flex', alignItems:'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'20px 20px 28px' }}>
            <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:16 }}>Delete this art?</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ flex:1, height:50, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:15, cursor:'pointer' }}>Cancel</button>
              <button onClick={() => { onDeleteArt(deleteConfirmId); setDeleteConfirmId(null); }} style={{ flex:1, height:50, borderRadius:12, background:C.red, color:'#fff', fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
