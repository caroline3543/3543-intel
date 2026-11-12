import {troopPower} from './power.js';
import {compareLabyrinth} from './labyrinth.js';
export function compareLegionStrength(plan,a,b){
 const av=troopPower(plan,a),bv=troopPower(plan,b);
 if(av!=null&&bv!=null&&av!==bv)return bv-av;
 if(av!=null&&bv==null)return -1;if(av==null&&bv!=null)return 1;
 return compareLabyrinth(a,b)||String(a.id).localeCompare(String(b.id));
}
export function allocateLegionRoles(plan,players){
 if(!plan||plan.locked||plan.autoRoles===false)return plan;
 const byId=new Map(players.map(p=>[p.id,p]));let changed=false;
 const teams=plan.teams.map(t=>{
  const sorted=[...t.members].sort((a,b)=>compareLegionStrength(plan,byId.get(a.id)||{id:a.id},byId.get(b.id)||{id:b.id}));
  const roles=new Map(sorted.map((m,i)=>[m.id,i<30?'combatant':'substitute']));let changes=0,registrations=0;const registrationIds=new Set(t.autoRoleNotice?.registrationIds||[]);
  const members=t.members.map(m=>{const role=roles.get(m.id);if(role===m.role)return m;changed=true;changes++;if(m.registered){registrations++;registrationIds.add(m.id);}return {...m,role,registered:false};});
  return changes?{...t,members,autoRoleNotice:{changed:changes,registrations,registrationIds:[...registrationIds]}}:t;
 });
 return changed||!plan.autoRoles?{...plan,teams,autoRoles:true}:plan;
}
export function withAutomaticRoles(data){const plan=allocateLegionRoles(data.talPlan,data.players||[]);return plan===data.talPlan?data:{...data,talPlan:plan};}
