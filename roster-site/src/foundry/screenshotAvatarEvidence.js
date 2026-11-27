import {avatarCropGeometry} from './avatarCropGeometry.js';
import {avatarFingerprint} from './avatarFingerprint.js';
// Experimental crop. No persistence or mutation of OCR readings.
export async function screenshotAvatarEvidence(file,bounds){
 if(!file||!bounds||!Number.isFinite(bounds.top)||!Number.isFinite(bounds.bottom)||bounds.top<0||bounds.bottom>1||bounds.bottom<=bounds.top)return null;
 let bitmap;
 try{
  bitmap=await createImageBitmap(file);
  const crop=avatarCropGeometry(bitmap.width,bitmap.height,Math.round(bounds.top*bitmap.height),Math.round(bounds.bottom*bitmap.height));
  if(!crop)return null;
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,crop.left,crop.upper,crop.width,crop.height,0,0,96,96);
  return avatarFingerprint(ctx.getImageData(0,0,96,96).data,96,96);
 }catch{return null;}finally{bitmap?.close();}
}
