export function labyrinth(player){
 const row=player?.providerRankings?.labyrinth;
 if(!row||(row.stateId&&String(row.stateId)!=='3573'))return {rank:null,score:null};
 const rank=Number(row.rank),score=row.score==null||row.score===''?null:Number(row.score);
 return {rank:Number.isInteger(rank)&&rank>0?rank:null,score:Number.isFinite(score)&&score>=0?score:null};
}
export function compareLabyrinth(a,b){
 const av=labyrinth(a),bv=labyrinth(b);
 if(av.rank!==bv.rank){if(av.rank==null)return 1;if(bv.rank==null)return -1;return av.rank-bv.rank;}
 if(av.score!==bv.score){if(av.score==null)return 1;if(bv.score==null)return -1;return bv.score-av.score;}
 return 0;
}
export const labyrinthLabel=p=>{const v=labyrinth(p);return v.rank!=null?`Labyrinth #${v.rank}`:v.score!=null?`Labyrinth score ${v.score.toLocaleString('en-US')}`:'Labyrinth not fetched';};
