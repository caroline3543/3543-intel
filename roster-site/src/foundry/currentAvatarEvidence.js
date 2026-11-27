import {avatarFingerprint} from './avatarFingerprint.js';
import {playerAvatarUrl} from '../../../src/services/playerAvatarService.js';

// In-memory only, one current reference per FID. No historical or screenshot cache.
export function createCurrentAvatarEvidence(){
 const cache=new Map();
 async function load(url){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),5000);
  let bitmap;
  try{
   const response=await fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
   if(!response.ok)return null;
   const blob=await response.blob();
   if(!blob.type.startsWith('image/')||blob.size>5*1024*1024)return null;
   bitmap=await createImageBitmap(blob);
   const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   const side=Math.min(bitmap.width,bitmap.height);
   ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,96,96);
   return avatarFingerprint(ctx.getImageData(0,0,96,96).data,96,96);
  }catch{return null;}finally{clearTimeout(timeout);bitmap?.close();}
 }
 return {
  async get(player){
   const fid=String(player?.fid??player?.playerId??'').trim();
   const url=playerAvatarUrl(player);
   if(!fid)return null;
   if(!url){cache.delete(fid);return null;}
   let entry=cache.get(fid);
   if(entry?.url!==url){
    entry={url,promise:load(url)};cache.set(fid,entry);
   }
   const value=await entry.promise;
   if(cache.get(fid)!==entry)return null;
   if(!value)cache.delete(fid);
   return value;
  },
  clear(){cache.clear();}
 };
}
