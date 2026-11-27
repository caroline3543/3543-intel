import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarFingerprint,avatarDistance} from '../roster-site/src/foundry/avatarFingerprint.js';
function pixels(size,pattern,frame=0){
 const data=new Uint8ClampedArray(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const u=(x+.5)/size,v=(y+.5)/size;
 const n=u<.15||u>.85||v<.15||v>.85?frame:pattern(u,v);
 data.set([n,n,n,255],(y*size+x)*4);
 }return data;
}
const stripes=(x,y)=>x<.5?40:220;
test('same avatar across resolution and frame changes',()=>{
 const a=avatarFingerprint(pixels(80,stripes),80,80);
 const b=avatarFingerprint(pixels(160,stripes,255),160,160);
 assert.ok(a);assert.equal(avatarDistance(a,b),0);
});
test('opposite patterns have substantial distance',()=>{
 const a=avatarFingerprint(pixels(80,stripes),80,80);
 const b=avatarFingerprint(pixels(80,(x,y)=>255-stripes(x,y)),80,80);
 assert.ok(avatarDistance(a,b)>.4);
});
test('flat and malformed images do not provide evidence',()=>{
 assert.equal(avatarFingerprint(pixels(80,()=>100),80,80),null);
 assert.equal(avatarFingerprint([],80,80),null);
 assert.equal(avatarDistance(null,{}),null);
 assert.equal(avatarDistance({difference:'0',average:'0'},{}),null);
});
