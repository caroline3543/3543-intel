import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarCropGeometry} from '../roster-site/src/foundry/avatarCropGeometry.js';
test('normal roster crop scales with screenshot resolution',()=>{
 const a=avatarCropGeometry(1000,2000,800,954);
 const b=avatarCropGeometry(2000,4000,1600,1908);
 assert.ok(a&&b);
 for(const key of ['left','upper','width','height'])assert.ok(Math.abs(b[key]-2*a[key])<=2,key);
});
test('first visible row uses bottom anchored nominal geometry',()=>{
 const crop=avatarCropGeometry(1000,2000,600,754);
 assert.deepEqual(crop,{left:75,upper:606,width:120,height:94});
});
test('reject clipped and malformed rows',()=>{
 for(const args of [[1000,2000,600,650],[1000,2000,800,820],[1000,2000,-1,100],[1000,2000,1900,2100],[1000,2000,900,800],[1000,2000,NaN,900]])assert.equal(avatarCropGeometry(...args),null);
});
