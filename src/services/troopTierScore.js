// Approved 3573 TAL roster troop-tier index (base power per unit).
// This is not TAL troop power, march strength, or a battle outcome predictor.
const BASE_POWER={
  5:{standard:94,helios:114},6:{standard:99,helios:120},
  7:{standard:104,helios:126},8:{standard:110,helios:135},
  9:{standard:115,helios:141},10:{standard:121,helios:148},
};
const TYPES=['infantry','lancer','marksman'];
export function troopUnitPower(label){
  if(typeof label!=='string')return null;
  const fc=label.match(/\\bFC\\s*(\\d+)\\b/i);
  if(!fc)return null;
  const entry=BASE_POWER[Number(fc[1])];
  if(!entry)return null;
  return /\\bHelios\\b/i.test(label)?entry.helios:entry.standard;
}
export function troopTierScore(player){
  const values=TYPES.map(type=>troopUnitPower(player?.troops?.[type]));
  return values.some(v=>v===null)?null:values.reduce((sum,value)=>sum+value,0)/3;
}
export function compareByTroopTier(a,b,direction='desc'){
  const av=troopTierScore(a),bv=troopTierScore(b);
  if(av===null||bv===null)return av===null?(bv===null?0:1):-1;
  return (av-bv)*(direction==='asc'?1:-1);
}
