import {troopPower} from './power.js';
import {compareLabyrinth} from './labyrinth.js';
export function compareLegionStrength(plan,a,b){
 const av=troopPower(plan,a),bv=troopPower(plan,b);
 if(av!=null&&bv!=null&&av!==bv)return bv-av;
 if(av!=null&&bv==null)return -1;if(av==null&&bv!=null)return 1;
 return compareLabyrinth(a,b)||String(a.id).localeCompare(String(b.id));
}
export function allocateLegionRoles(plan,players){
 // Existing registration assignments are deliberate. Auto allocation requires explicit opt-in.
 if(!plan||plan.locked||plan.autoRoles!=='requested')return plan;
 const byId=new Map(players.map(p=>[p.id,p]));let changed=false;
 const teams=plan.teams.map(t=>{
  const sorted=[...t.members].sort((a,b)=>compareLegionStrength(plan,byId.get(a.id)||{id:a.id},byId.get(b.id)||{id:b.id}));
  const roles=new Map(sorted.map((m,i)=>[m.id,i<30?'combatant':'substitute']));let changes=0,registrations=0;const registrationIds=new Set(t.autoRoleNotice?.registrationIds||[]);
  const members=t.members.map(m=>{const role=roles.get(m.id);if(m.roleLocked||role===m.role)return m;changed=true;changes++;if(m.registered){registrations++;registrationIds.add(m.id);}return {...m,role,registered:m.registrationLocked?m.registered:false};});
  return changes?{...t,members,autoRoleNotice:{changed:changes,registrations,registrationIds:[...registrationIds]}}:t;
 });
 return changed||!plan.autoRoles?{...plan,teams,autoRoles:true}:plan;
}
export function withAutomaticRoles(data){const confirmed=applyConfirmedTalLocks(data);const plan=allocateLegionRoles(confirmed.talPlan,confirmed.players||[]);return plan===confirmed.talPlan?confirmed:{...confirmed,talPlan:plan};}

// Lock identity by game player ID, never a mutable username.
export const CONFIRMED_HOT_SUBSTITUTE_FIDS=new Set(['591878505','615792156','620448965','571529214','598194666','591743122']);
export function applyConfirmedTalLocks(data){
 const plan=data?.talPlan;if(!plan?.teams?.length)return data;
 const fidById=new Map((data.players||[]).map(p=>[String(p.id),String(p.fid||'')]));
 let changed=false;
 const teams=plan.teams.map(t=>{
  if(t.id!=='HOT:1')return t;
  const members=(t.members||[]).map(m=>{
   if(!CONFIRMED_HOT_SUBSTITUTE_FIDS.has(fidById.get(String(m.id))))return m;
   if(m.registered===true&&m.role==='substitute'&&m.registrationLocked===true&&m.roleLocked===true)return m;
   changed=true;return {...m,registered:true,role:'substitute',registrationLocked:true,roleLocked:true};
  });return changed?{...t,members}:t;
 });
 return changed?{...data,talPlan:{...plan,teams,autoRoles:false}}:data;
}
