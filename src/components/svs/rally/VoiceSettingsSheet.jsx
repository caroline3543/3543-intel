import { useState, useEffect } from 'react';
import { C } from '../../../utils/constants.js';
import { DEFAULT_CUES } from './useVoiceCountdown.js';

// ── VoiceSettingsSheet ─────────────────────────────────────────
// Bottom sheet for configuring voice countdown settings.
// Props:
//   open      – boolean
//   onClose   – () => void
//   voiceOn   – boolean
//   cues      – VoiceCues object
//   onChange  – ({ voiceOn, cues }) => void
export function VoiceSettingsSheet({ open, onClose, voiceOn, cues, onChange }) {
  const [draft, setDraft] = useState({ voiceOn, cues: { ...cues } });

  useEffect(() => {
    if (open) setDraft({ voiceOn, cues: { ...cues } });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  function updCue(key, val) {
    setDraft(prev => ({ ...prev, cues: { ...prev.cues, [key]: val } }));
  }
  function toggleVoice() {
    setDraft(prev => ({ ...prev, voiceOn: !prev.voiceOn }));
  }
  function save() {
    onChange(draft);
    onClose();
  }
  function reset() {
    setDraft(prev => ({ ...prev, cues: { ...DEFAULT_CUES } }));
  }
  function preview(text) {
    if (!window.speechSynthesis || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text.trim());
    utt.rate = 1.1; utt.lang = 'en-US';
    window.speechSynthesis.speak(utt);
  }

  const CUE_LABELS = [
    { key:'s30',    label:'30 seconds warning' },
    { key:'s20',    label:'20 seconds warning' },
    { key:'s10',    label:'10 seconds warning' },
    { key:'c5',     label:'Countdown — 5' },
    { key:'c4',     label:'Countdown — 4' },
    { key:'c3',     label:'Countdown — 3' },
    { key:'c2',     label:'Countdown — 2' },
    { key:'c1',     label:'Countdown — 1' },
    { key:'launch', label:'Launch / Open Rally' },
  ];

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:600, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'88vh', overflowY:'auto', padding:'16px 20px 80px', boxSizing:'border-box' }}>

        {/* Handle */}
        <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:'0 auto 18px' }}/>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:C.white }}>🔊 Voice Countdown</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>Announces cues as the rally open time approaches</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>

        {/* Mute toggle */}
        <div onClick={toggleVoice} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:draft.voiceOn ? C.gold+'18' : C.section, border:`1px solid ${draft.voiceOn ? C.gold : C.border}`, borderRadius:14, padding:'14px 18px', marginBottom:20, cursor:'pointer', WebkitTapHighlightColor:'transparent' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:draft.voiceOn ? C.gold : C.muted }}>
              {draft.voiceOn ? '🔊 Voice on' : '🔇 Voice off'}
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
              {draft.voiceOn ? 'Tap to mute during battle' : 'Tap to enable voice cues'}
            </div>
          </div>
          {/* Toggle pill */}
          <div style={{ width:48, height:28, borderRadius:14, background:draft.voiceOn ? C.gold : C.border, position:'relative', transition:'background 200ms', flexShrink:0 }}>
            <div style={{ position:'absolute', top:3, left:draft.voiceOn ? 23 : 3, width:22, height:22, borderRadius:'50%', background:'#fff', transition:'left 200ms', boxShadow:'0 1px 4px #0004' }}/>
          </div>
        </div>

        {/* Browser support warning */}
        {!window.speechSynthesis && (
          <div style={{ background:C.red+'18', border:`1px solid ${C.red}44`, borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:C.red }}>
            ⚠ This browser doesn't support voice synthesis. Try Chrome or Safari.
          </div>
        )}

        {/* Cue editor */}
        {draft.voiceOn && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.icy }}>Announcement text</div>
              <button onClick={reset} style={{ fontSize:12, color:C.muted, background:'none', border:'none', cursor:'pointer', padding:0 }}>Reset to defaults</button>
            </div>

            {CUE_LABELS.map(({ key, label }) => (
              <div key={key} style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>{label}</div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input
                    value={draft.cues[key] || ''}
                    onChange={e => updCue(key, e.target.value)}
                    placeholder={`Leave blank to skip`}
                    style={{ flex:1, background:C.section, border:`1px solid ${C.border}`, borderRadius:8, padding:'9px 12px', fontSize:14, color:C.white, fontFamily:'inherit', boxSizing:'border-box' }}
                  />
                  <button
                    onClick={() => preview(draft.cues[key] || '')}
                    disabled={!draft.cues[key]?.trim()}
                    style={{ height:38, width:38, borderRadius:8, background:C.section, border:`1px solid ${C.border}`, color:draft.cues[key]?.trim() ? C.gold : C.muted, fontSize:16, cursor:draft.cues[key]?.trim() ? 'pointer' : 'default', flexShrink:0 }}>
                    ▶
                  </button>
                </div>
              </div>
            ))}

            <div style={{ background:C.section, borderRadius:10, padding:'10px 14px', marginTop:8, marginBottom:4 }}>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
                Cues fire on the <span style={{ color:C.gold }}>open-rally countdown</span> — the timer counting down to when the leader opens the rally. Leave a field blank to skip that cue entirely.
              </div>
            </div>
          </div>
        )}

        {/* Save */}
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={save} style={{ flex:2, height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:16, border:'none', cursor:'pointer' }}>Save</button>
        </div>
      </div>
    </div>
  );
}
