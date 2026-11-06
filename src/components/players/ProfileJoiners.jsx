import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { ProfileSection } from './ProfileParts.jsx';
export function ProfileJoiners({player,onSave}){
  const [addingHero,setAddingHero]=useState(false);
  const [heroName,setHeroName]=useState('');
  const [heroSkill,setHeroSkill]=useState(5);
  const joiners=player.joinerHeroes||[];
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


return (        <ProfileSection title="Joiner heroes"><p style={{fontSize:14,color:C.icy,margin:"0 0 12px"}}>Record the top-right expedition skill. Only Skill 5 counts towards joiner coverage.</p>
          {joiners.length>0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              {joiners.map(jh=>(
                <span key={jh.hero} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 12px 8px 16px', borderRadius:20, background:C.gold+'18', border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:600, fontSize:14 }}>
                  {jh.hero}{jh.skillLevel!=null?` · Skill ${jh.skillLevel}`:''}{jh.verified?' · Verified':' · Unverified'}
                  <button onClick={() => removeHero(jh.hero)} aria-label={`Remove ${jh.hero}`}
                    style={{ width:44, height:44, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'none', color:C.gold+'99', fontSize:13, cursor:'pointer', padding:0 }}>✕</button>
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
                placeholder="Hero name"
                aria-label="Hero name"
                autoFocus
                style={{ width:'100%', height:44, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit', marginBottom:10 }}
              />
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                <span style={{ fontSize:14, color:C.icy }}>Skill</span>
                {[1,2,3,4,5].map(n => (
                  <button key={n} aria-label={`Skill ${n}`} aria-pressed={heroSkill===n} onClick={() => setHeroSkill(n)}
                    style={{ width:44, height:44, borderRadius:'50%', border:`1px solid ${heroSkill===n?C.gold:C.border}`, background:heroSkill===n?C.gold+'22':C.section, color:heroSkill===n?C.gold:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => { setAddingHero(false); setHeroName(''); }}
                  style={{ flex:1, height:44, borderRadius:10, background:'none', border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>Cancel</button>
                <button onClick={addHero} disabled={!heroName.trim()}
                  style={{ flex:2, height:44, borderRadius:10, background:heroName.trim()?C.gold:C.section, border:'none', color:heroName.trim()?C.bg:C.muted, fontWeight:700, fontSize:14, cursor:heroName.trim()?'pointer':'default' }}>Save hero</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingHero(true)}
              style={{ width:'100%', height:44, borderRadius:10, background:'none', border:`1px dashed ${C.border}`, color:C.icy, fontWeight:600, fontSize:14, cursor:'pointer' }}>
              Add hero
            </button>
          )}
        </ProfileSection>

);
}
