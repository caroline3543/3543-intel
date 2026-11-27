// Pure image comparison primitives. No storage, network access or identity decisions.
export function avatarFingerprint(rgba,width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<9||height<9||rgba.length!==width*height*4)return null;
 // Sample the central 60% to reduce decorative frame influence.
 const sample=(cols,rows)=>Array.from({length:cols*rows},(_,i)=>{
  const x=Math.min(width-1,Math.floor(width*(.2+.6*((i%cols)+.5)/cols)));
  const y=Math.min(height-1,Math.floor(height*(.2+.6*(Math.floor(i/cols)+.5)/rows)));
  const p=(y*width+x)*4;
  return .299*rgba[p]+.587*rgba[p+1]+.114*rgba[p+2];
 });
 const grid=sample(9,8),values=sample(8,8);
 const mean=values.reduce((a,b)=>a+b,0)/64;
 const variance=values.reduce((a,b)=>a+(b-mean)**2,0)/64;
 if(variance<16)return null;
 let difference='',average='';
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  difference+=grid[y*9+x]>grid[y*9+x+1]?'1':'0';
  average+=values[y*8+x]>=mean?'1':'0';
 }
 return {difference,average};
}
export function avatarDistance(a,b){
 if(!a||!b)return null;
 const valid=v=>typeof v==='string'&&/^[01]{64}$/.test(v);
 if(![a.difference,a.average,b.difference,b.average].every(valid))return null;
 const distance=(x,y)=>Array.from(x,(bit,i)=>Number(bit!==y[i])).reduce((s,v)=>s+v,0);
 return (distance(a.difference,b.difference)+distance(a.average,b.average))/128;
}
