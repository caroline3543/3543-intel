import { useState } from 'react';
import { newSnapshot } from '../../data/playerSchema.js';
import { C } from '../../utils/constants.js';
import { talConfig, suggestTalTeams, assignTalBuildings, teamWarnings, strength, moveTalMember } from '../../services/talPlanner.js';
const box = { background:C.section, border:`1px solid ${C.border}`, borderRadius:14, padding:16, marginBottom:12 };
const button = { minHeight:44, borderRadius:10, border:`1px solid ${C.border}`, background:C.card, color:C.icy, padding:'8px 12px', fontSize:16, cursor:'pointer' };
const input = { ...button, width:'100%', boxSizing:'border-box', background:C.bg };
export function TalPlanner({ event, players, onUpdate }) {
  const config = talConfig(event);
  const steps = ['Availability','Legions','Buildings','Review'];
  const step = config.step || 'Availability';
  const go = next => { setMessage(''); setExportText(''); setMovePlayer(null); onUpdate({...event,tal:{...config,step:next}}); window.scrollTo({top:0,behavior:'smooth'}); };
  const [movePlayer,setMovePlayer] = useState(null);
  const [moveTarget,setMoveTarget] = useState('');
  const [query,setQuery] = useState('');
  const [message,setMessage] = useState('');
  const [armed,setArmed] = useState(false);
  const [clearArmed,setClearArmed] = useState(false);
  const [slotDraft,setSlotDraft] = useState(config.slots.join(', '));
  const save = patch => { if (!config.locked) onUpdate({ ...event, tal:{ ...config, ...patch } }); };
  const updateTeam = (id,patch) => save({ teams:config.teams.map(t => t.id===id?{...t,...patch}:t) });
  const name = id => players.find(p => p.id===id)?.username || players.find(p => p.id===id)?.alias || id;
  const selected = new Set(config.teams.flatMap(t => t.members.map(m => m.id)));
  const candidates = players.filter(p => `${p.username} ${p.alias} ${p.id} ${p.allianceTag}`.toLowerCase().includes(query.toLowerCase()));
  async function copy(text) { try { await navigator.clipboard.writeText(text); setMessage('Copied.'); } catch { setMessage('Copy unavailable. Select the text below to copy it.'); } }
  const [exportText,setExportText] = useState('');
  function exportPlan(team) {
    const text = `[${team.host}] Legion ${team.legion}\nPossible times: ${team.slots.map(s=>s+' UTC').join(', ')}\nMatch time: ${team.matchTime ? team.matchTime+' UTC' : 'Not announced yet'}\n\nINITIAL ASSIGNMENTS\n\n` + team.buildings.map(b => `» ${b}: ${(team.assignments[b]||[]).map(name).join(', ')}`).join('\n') + '\n\nSubstitutes: ' + team.members.filter(m=>m.role==='substitute').map(m=>name(m.id)).join(', ');
    setExportText(text); copy(text);
  }
  return <section style={box}>
    <p style={{color:C.icy,fontSize:14,margin:'0 0 8px'}}>TUNDRA ARMS LEAGUE · STEP {steps.indexOf(step)+1} OF 4</p>
    <h2 style={{color:C.white,fontSize:24,margin:'0 0 12px'}}>{({Availability:'When can players join?',Legions:'Build your legions',Buildings:'Plan the first moves',Review:'Review your plan'})[step]}</h2>
    <div aria-label="Planning progress" style={{display:'flex',gap:6,marginBottom:20}}>{steps.map((s,i)=><div key={s} style={{flex:1,height:4,borderRadius:4,background:i<=steps.indexOf(step)?C.gold:C.border}} />)}</div>
    {step==='Availability' && <>
      <p style={{color:C.icy}}>Select every time each player can attend. We’ll use their answers to build legions. All times are UTC.</p>
      <details style={{marginBottom:16,color:C.icy}}><summary style={{minHeight:44,cursor:'pointer'}}>Change poll times</summary>
      <label style={{color:C.icy}}>Battle time options (HH:MM, separated by commas)<input disabled={config.locked} style={input} value={slotDraft} onChange={e=>setSlotDraft(e.target.value)} /></label>
      <button disabled={config.locked} style={button} onClick={()=>{
        const slots=[...new Set(slotDraft.split(',').map(s=>s.trim()))];
        if(slots.length<3 || slots.length>8 || slots.some(s=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))) {setMessage('Enter 3–8 valid UTC times, for example 02:00, 07:00, 12:00, 14:00, 19:00.');return;}
        if(config.teams.length){setMessage('Clear the draft legions before changing poll times.');return;}
        save({slots,availability:Object.fromEntries(Object.entries(config.availability).map(([id,times])=>[id,times.filter(t=>slots.includes(t))]))});setMessage('Poll times saved.');
      }}>Save poll times</button>
      <p style={{color:C.icy,fontSize:14}}>Use the time options shown in your in-game event.</p></details>
      <button style={button} onClick={()=>{const text=`TUNDRA ARMS LEAGUE AVAILABILITY\nReply with your username, player ID, home alliance and ALL times you can attend for the season:\n${config.slots.map(s=>s+' UTC').join(', ')}\nOr reply: Not participating.\nYour team may be scheduled at any of its three registered times.`;setExportText(text);copy(text);}}>Copy availability poll message</button>
      <input aria-label="Search players" placeholder="Search name, ID or home alliance" style={{...input,marginTop:12}} value={query} onChange={e=>setQuery(e.target.value)} />
      <p style={{color:C.icy}}>{players.filter(p=>config.availability[p.id]).length} / {players.length} responses recorded</p><p style={{color:C.icy,fontSize:14}}>No answer yet? Leave the player untouched. Choose ‘Not participating’ only when they decline.</p>
      <p style={{color:C.icy,fontSize:14}}>Showing {Math.min(candidates.length,30)} of {candidates.length} matching players. Search to find someone quickly.</p>
      {candidates.slice(0,30).map(p=><div key={p.id} style={box}>
        <strong style={{color:C.white}}>{name(p.id)} [{p.allianceTag||'No alliance'}]</strong>
        <div style={{color:C.icy,fontSize:14}}>{p.id}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>{config.slots.map(slot=><label key={slot} style={{...button,display:'flex',alignItems:'center',gap:6}}><input type="checkbox" disabled={config.locked} checked={(config.availability[p.id]||[]).includes(slot)} onChange={e=>save({availability:{...config.availability,[p.id]:e.target.checked?[...(config.availability[p.id]||[]),slot]:(config.availability[p.id]||[]).filter(s=>s!==slot)}})} />{slot}</label>)}</div>
        <button disabled={config.locked} style={button} onClick={()=>save({availability:{...config.availability,[p.id]:[]}})}>Not participating</button>
      </div>)}
    </>}
    {step==='Legions' && <>
      <p style={{color:C.icy}}>Group players by shared availability. Each legion needs three possible battle times; the game confirms the actual time later.</p>
      <button disabled={config.locked || !config.hostTags.length || config.teams.length>0} style={{...button,color:C.gold}} onClick={()=>{save({teams:suggestTalTeams(config,players,event)});setMessage('Draft legions created. Review times, roles and attendance.');}}>Auto-sort into legions</button>
      {config.teams.length > 0 && <details style={{color:C.icy,marginTop:12}}><summary style={{minHeight:44,cursor:'pointer'}}>Start over</summary><p>Clear legions to run auto-sort again. Availability answers are kept.</p><button disabled={config.locked || !config.teams.length} style={button} onClick={()=>{if(clearArmed){save({teams:[]});setClearArmed(false);}else{setClearArmed(true);setMessage('Tap Clear draft legions again to remove team assignments. Poll responses are kept.');}}}>Clear legions</button></details>}
      <p style={{color:C.icy}}>{selected.size} assigned · {players.filter(p=>(config.availability[p.id]||[]).length&&!selected.has(p.id)).length} available players unassigned</p>
      {config.teams.map(team=><div key={team.id} style={box}>
        <h3 style={{color:C.white}}>[{team.host}] Legion {team.legion}</h3>
        <p style={{color:C.icy}}>{team.members.filter(m=>m.role==='combatant').length}/30 combatants · {team.members.filter(m=>m.role==='substitute').length}/20 substitutes</p>
        <p style={{color:C.icy}}>Possible battle times · choose 3</p>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{config.slots.map(s=><label key={s} style={button}><input type="checkbox" disabled={config.locked} checked={team.slots.includes(s)} onChange={e=>{if(e.target.checked&&team.slots.length>=3){setMessage('Each legion can select three times. Remove one to choose another.');return;}updateTeam(team.id,{slots:e.target.checked?[...team.slots,s]:team.slots.filter(t=>t!==s)});}} /> {s}</label>)}</div>
        {teamWarnings(team,config).map(w=><p key={w} style={{color:C.gold}}>{w}</p>)}
        <details style={{color:C.icy}}><summary style={{minHeight:44,cursor:'pointer'}}>Review players · {team.members.length}</summary>
        {team.members.map(m=><div key={m.id} style={{borderTop:`1px solid ${C.border}`,padding:'10px 0'}}>
          <div style={{color:C.white}}>{name(m.id)} [{players.find(p=>p.id===m.id)?.allianceTag||'—'}]</div>
          <div style={{color:C.icy,fontSize:14}}>{team.slots.filter(s=>(config.availability[m.id]||[]).includes(s)).length}/3 times · {strength(players.find(p=>p.id===m.id)||{id:m.id},event)||'No recorded'} troop power</div>
          <select aria-label={`Role for ${name(m.id)}`} disabled={config.locked} value={m.role} style={input} onChange={e=>{const role=e.target.value;const limit=role==='combatant'?30:20;if(team.members.filter(x=>x.role===role).length>=limit){setMessage(`Maximum ${limit} ${role}s.`);return;}updateTeam(team.id,{members:team.members.map(x=>x.id===m.id?{...x,role}:x),assignments:{}});}}><option value="combatant">Combatant</option><option value="substitute">Substitute</option></select>
          <button disabled={config.locked} style={button} onClick={()=>{setMovePlayer(m.id);setMoveTarget('');}}>Move or swap</button>
          <button disabled={config.locked} style={button} onClick={()=>updateTeam(team.id,{members:team.members.filter(x=>x.id!==m.id),assignments:{}})}>Remove from legion</button>
        </div>)}
        </details>
        <select aria-label={`Add player to ${team.id}`} style={input} value="" disabled={config.locked} onChange={e=>{const id=e.target.value;if(!id)return;const role=team.members.filter(m=>m.role==='combatant').length<30?'combatant':'substitute';if(team.members.length>=50){setMessage('Legion is full.');return;}updateTeam(team.id,{members:[...team.members,{id,role}],assignments:{}});}}><option value="">Add an unassigned player…</option>{players.filter(p=>!selected.has(p.id)).map(p=><option key={p.id} value={p.id}>{name(p.id)} [{p.allianceTag}]</option>)}</select>
      </div>)}
    </>}
    {step==='Buildings' && <>
      <p style={{color:C.icy}}>Put the most important building first. Auto-assign sends the strongest leaders there, with followers from their legion.</p>
      <details style={{color:C.icy,marginBottom:16}}><summary style={{minHeight:44,cursor:'pointer'}}>Player strength · optional</summary><p>Enter troop power to rank leaders. Missing values are not a reliable strength estimate.</p>{players.filter(p=>selected.has(p.id)).map(p=><div key={p.id} style={{marginBottom:12}}><strong>{name(p.id)}</strong>        <label style={{color:C.icy}}>Troop power (optional, full number)<input type="number" min="0" disabled={config.locked} style={input} value={event.snapshots?.find(s=>s.playerId===p.id)?.troopPower??''} onChange={e=>{const snapshots=[...(event.snapshots||[])];const index=snapshots.findIndex(s=>s.playerId===p.id);const snap=index>=0?snapshots[index]:newSnapshot(p.id,p,event.id);const next={...snap,troopPower:e.target.value===''?null:Math.max(0,Number(e.target.value))};if(index>=0)snapshots[index]=next;else snapshots.push(next);onUpdate({...event,snapshots});}} /></label>
</div>)}</details>
      {!config.teams.length&&<p style={{color:C.gold}}>Create legions first.</p>}
      {config.teams.filter(t=>t.members.length).map(team=><div key={team.id} style={box}>
        <h3 style={{color:C.white}}>[{team.host}] Legion {team.legion}</h3>
        {team.buildings.map((b,i)=><div key={b} style={{marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}><strong style={{color:C.white,flex:1}}>{i+1}. {b}</strong>{[-1,1].map(delta=><button key={delta} aria-label={`Move ${b} ${delta<0?'up':'down'}`} disabled={config.locked||i+delta<0||i+delta>=team.buildings.length} style={button} onClick={()=>{const buildings=[...team.buildings];[buildings[i],buildings[i+delta]]=[buildings[i+delta],buildings[i]];updateTeam(team.id,{buildings,assignments:{}});}}>{delta<0?'↑':'↓'}</button>)}</div>
          <p style={{color:C.icy,fontSize:14}}>{(team.assignments[b]||[]).map((id,j)=>`${j===0?'Leader: ':'Follow: '}${name(id)}`).join(' · ')||'No assignment yet'}</p>
        </div>)}
        <button disabled={config.locked} style={button} onClick={()=>updateTeam(team.id,{assignments:assignTalBuildings(team,players,event)})}>Auto-assign buildings</button>
        <p style={{color:C.icy}}>Adjust any combatant's building below. The first person listed at a building leads.</p>
        {team.members.filter(m=>m.role==='combatant').map(m=><label key={m.id} style={{display:'block',color:C.white,marginBottom:8}}>{name(m.id)}<select disabled={config.locked} aria-label={`Building for ${name(m.id)}`} style={input} value={team.buildings.find(b=>(team.assignments[b]||[]).includes(m.id))||''} onChange={e=>{const assignments=Object.fromEntries(team.buildings.map(b=>[b,(team.assignments[b]||[]).filter(id=>id!==m.id)]));if(e.target.value)assignments[e.target.value].push(m.id);updateTeam(team.id,{assignments});}}><option value="">Unassigned</option>{team.buildings.map(b=><option key={b}>{b}</option>)}</select></label>)}

      </div>)}
    </>}
    {step==='Review' && <>
      <p style={{color:C.icy}}>Check each legion before registering in game. Players must join their host alliance before sign-up closes.</p>
      {config.teams.filter(t=>t.members.length).map(team=><div key={team.id} style={box}>
        <h3 style={{color:C.white}}>[{team.host}] Legion {team.legion}</h3>
        <p style={{color:C.icy}}>{team.members.filter(m=>m.role==='combatant').length} combatants · {team.members.filter(m=>m.role==='substitute').length} substitutes</p>
        <p style={{color:C.icy}}>Possible times: {team.slots.join(', ')} UTC</p>
        {teamWarnings(team,config).map(w=><p key={w} style={{color:C.gold}}>{w}</p>)}
        <label style={{color:C.icy}}>Confirmed match time<select disabled={config.locked} style={input} value={team.matchTime||''} onChange={e=>updateTeam(team.id,{matchTime:e.target.value})}><option value="">Not announced yet</option>{team.slots.map(t=><option key={t} value={t}>{t} UTC</option>)}</select></label>
        <p style={{color:C.icy,fontSize:14}}>Leave blank until the game announces the match time.</p>
        <button style={button} onClick={()=>exportPlan(team)}>Copy legion plan</button>
      </div>)}
      {config.locked ? <><p style={{color:C.green}}>Plan locked</p><button style={button} onClick={()=>onUpdate({...event,tal:{...config,locked:false}})}>Unlock plan</button></> : <button style={{...button,color:C.gold}} onClick={()=>{if(!armed){setArmed(true);return;}onUpdate({...event,tal:{...config,locked:true}});setArmed(false);}}>{armed?'Confirm lock':'Lock plan'}</button>}
    </>}
    {movePlayer && <div role="dialog" aria-modal="true" aria-label="Move or swap player" style={{...box,position:'fixed',inset:'10% 0 auto',margin:'0 auto',width:'calc(100% - 32px)',maxWidth:448,maxHeight:'80vh',overflowY:'auto',boxSizing:'border-box',zIndex:400,boxShadow:`0 0 0 100vmax ${C.bg}ee`}}>
      <h3 style={{color:C.white}}>Move {name(movePlayer)}</h3>
      <label style={{color:C.icy}}>Destination legion<select style={input} value={moveTarget} onChange={e=>setMoveTarget(e.target.value)}><option value="">Choose a legion</option>{config.teams.filter(t=>!t.members.some(m=>m.id===movePlayer)).map(t=><option key={t.id} value={t.id}>[{t.host}] Legion {t.legion}</option>)}</select></label>
      {moveTarget&&<><button style={button} onClick={()=>{try{save({teams:moveTalMember(config.teams,movePlayer,moveTarget)});setMovePlayer(null);setMessage('Player moved. Review their availability in the new legion.');}catch(e){setMessage(e.message);}}}>Move to this legion</button><label style={{display:'block',color:C.icy,marginTop:12}}>Or swap with<select style={input} value="" onChange={e=>{if(!e.target.value)return;try{save({teams:moveTalMember(config.teams,movePlayer,moveTarget,e.target.value)});setMovePlayer(null);setMessage('Players swapped. Review their availability.');}catch(e){setMessage(e.message);}}}><option value="">Choose a player to swap</option>{config.teams.find(t=>t.id===moveTarget)?.members.map(m=><option key={m.id} value={m.id}>{name(m.id)} · {m.role}</option>)}</select></label></>}
      <button style={button} onClick={()=>setMovePlayer(null)}>Cancel</button>
    </div>}
    <div style={{display:'flex',gap:10,marginTop:20}}>
      {step!=='Availability' && <button style={button} onClick={()=>go(steps[steps.indexOf(step)-1])}>Back</button>}
      {step!=='Review' && <button disabled={step==='Availability'?!players.some(p=>(config.availability[p.id]||[]).length):!config.teams.some(t=>t.members.length)} style={{...button,flex:1,background:C.gold,color:C.bg,fontWeight:700}} onClick={()=>go(steps[steps.indexOf(step)+1])}>{({Availability:'Next: build legions',Legions:'Next: assign buildings',Buildings:'Next: review plan'})[step]}</button>}
    </div>
    {message&&<p role="status" style={{color:C.gold}}>{message}</p>}
    {exportText&&<textarea aria-label="Copyable message" readOnly value={exportText} style={{...input,minHeight:180,marginTop:12}} />}
  </section>;
}
