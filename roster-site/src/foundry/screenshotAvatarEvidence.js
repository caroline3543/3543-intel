import {avatarFingerprint} from './avatarFingerprint.js';
// Experimental crop. No persistence or mutation of OCR readings.
export async function screenshotAvatarEvidence(file,bounds){
 if(!file||!bounds||!Number.isFinite(bounds.top)||!Number.isFinite(bounds.bottom)||bounds.top<0||bounds.bottom>1||bounds.bottom<=bounds.top)return null;
 let bitmap;
 try{
  bitmap=await createImageBitmap(file);
  const x=Math.round(bitmap.width*.075),right=Math.round(bitmap.width*.195);
  const top=bounds.top*bitmap.height,end=bounds.bottom*bitmap.height;
  const span=bitmap.height*.077;
  const start=bounds.top<=.336?end-span:top;
  const y=Math.round(start+span*.04),bottom=Math.round(start+span*.65);
  if(y<Math.round(top)||bottom>Math.round(end))return null;
  if(right-x<9||bottom-y<9)return null;
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,x,y,right-x,bottom-y,0,0,96,96);
  return avatarFingerprint(ctx.getImageData(0,0,96,96).data,96,96);
 }catch{return null;}finally{bitmap?.close();}
}
