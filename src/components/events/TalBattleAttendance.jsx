import {C} from '../../utils/constants.js';
import {matchRoster} from '../../services/talMatchReadiness.js';

const control={minHeight:44,borderRadius:10,border:`1px solid ${C.border}`,background:C.card,color:C.icy,padding:'8px 10px',fontSize:14};
export function TalBattleAttendance({team,config,players,onChange,locked=false}) {
 const rows=team.matchTime?matchRoster(team,config,players):[];
 const attending=rows.filter(r=>r.status==='attending');
 const unavailable=rows.filter(r=>r.status!=='attending');
 return <section aria-label={`Battle plan availability for ${team.host} Legion ${team.legion}`} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:12,margin:'12px 0'}}>
  <h4 style={{fontSize:16,margin:'0 0 8px',color:C.white}}>Match-day players</h4>
  <label style={{display:'block',fontSize:14,color:C.icy}}>Match time
   <select disabled={locked} value={team.matchTime||''} onChange={e=>onChange({matchTime:e.target.value,assignments:{}})} style={{...control,display:'block',width:'100%',marginTop:6}}>
    <option value="">Not announced yet</option>
    {team.slots.map(t=><option key={t} value={t}>{t} UTC</option>)}
   </select>
  </label>
  {!team.matchTime?<p style={{fontSize:13,lineHeight:1.5,color:C.icy}}>Choose the confirmed match time. Players who selected that time in the poll will appear as expected by default.</p>:<>
   <p style={{fontSize:13,lineHeight:1.5,color:C.icy}}>{attending.length} expected · {unavailable.length} not confirmed. Poll availability is not a final RSVP.</p>
   {rows.map(r=><div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'8px 0',borderTop:`1px solid ${C.border}`}}>
    <div style={{minWidth:0,flex:1}}>
     <div style={{fontSize:14,color:C.white,overflowWrap:'anywhere'}}>{r.player?.username||r.player?.alias||'Unknown player'}</div>
     <div style={{fontSize:12,color:C.icy}}>{r.role==='substitute'?'Substitute · ':''}{r.pollYes?'Available in poll':'Not available in poll'} · {r.alliance==='in-host'?'Correct alliance':r.alliance==='move'?'Needs alliance move':'Alliance unverified'}</div>
    </div>
    <select aria-label={`Battle-day attendance for ${r.player?.username||r.id}`} disabled={locked} value={r.status} style={{...control,width:138,flexShrink:0,color:r.status==='attending'?C.green:C.icy}} onChange={e=>{
      const battleAttendance={...(team.battleAttendance||{}),[r.id]:e.target.value};
      onChange({battleAttendance,assignments:{}});
    }}>
     <option value="attending">Expected</option>
     <option value="not-attending">Not attending</option>
     <option value="unknown">Unknown</option>
    </select>
   </div>)}
  </>}
 </section>;
}
