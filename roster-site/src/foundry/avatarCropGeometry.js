export function avatarCropGeometry(width,height,top,bottom){
 if(![width,height,top,bottom].every(Number.isFinite)||width<9||height<9||top<0||bottom>height||bottom<=top)return null;
 const nominal=Math.round(height*.077);
 const start=top<=Math.round(height*.336)?bottom-nominal:top;
 const left=Math.round(width*.075),right=Math.round(width*.195);
 const upper=Math.round(start+nominal*.04),lower=Math.round(start+nominal*.65);
 if(upper<top||lower>bottom||right-left<9||lower-upper<9)return null;
 return {left,upper,width:right-left,height:lower-upper};
}
