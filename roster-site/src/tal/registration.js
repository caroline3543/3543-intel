import {comparePlayers} from './power.js';
export function allianceRank(player){const value=player?.allianceRank??player?.providerStats?.allianceRank;const match=String(value??'').match(/^R([1-5])$/i);return match?Number(match[1]):null;}
export function registrationGroups(rows,plan,sort='game'){
 const sorted=[...rows].sort((a,b)=>comparePlayers(plan,sort==='game'?'troop':sort)(a.player||{id:a.member.id},b.player||{id:b.member.id}));
 if(sort!=='game')return [{label:'',rows:sorted}];
 return [5,4,3,2,1,null].map(rank=>({label:rank?`R${rank}`:'Rank not recorded',rows:sorted.filter(r=>allianceRank(r.player)===rank)})).filter(g=>g.rows.length);
}
