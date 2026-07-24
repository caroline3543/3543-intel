import { useState, useEffect } from 'react';
import { C } from '../utils/constants.js';

export function LandingPage({ onGetStarted, onImport, hasData }) {
  const [animIn, setAnimIn] = useState(false);
  useEffect(() => { setTimeout(() => setAnimIn(true), 50); }, []);

  const features = [
    ['👥', 'Manage your alliance roster'],
    ['⚔️', 'Plan rally and battle assignments'],
    ['⏱️', 'Run live rally countdown timers'],
    ['✅', 'Track event attendance'],
    ['📊', 'Check joiner hero coverage'],
  ];

  const fade = (delay = 0) => ({
    opacity: animIn ? 1 : 0,
    transform: animIn ? 'translateY(0)' : 'translateY(10px)',
    transition: `all 600ms ease ${delay}ms`,
  });

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 24px', fontFamily:'system-ui,-apple-system,sans-serif', textAlign:'center' }}>
      <div style={{ fontSize:72, marginBottom:20, ...fade() }}>🏰</div>

      <div style={{ fontSize:28, fontWeight:800, color:C.white, marginBottom:8, lineHeight:1.2, ...fade(100) }}>
        Alliance Manager
      </div>
      <div style={{ fontSize:16, color:C.muted, marginBottom:32, lineHeight:1.6, maxWidth:320, ...fade(150) }}>
        Build your alliance roster, assign rally teams, and coordinate your SvS battles.
      </div>

      <div style={{ background:C.section, borderRadius:16, padding:'20px 24px', marginBottom:36, width:'100%', maxWidth:360, textAlign:'left', ...fade(200) }}>
        {features.map(([icon, text]) => (
          <div key={text} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:`1px solid ${C.border}22` }}>
            <span style={{ fontSize:20, width:28, textAlign:'center' }}>{icon}</span>
            <span style={{ fontSize:14, color:C.icy }}>{text}</span>
          </div>
        ))}
      </div>

      <div style={{ width:'100%', maxWidth:360, ...fade(250) }}>
        <button onClick={onGetStarted} style={{ width:'100%', height:56, borderRadius:14, background:C.gold, color:C.bg, fontWeight:800, fontSize:18, border:'none', cursor:'pointer', marginBottom:12 }}>
          {hasData ? 'Open App →' : 'Get Started →'}
        </button>
        <button onClick={onImport} style={{ width:'100%', height:52, borderRadius:14, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>
          ⬆️ Import Data
        </button>
      </div>
    </div>
  );
}
