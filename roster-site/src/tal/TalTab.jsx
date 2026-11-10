import {TalBulkEditor} from './TalBulkEditor.jsx';
import {TalSheetConnection} from './TalSheetConnection.jsx';
import {useState} from 'react';
import {Card,Hint,button,C} from './ui.jsx';
import {newPlan,record} from './planner.js';
import {Setup} from './Setup.jsx';
import {Availability} from './Availability.jsx';
import {Legions} from './Legions.jsx';
import {Review} from './Review.jsx';
const steps=[['setup','Setup'],['times','Times'],['legions','Legions'],['review','Review']];
export function TalTab({value,players,onChange,onMembers,onExport,onRefreshLab,refreshingLab,workspace,onImportSheet,onBulkApply}){
 const plan={...newPlan(),...value};
 const [message,setMessage]=useState(''),[copyText,setCopyText]=useState('');
 function save(next){onChange(next);setMessage('');}
 function step(next){onChange({...plan,step:next});setMessage('');}
 async function copy(text){setCopyText(text);try{await navigator.clipboard.writeText(text);setMessage('Copied.');}catch{setMessage('Copy unavailable. Select the text below.');}}
 const props={plan,players,onChange:save,onMessage:setMessage,onCopy:copy,onRefreshLab,refreshingLab};
 return <section style={{padding:'16px 20px 32px'}}>
  <h2 style={{fontSize:24,margin:'0 0 8px'}}>Tundra Arms League</h2><Hint>Build a state team from any loaded alliance. Plan here; register in game.</Hint>
  <nav aria-label="TAL planning steps" style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:6,marginBottom:14}}>{steps.map(([id,label])=><button key={id} aria-current={plan.step===id?'step':undefined} style={{...button,padding:'10px 3px',fontSize:13,color:plan.step===id?C.gold:C.icy,borderColor:plan.step===id?C.gold:C.border}} onClick={()=>step(id)}>{label}</button>)}</nav>
  <Hint>{players.filter(p=>record(plan,p).status==='available').length} taking part · {plan.teams.reduce((n,t)=>n+t.members.length,0)} assigned · {plan.teams.length} legions{plan.locked?' · Plan locked':''}</Hint>
  <TalBulkEditor data={workspace||{players,talPlan:plan}} onApply={onBulkApply}/>
  <TalSheetConnection data={workspace||{players,talPlan:plan}} onImport={onImportSheet} locked={plan.locked}/>
  {message&&<p role="status" style={{padding:12,background:C.card,borderRadius:10,fontSize:14,color:C.gold,lineHeight:1.5}}>{message}</p>}
  {plan.locked&&<Card><Hint>This plan is locked. You can review and export it.</Hint><button style={button} onClick={()=>onChange({...plan,locked:false})}>Unlock to edit</button></Card>}
  {!players.length&&<Card title="Load your players first"><Hint>Use Members to load HOT, ARC, RKG, LUN or another alliance.</Hint><button style={button} onClick={onMembers}>Go to Members</button></Card>}
  {plan.step==='setup'&&<Setup {...props}/>}
  {plan.step==='times'&&<Availability {...props}/>}
  {plan.step==='legions'&&<Legions {...props}/>}
  {plan.step==='review'&&<Review {...props} onExport={onExport} onStep={step}/>}
  <div style={{display:'flex',gap:8,margin:'12px 0 18px'}}>{plan.step!=='setup'&&<button style={{...button,flex:1}} onClick={()=>step(steps[Math.max(0,steps.findIndex(s=>s[0]===plan.step)-1)][0])}>Back</button>}{plan.step!=='review'&&<button style={{...button,flex:2,background:C.gold,color:C.bg}} onClick={()=>step(steps[Math.min(3,steps.findIndex(s=>s[0]===plan.step)+1)][0])}>{({setup:'Next: availability',times:'Next: legions',legions:'Next: review'})[plan.step]}</button>}</div>
  {copyText&&<details open><summary style={{minHeight:44,paddingTop:12,color:C.icy}}>Text to share</summary><textarea readOnly aria-label="Plan text to share" value={copyText} style={{width:'100%',minHeight:160,background:C.section,color:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:12,fontSize:14}}/></details>}
  <details><summary style={{minHeight:48,padding:'14px 0',color:C.icy,cursor:'pointer'}}>Rules & leader checklist</summary><Card>
   <Hint>Check the current in-game rules and dates before registration.</Hint>
   <ul style={{paddingLeft:20,color:C.icy,fontSize:14,lineHeight:1.7}}><li>Each legion allows up to 30 combatants and 20 substitutes. A player belongs to one legion.</li><li>Choose three battle times. The game selects the match time; the roster and time choices lock after sign-up.</li><li>Players must join the host alliance and be registered before sign-up closes. After leaving, they must return before the battlefield opens.</li><li>Confirm Legion 2 eligibility, player furnace eligibility, recent activity and the minimum registered-player count in game.</li><li>Matchmaking considers the top 20 registered players’ troop power. City power is not the same measurement.</li><li>Substitutes enter after three minutes. Leaving the battlefield triggers a 12-minute re-entry wait.</li><li>Before battle: clear marches, injured troops and reinforcements; stop Auto-Hunt and extinguish city fires.</li><li>Keep a captain and substitutes for each possible time. Check players’ notes for day-specific limits.</li></ul>
   <p style={{fontSize:13,color:C.icy,lineHeight:1.5}}>Availability and assignments sync with the leader workspace. Export the Excel plan or copy it for Discord.</p>
   <a href="https://centurygames.helpshift.com/hc/en/64-whiteout-survival/" target="_blank" rel="noreferrer" style={{display:'block',minHeight:44,paddingTop:12,color:C.gold}}>Official Help Center</a><a href="https://outof.games/realms/whiteoutsurvival/guides/498-tundra-arms-league-in-whiteout-survival/" target="_blank" rel="noreferrer" style={{display:'block',minHeight:44,paddingTop:12,color:C.gold}}>TAL planning guide</a>
  </Card></details>
 </section>;
}
