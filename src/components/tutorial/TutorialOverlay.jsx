import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { TUTORIAL_STEPS } from '../../tutorial/TutorialRegistry.js';
import { vibe } from '../../utils/vibe.js';

export function TutorialOverlay({ mode, onFinish, onSkip }) {
  const steps = TUTORIAL_STEPS[mode] || TUTORIAL_STEPS.beginner;
  const [idx, setIdx] = useState(0);
  const step = steps[idx];
  if (!step) return null;

  const progress = idx + 1;
  const total = steps.length;

  return (
    <div style={{ position:'fixed', inset:0, background:'#000000cc', zIndex:900, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'0 0 80px' }}>
      <div style={{ position:'absolute', inset:0 }} onClick={onSkip} />
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:C.card, borderRadius:20, padding:24, margin:'0 16px', width:'100%', maxWidth:440, position:'relative', boxShadow:'0 20px 60px #000a' }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.1em' }}>
            {mode === 'beginner' ? 'Beginner' : mode === 'advanced' ? 'Advanced' : "What's New"} · Step {progress} of {total}
          </div>
          <button onClick={onSkip} style={{ background:'none', border:'none', color:C.muted, fontSize:13, cursor:'pointer', padding:0 }}>Skip</button>
        </div>

        <div style={{ height:3, borderRadius:2, background:C.border, marginBottom:20, overflow:'hidden' }}>
          <div style={{ width:`${(progress/total)*100}%`, height:'100%', background:C.gold, borderRadius:2, transition:'width 300ms ease' }} />
        </div>

        <div style={{ fontSize:20, fontWeight:700, color:C.white, marginBottom:10 }}>{step.title}</div>
        <div style={{ fontSize:15, color:C.icy, lineHeight:1.6, marginBottom: step.why ? 16 : 0 }}>{step.body}</div>

        {step.why && (
          <div style={{ background:C.section, borderRadius:10, padding:12, marginBottom:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.gold, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Why it matters</div>
            <div style={{ fontSize:13, color:C.icy, lineHeight:1.5 }}>{step.why}</div>
          </div>
        )}
        {step.how && (
          <div style={{ background:C.section, borderRadius:10, padding:12, marginBottom:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.green, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>How to use it</div>
            <div style={{ fontSize:13, color:C.icy, lineHeight:1.5 }}>{step.how}</div>
          </div>
        )}
        {step.when && (
          <div style={{ background:C.section, borderRadius:10, padding:12, marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.icy, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>When to use</div>
            <div style={{ fontSize:13, color:C.icy, lineHeight:1.5 }}>{step.when}</div>
          </div>
        )}

        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          {idx > 0 && (
            <button
              onClick={() => setIdx(i => i-1)}
              style={{ flex:1, height:48, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:15, cursor:'pointer' }}
            >← Back</button>
          )}
          {idx < steps.length - 1 ? (
            <button
              onClick={() => { setIdx(i => i+1); vibe(8); }}
              style={{ flex:2, height:48, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}
            >Next →</button>
          ) : (
            <button
              onClick={onFinish}
              style={{ flex:2, height:48, borderRadius:12, background:C.green, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}
            >Finish ✓</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TutorialModePicker({ onSelect, onClose }) {
  const modes = [
    { mode:'beginner',  icon:'🎓', title:'Beginner Officer Guide',    sub:`${TUTORIAL_STEPS.beginner.length} steps — full introduction`,         color:C.green },
    { mode:'advanced',  icon:'⚔️', title:'Advanced Battle Planning', sub:`${TUTORIAL_STEPS.advanced.length} steps — timing and synchronization`, color:C.gold  },
    { mode:'discovery', icon:'🆕', title:"What's New",               sub:`${TUTORIAL_STEPS.discovery.length} steps — recently added features`,   color:C.icy   },
  ];
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:800, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'24px 20px 60px' }}>
        <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:'0 auto 24px' }} />
        <div style={{ fontSize:20, fontWeight:700, color:C.white, marginBottom:6 }}>Choose Tutorial Mode</div>
        <div style={{ fontSize:14, color:C.muted, marginBottom:24 }}>Pick the right level for your experience</div>
        {modes.map(({ mode, icon, title, sub, color }) => (
          <button
            key={mode}
            onClick={() => onSelect(mode)}
            style={{ display:'flex', alignItems:'center', gap:14, width:'100%', background:C.section, borderRadius:14, padding:'16px 18px', marginBottom:10, border:`1px solid ${color}33`, cursor:'pointer', textAlign:'left' }}
          >
            <span style={{ fontSize:28 }}>{icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:16, fontWeight:700, color:C.white }}>{title}</div>
              <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>{sub}</div>
            </div>
            <span style={{ fontSize:20, color }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
