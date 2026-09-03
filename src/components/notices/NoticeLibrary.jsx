import { useState, useEffect } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newNotice, NOTICE_CATEGORIES } from '../../data/noticeSchema.js';
import { suggestForToday, markPostedToday, todayCycleDay } from '../../services/noticeCycleService.js';
import { Field, Inp, SheetHandle } from '../common/Primitives.jsx';

const CATEGORY_ICONS = { Notice: '📢', 'To-Do': '✅', Info: 'ℹ️' };

// ── Add/Edit sheet ─────────────────────────────────────────────
function NoticeSheet({ notice, open, onClose, onSave }) {
  const [n, setN] = useState(() => notice || newNotice());

  useEffect(() => {
    if (open) setN(notice ? { ...notice } : newNotice());
  }, [open, notice?.id]);

  function upd(k, v) { setN(prev => ({ ...prev, [k]: v, updatedAt: new Date().toISOString() })); }
  const canSave = n.title.trim() && n.body.trim();
  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:900, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'90vh', overflowY:'auto', padding:'16px 20px 40px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{notice ? 'Edit Notice' : 'New Notice'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>
        <Field label="Category">
          <div style={{ display:'flex', gap:8 }}>
            {NOTICE_CATEGORIES.map(c => (
              <button key={c} onClick={() => upd('category', c)}
                style={{ flex:1, height:44, borderRadius:12, border:`1px solid ${n.category===c?C.gold:C.border}`, background:n.category===c?C.gold+'22':C.section, color:n.category===c?C.gold:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                {CATEGORY_ICONS[c]} {c}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Title">
          <Inp value={n.title} onChange={v => upd('title', v)} placeholder="e.g. SvS Prep Reminder" />
        </Field>
        <Field label="Message" hint="Exactly what gets copied as a code block — no extra formatting added">
          <textarea value={n.body} onChange={e => upd('body', e.target.value)} placeholder="Type the notice text…"
            style={{ width:'100%', minHeight:140, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:15, color:C.white, resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }} />
        </Field>
        <Field label="Tags" hint="Comma separated — used for search, not for suggestions">
          <Inp value={(n.tags||[]).join(', ')} onChange={v => upd('tags', v.split(',').map(s=>s.trim()).filter(Boolean))} placeholder="e.g. SvS, Foundry" />
        </Field>
        {n.postedDates?.length > 0 && (
          <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>
            Posted {n.postedDates.length}× · most recently {n.postedDates[n.postedDates.length-1]}
          </div>
        )}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:15, cursor:'pointer' }}>Cancel</button>
          <button onClick={() => { onSave(n); onClose(); vibe(8); }} disabled={!canSave}
            style={{ flex:2, height:52, borderRadius:12, background:canSave?C.gold:C.section, color:canSave?C.bg:C.muted, fontWeight:700, fontSize:16, border:'none', cursor:canSave?'pointer':'default' }}>
            Save Notice
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NoticeLibrary (main export) ───────────────────────────────
// Props:
//   notices        – array of notice objects (see noticeSchema.js)
//   settings       – alliance settings; reads settings.cycleAnchorDate
//   onSaveNotice   – (notice) => void — create or update
//   onDeleteNotice – (id) => void
//   onClose        – () => void
export default function NoticeLibrary({ notices = [], settings = {}, onSaveNotice, onDeleteNotice, onClose }) {
  const [filterCat, setFilterCat]       = useState('All');
  const [search, setSearch]             = useState('');
  const [sheetOpen, setSheetOpen]       = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [copiedId, setCopiedId]         = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const anchor = settings.cycleAnchorDate || null;
  const suggested = anchor ? suggestForToday(notices, anchor) : [];
  const suggestedIds = new Set(suggested.map(n => n.id));

  const filtered = notices
    .filter(n => !suggestedIds.has(n.id)) // suggested ones get their own section above, not duplicated
    .filter(n => filterCat === 'All' || n.category === filterCat)
    .filter(n => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return n.title.toLowerCase().includes(q)
        || n.body.toLowerCase().includes(q)
        || (n.tags||[]).some(t => t.toLowerCase().includes(q));
    });

  function copyAndMark(notice) {
    navigator.clipboard.writeText('```\n' + notice.body + '\n```').then(() => {
      onSaveNotice(markPostedToday(notice));
      setCopiedId(notice.id);
      setTimeout(() => setCopiedId(null), 2000);
      vibe(8);
    });
  }

  function renderCard(n, highlighted) {
    return (
      <div key={n.id} style={{ background:highlighted?C.gold+'14':C.card, border:`1px solid ${highlighted?C.gold+'66':C.border}`, borderRadius:12, padding:14, marginBottom:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8, gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
              <span style={{ fontSize:11, fontWeight:700, color:C.muted, padding:'1px 7px', borderRadius:8, background:C.section }}>{CATEGORY_ICONS[n.category]} {n.category}</span>
              {highlighted && <span style={{ fontSize:11, fontWeight:700, color:C.gold }}>✨ Suggested</span>}
            </div>
            <div style={{ fontSize:15, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis' }}>{n.title}</div>
          </div>
          <div style={{ display:'flex', gap:10, flexShrink:0 }}>
            <button onClick={() => { setEditingNotice(n); setSheetOpen(true); }} style={{ background:'none', border:'none', color:C.muted, fontSize:15, cursor:'pointer', padding:0 }}>✏️</button>
            <button onClick={() => setDeleteConfirmId(n.id)} style={{ background:'none', border:'none', color:C.red+'88', fontSize:15, cursor:'pointer', padding:0 }}>✕</button>
          </div>
        </div>
        <div style={{ fontSize:13, color:C.icy, whiteSpace:'pre-wrap', marginBottom:10, maxHeight:90, overflow:'hidden', lineHeight:1.5 }}>{n.body}</div>
        {n.postedDates?.length > 0 && (
          <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Posted {n.postedDates.length}× · last {n.postedDates[n.postedDates.length-1]}</div>
        )}
        <button onClick={() => copyAndMark(n)}
          style={{ width:'100%', height:40, borderRadius:10, background:copiedId===n.id?C.green+'18':C.gold+'18', border:`1px solid ${copiedId===n.id?C.green:C.gold}44`, color:copiedId===n.id?C.green:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
          {copiedId===n.id ? '✓ Copied & logged' : '📋 Copy & mark posted'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ height:'100vh', fontFamily:'system-ui,-apple-system,sans-serif', color:C.white, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, background:C.bg, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', padding:0 }}>← Back</button>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:C.white }}>📋 Notice Library</div>
            <div style={{ fontSize:12, color:C.muted }}>
              {notices.length} saved · {anchor ? `Cycle day ${todayCycleDay(anchor)}/28 today` : 'Set a cycle date in Settings to enable suggestions'}
            </div>
          </div>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, message, tags…"
          style={{ width:'100%', height:40, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 14px', fontSize:14, color:C.white, boxSizing:'border-box', fontFamily:'inherit', marginBottom:10 }} />
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
          {['All', ...NOTICE_CATEGORIES].map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              style={{ padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap', background:filterCat===c?C.gold+'22':C.section, border:`1px solid ${filterCat===c?C.gold:C.border}`, color:filterCat===c?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', flexShrink:0, minHeight:36 }}>
              {c==='All' ? c : `${CATEGORY_ICONS[c]} ${c}`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', paddingBottom:100 }}>
        {!anchor && (
          <div style={{ background:C.gold+'14', border:`1px solid ${C.gold}55`, borderRadius:12, padding:'12px 14px', marginBottom:16, fontSize:13, color:C.white }}>
            ⚠ No cycle start date set — "Suggested for Today" needs one to know where you are in the 4-week schedule. Set it in Settings.
          </div>
        )}
        {anchor && suggested.length === 0 && notices.length > 0 && (
          <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>
            No suggestions yet — needs at least 2 cycles of "Copy &amp; mark posted" on a notice before a real pattern emerges.
          </div>
        )}

        {suggested.length > 0 && (
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.gold, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>✨ Suggested for Today</div>
            {suggested.filter(n => filterCat==='All' || n.category===filterCat).map(n => renderCard(n, true))}
          </div>
        )}

        <button onClick={() => { setEditingNotice(null); setSheetOpen(true); }}
          style={{ width:'100%', height:48, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer', marginBottom:16 }}>
          ＋ New Notice
        </button>

        {notices.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:15, fontWeight:700, color:C.white }}>No notices yet</div>
            <div style={{ fontSize:13, color:C.muted, marginTop:6 }}>Save your recurring alliance notices, to-do lists, and info messages here.</div>
          </div>
        )}
        {filtered.map(n => renderCard(n, false))}
      </div>

      <NoticeSheet
        notice={editingNotice}
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditingNotice(null); }}
        onSave={onSaveNotice}
      />

      {deleteConfirmId && (
        <div onClick={() => setDeleteConfirmId(null)} style={{ position:'fixed', inset:0, background:'#000c', zIndex:950, display:'flex', alignItems:'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'20px 20px 28px' }}>
            <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:16 }}>Delete this notice?</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ flex:1, height:50, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:15, cursor:'pointer' }}>Cancel</button>
              <button onClick={() => { onDeleteNotice(deleteConfirmId); setDeleteConfirmId(null); }} style={{ flex:1, height:50, borderRadius:12, background:C.red, color:'#fff', fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
