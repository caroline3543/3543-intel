export const RANKING_BOARDS = [
  {key:'personal_power',label:'Personal power',type:3,field:'power'},
  {key:'kills',label:'Kills',type:4,field:'kills'},
  {key:'furnace',label:'Furnace level',type:5,field:'furnace_level'},
  {key:'state_transfer',label:'State transfer score',type:19,field:'state_transfer_score'},
  {key:'labyrinth',label:'Labyrinth',type:20,field:'labyrinth'},
  {key:'chief_gear',label:'Chief gear power',type:14},
  {key:'chief_charm',label:'Chief charm power',type:15},
  {key:'pet_power',label:'Pet power',type:16},
  {key:'troop_power',label:'Troop power',type:9},
  {key:'hero_total',label:'Total hero power',type:8},
  {key:'single_hero',label:'Single hero power',type:7},
  {key:'research_power',label:'Research power',type:11},
  {key:'building_power',label:'Building power',type:10},
  {key:'island_prosperity',label:'Island prosperity',type:18},
  {key:'alliance_power',label:'Alliance power',type:1,alliance:true},
  {key:'alliance_kills',label:'Alliance kills',type:2,alliance:true},
];
export function rankingsPath(state, board, limit=100) {
  if (!['string','number'].includes(typeof state) || !['string','number'].includes(typeof limit)) return null;
  const id=Number(state), size=Number(limit);
  if (!Number.isSafeInteger(id) || id<1 || id>99999) return null;
  if (!RANKING_BOARDS.some(b=>b.key===board)) return null;
  if (!Number.isSafeInteger(size) || size<1 || size>100) return null;
  return `/states/${id}/ranks?board=${board}&limit=${size}`;
}
