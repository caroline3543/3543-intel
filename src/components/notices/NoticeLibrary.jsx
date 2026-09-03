import { useState, useEffect } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { uid } from '../../utils/dates.js';
import { newNotice, NOTICE_CATEGORIES, NOTICE_CHAR_LIMIT, NOTICE_CHAR_LIMIT_CATEGORY } from '../../data/noticeSchema.js';
import { suggestForToday, markPostedToday, toggleCheckedToday, postedToday, todayCycleDay } from '../../services/noticeCycleService.js';
import { Field, Inp, SheetHandle } from '../common/Primitives.jsx';
import { AsciiArtPickerSheet } from '../ascii/AsciiArtLibrary.jsx';

const CATEGORY_ICONS = { Notice: '📢', 'To-Do': '✅', Info: 'ℹ️' };

// "Checked" means different things per category (see the answer this
// was built from): a To-Do's completed flag is sticky until unchecked;
// a Notice/Info's checked state is just "posted today", so it quietly
// resets itself tomorrow with nothing to clean up.
function isChecked(notice) {
  return notice.category === 'To-Do' ? !!notice.completed : postedToday(notice);
}

// ── Add/Edit sheet ─────────────────────────────────────────────
function NoticeSheet({ notice, allNotices, asciiArts, open, onClose, onSave }) {
  const [n, setN] = useState(() => notice || newNotice());
  const [pickerSide, setPickerSide] = useState(null); // 'top' | 'bottom' | null

  useEffect(() => {
    if (open) setN(notice ? { ...notice } : newNotice());
  }, [open, notice?.id]);

  function upd(k, v) { setN(prev => ({ ...prev, [k]: v, updatedAt: new Date().toISOString() })); }
  const canSave = n.title.trim() && n.body.trim();
  const isNoticeCategory = n.category === NOTICE_CHAR_LIMIT_CATEGORY;
  const overLimit = isNoticeCategory && n.body.length > NOTICE_CHAR_LIMIT;

  function insertArt(art) {
    setN(prev => {
      const sep = prev.body ? '\n\n' : '';
      const body = pickerSide === 'top' ? `${art}${sep}${prev.body}` : `${prev.body}${sep}${art}`;
      return { ...prev, body, updatedAt: new Date().toISOString() };
    });
  }

  // Every notice sharing this one's linkedGroupId — the rest of the
  // topic's parts.
  const linkedParts = n.linkedGroupId ? allNotices.filter(o => o.linkedGroupId === n.linkedGroupId && o.id !== n.id) : [];

  // Manual linking only — the officer writes each part themselves,
  // this just stamps a shared linkedGroupId and hands off a fresh part
  // to fill in. If this notice isn't linked yet, saving it first is
  // required so "Part 1" actually exists as a real record before
  // "Part 2" gets created pointing at it.
  function addLinkedPart() {
    const groupId = n.linkedGroupId || uid();
    if (!n.linkedGroupId) {
      const stamped = { ...n, linkedGroupId: groupId, linkedPartLabel: n.linkedPartLabel || 'Part 1' };
      setN(stamped);
      onSave(stamped);
    }
    const partNum = linkedParts.length + 2; // +1 for this part, +1 for the new one
    onSave(newNotice({ title: n.title, category: n.category, linkedGroupId: groupId, linkedPartLabel: `Part ${partNum}` }));
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:900, display:'flex', alignItems:'flex-end' }}>
        <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'92vh', overflowY:'auto', padding:'16px 20px 40px' }}>
          <SheetHandle />
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{notice ? 'Edit' : 'New'}{n.linkedPartLabel ? ` — ${n.linkedPartLabel}` : ''}</div>
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
          <Field label="Message" hint={isNoticeCategory ? `Exactly what gets copied — alliance notices cap at ${NOTICE_CHAR_LIMIT} characters in-game` : 'Exactly what gets copied as a code block'}>
            <textarea value={n.body} onChange={e => upd('body', e.target.value)} placeholder="Type the message…"
              style={{ width:'100%', minHeight:140, background:C.section, border:`1px solid ${overLimit?C.red:C.border}`, borderRadius:10, padding:'12px 14px', fontSize:15, color:C.white, resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }} />
            {isNoticeCategory && (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
                <span style={{ fontSize:11, color:overLimit?C.red:C.muted, fontWeight:overLimit?700:400 }}>
                  {n.body.length} / {NOTICE_CHAR_LIMIT}{overLimit ? ' — over the in-game limit' : ''}
                </span>
                {overLimit && (
                  <button onClick={addLinkedPart} style={{ fontSize:11, color:C.gold, background:'none', border:'none', cursor:'pointer', textDecoration:'underline', padding:0 }}>
                    Split into another part →
                  </button>
                )}
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button onClick={() => setPickerSide('top')} style={{ flex:1, height:36, borderRadius:8, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontSize:12, fontWeight:600, cursor:'pointer' }}>➕ Art at top</button>
              <button onClick={() => setPickerSide('bottom')} style={{ flex:1, height:36, borderRadius:8, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontSize:12, fontWeight:600, cursor:'pointer' }}>➕ Art at bottom</button>
            </div>
          </Field>
          <Field label="Tags" hint="Comma separated — used for search, not for suggestions">
            <Inp value={(n.tags||[]).join(', ')} onChange={v => upd('tags', v.split(',').map(s=>s.trim()).filter(Boolean))} placeholder="e.g. SvS, Foundry" />
          </Field>

          {linkedParts.length > 0 && (
            <div style={{ background:C.section, borderRadius:10, padding:12, marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', marginBottom:8 }}>Linked parts</div>
              <div style={{ fontSize:13, color:C.icy, padding:'4px 0' }}>{n.linkedPartLabel || 'Part 1'} (this one)</div>
              {linkedParts.map(p => (
                <div key={p.id} style={{ fontSize:13, color:C.icy, padding:'4px 0' }}>{p.linkedPartLabel || 'Part'} — {p.title}</div>
              ))}
            </div>
          )}
          {!n.linkedGroupId && n.body.length > 0 && (
            <button onClick={addLinkedPart} style={{ width:'100%', height:40, borderRadius:10, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', marginBottom:16 }}>
              🔗 Link another part to this topic
            </button>
          )}

          {n.postedDates?.length > 0 && (
            <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>
              Posted {n.postedDates.length}× · most recently {n.postedDates[n.postedDates.length-1]}
            </div>
          )}
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:15, cursor:'pointer' }}>Cancel</button>
            <button onClick={() => { onSave(n); onClose(); vibe(8); }} disabled={!canSave}
              style={{ flex:2, height:52, borderRadius:12, background:canSave?C.gold:C.section, color:canSave?C.bg:C.muted, fontWeight:700, fontSize:16, border:'none', cursor:canSave?'pointer':'default' }}>
              Save
            </button>
          </div>
        </div>
      </div>
      <AsciiArtPickerSheet asciiArts={asciiArts} open={!!pickerSide} onClose={() => setPickerSide(null)} onPick={insertArt} />
    </>
  );
}

// ── NoticeLibrary (main export) ───────────────────────────────
// Props:
//   notices        – array of notice objects (see noticeSchema.js)
//   settings       – alliance settings; reads settings.cycleAnchorDate
//   asciiArts      – for the art-insert picker in the composer
//   onSaveNotice   – (notice) => void — create or update
//   onDeleteNotice – (id) => void
//   onClose        – () => void
export default function NoticeLibrary({ notices = [], settings = {}, asciiArts = [], onSaveNotice, onDeleteNotice, onClose }) {
  const [filterCat, setFilterCat]       = useState('Notice');
  const [search, setSearch]             = useState('');
  const [sheetOpen, setSheetOpen]       = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [copiedId, setCopiedId]         = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [quickAddText, setQuickAddText] = useState('');

  const anchor = settings.cycleAnchorDate || null;
  const suggested = anchor ? suggestForToday(notices, anchor) : [];
  const suggestedIds = new Set(suggested.map(n => n.id));

  const categoryNotices = notices.filter(n => filterCat === 'All' || n.category === filterCat);
  const filtered = categoryNotices
    .filter(n => !suggestedIds.has(n.id))
    .filter(n => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || (n.tags||[]).some(t => t.toLowerCase().includes(q));
    });

  // Clusters notices sharing a linkedGroupId into one unit for display
  // — a standalone notice is just a group of one. A group only counts
  // as "checked" once every part in it is.
  function clusterGroups(list) {
    const seen = new Set();
    const groups = [];
    list.forEach(n => {
      if (seen.has(n.id)) return;
      if (n.linkedGroupId) {
        const parts = list.filter(o => o.linkedGroupId === n.linkedGroupId)
          .sort((a, b) => (a.linkedPartLabel||'').localeCompare(b.linkedPartLabel||''));
        parts.forEach(p => seen.add(p.id));
        groups.push(parts);
      } else {
        seen.add(n.id);
        groups.push([n]);
      }
    });
    return groups;
  }

  const groups = clusterGroups(filtered);
  const activeGroups = groups.filter(g => !g.every(isChecked));
  const checkedGroups = groups.filter(g => g.every(isChecked));

  function toggleCheck(notice) {
    if (notice.category === 'To-Do') {
      onSaveNotice({ ...notice, completed: !notice.completed, updatedAt: new Date().toISOString() });
    } else {
      onSaveNotice(toggleCheckedToday(notice));
    }
    vibe(8);
  }

  function copyGroup(group) {
    const text = group.length === 1
      ? group[0].body
      : group.map(p => `${p.linkedPartLabel || ''}\n${p.body}`).join('\n\n');
    navigator.clipboard.writeText('```\n' + text + '\n```').then(() => {
      group.forEach(p => onSaveNotice(markPostedToday(p)));
      setCopiedId(group[0].id);
      setTimeout(() => setCopiedId(null), 2000);
      vibe(8);
    });
  }

  function submitQuickAdd() {
    const title = quickAddText.trim();
    if (!title) return;
    onSaveNotice(newNotice({ title, category: filterCat === 'All' ? 'Notice' : filterCat }));
    setQuickAddText('');
    vibe(8);
  }

  function renderGroupCard(group, isSuggested) {
    const primary = group[0];
    const checked = group.every(isChecked);
    const isLinked = group.length > 1;
    return (
      <div key={primary.id} style={{ background:isSuggested?C.gold+'14':C.card, border:`1px solid ${isSuggested?C.gold+'66':C.border}`, borderRadius:12, padding:14, marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
          <button onClick={() => group.forEach(toggleCheck)}
            style={{ width:26, height:26, borderRadius:'50%', border:`2px solid ${checked?C.green:C.border}`, background:checked?C.green:'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', marginTop:2 }}>
            {checked && <span style={{ fontSize:13, color:C.bg, fontWeight:700 }}>✓</span>}
          </button>
          <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={() => { setEditingNotice(primary); setSheetOpen(true); }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
              <span style={{ fontSize:11, fontWeight:700, color:C.muted, padding:'1px 7px', borderRadius:8, background:C.section }}>{CATEGORY_ICONS[primary.category]} {primary.category}</span>
              {isSuggested && <span style={{ fontSize:11, fontWeight:700, color:C.gold }}>✨ Suggested</span>}
              {isLinked && <span style={{ fontSize:11, fontWeight:700, color:C.icy }}>🔗 {group.length} parts</span>}
            </div>
            <div style={{ fontSize:15, fontWeight:700, color:checked?C.muted:C.white, textDecoration:checked?'line-through':'none' }}>{primary.title}</div>
            {primary.body && (
              <div style={{ fontSize:13, color:C.icy, whiteSpace:'pre-wrap', marginTop:4, maxHeight:60, overflow:'hidden', lineHeight:1.5 }}>{primary.body}</div>
            )}
            {primary.postedDates?.length > 0 && (
              <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>Posted {primary.postedDates.length}× · last {primary.postedDates[primary.postedDates.length-1]}</div>
            )}
          </div>
          <button onClick={() => setDeleteConfirmId(primary.id)} style={{ background:'none', border:'none', color:C.red+'88', fontSize:15, cursor:'pointer', padding:0, flexShrink:0 }}>✕</button>
        </div>
        {primary.body && (
          <button onClick={() => copyGroup(group)}
            style={{ width:'100%', height:36, borderRadius:10, marginTop:10, background:copiedId===primary.id?C.green+'18':C.gold+'18', border:`1px solid ${copiedId===primary.id?C.green:C.gold}44`, color:copiedId===primary.id?C.green:C.gold, fontWeight:700, fontSize:12, cursor:'pointer' }}>
            {copiedId===primary.id ? '✓ Copied & logged' : isLinked ? `📋 Copy all ${group.length} parts` : '📋 Copy'}
          </button>
        )}
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
              {anchor ? `Cycle day ${todayCycleDay(anchor)}/28 today` : 'Set a cycle date in Settings to enable suggestions'}
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
            ⚠ No cycle start date set — "Suggested for Today" needs one. Set it in Settings.
          </div>
        )}

        {suggested.length > 0 && (
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.gold, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>✨ Suggested for Today</div>
            {clusterGroups(suggested.filter(n => filterCat==='All' || n.category===filterCat)).map(g => renderGroupCard(g, true))}
          </div>
        )}

        {/* Reminders-style inline quick add — type a title, Enter to
            capture it instantly; open the row afterward to fill in the
            body, tags, or anything else. */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <span style={{ fontSize:20, color:C.gold, flexShrink:0 }}>＋</span>
          <input
            value={quickAddText}
            onChange={e => setQuickAddText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitQuickAdd(); }}
            placeholder={`New ${filterCat==='All' ? 'Notice' : filterCat}…`}
            style={{ flex:1, height:36, background:'none', border:'none', borderBottom:`1px solid ${C.border}`, color:C.white, fontSize:14, fontFamily:'inherit', padding:'0 0 6px', outline:'none' }}
          />
        </div>

        {notices.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:15, fontWeight:700, color:C.white }}>No notices yet</div>
            <div style={{ fontSize:13, color:C.muted, marginTop:6 }}>Type above to add your first one.</div>
          </div>
        )}

        {activeGroups.map(g => renderGroupCard(g, false))}

        {checkedGroups.length > 0 && (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginTop:16, marginBottom:8 }}>
              ✓ {filterCat==='To-Do' ? 'Completed' : 'Checked'} · {checkedGroups.length}
            </div>
            {checkedGroups.map(g => renderGroupCard(g, false))}
          </>
        )}
      </div>

      <NoticeSheet
        notice={editingNotice}
        allNotices={notices}
        asciiArts={asciiArts}
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
