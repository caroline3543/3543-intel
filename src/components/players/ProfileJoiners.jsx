import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { ProfileSection } from './ProfileParts.jsx';
export function ProfileJoiners({player,onSave}){
  const [addingHero,setAddingHero]=useState(false);
  const [heroName,setHeroName]=useState('');
  const [heroSkill,setHeroSkill]=useState(5);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  async function persist(next){
    if(saving)return false;
    setSaving(true);setSaveError('');
    try{
      const result=await onSave(next);
      if(result?.persisted===true)return true;
      setSaveError(result?.reason||'Cloud save not confirmed. The change may be stored only on this device.');
      return false;
    }catch(error){setSaveError(error?.message||'Cloud save not confirmed');return false;}
    finally{setSaving(false);}
  }
  const joiners=player.joinerHeroes||[];
  // Typing a name that already exists (case-insensitive) replaces that
  // entry's skill level rather than creating a duplicate.
  async function addHero() {
    const name = heroName.trim();
    if (!name) return;
    const existing = joiners.filter(jh => jh.hero.toLowerCase() !== name.toLowerCase());
    const saved=await persist({ ...player, joinerHeroes: [...existing, { hero: name, skillLevel: heroSkill, verified: true, verificationSource: 'manual', updatedAt: new Date().toISOString() }] });
    if(saved){setHeroName(''); setHeroSkill(5); setAddingHero(false);}
  }

  async function removeHero(hero) {
    await persist({ ...player, joinerHeroes: joiners.filter(jh => jh.hero !== hero) });
  }


return (        <ProfileSection title="Joiner heroes">{saveError&&<p role="alert" style={{color:C.red,fontSize:13}}>{saveError}</p>}<p style={{fontSize:14,color:C.icy,margin:"0 0 12px"}}>Record the top-right expedition skill. Only Skill 5 counts towards joiner coverage.</p>
          {joiners.length>0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              {joiners.map(jh=>(
                <span key={jh.hero} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 12px 8px 16px', borderRadius:20, background:C.gold+'18', border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:600, fontSize:14 }}>
                  {jh.hero}{jh.stars!=null?` · ${jh.stars}★`:''}{jh.skillLevel==null?' · Skill not recorded':''}{jh.skillLevel!=null?` · Skill ${jh.skillLevel}`:''}{jh.verified?' · Confirmed':' · Needs review'}
                  <button disabled={saving} onClick={() => removeHero(jh.hero)} aria-label={`Remove ${jh.hero}`}
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
                <button disabled={saving} onClick={() => { setAddingHero(false); setHeroName(''); }}
                  style={{ flex:1, height:44, borderRadius:10, background:'none', border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>Cancel</button>
                <button onClick={addHero} disabled={saving||!heroName.trim()}
                  style={{ flex:2, height:44, borderRadius:10, background:heroName.trim()?C.gold:C.section, border:'none', color:heroName.trim()?C.bg:C.muted, fontWeight:700, fontSize:14, cursor:heroName.trim()?'pointer':'default' }}>{saving?'Saving…':'Save hero'}</button>
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
