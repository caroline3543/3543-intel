import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readPreferences,savePreferences,tapFeedback} from '../roster-site/src/preferences.js';
function storage(){const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};}
test('tutorial and haptic preferences persist independently without affecting roster records',()=>{
 const saved=storage();saved.setItem('svs_rally_data:state:3573','keep');
 assert.deepEqual(readPreferences(saved),{tutorialSeen:false,haptics:true});
 savePreferences({tutorialSeen:true},saved);savePreferences({haptics:false},saved);
 assert.deepEqual(readPreferences(saved),{tutorialSeen:true,haptics:false});
 assert.equal(saved.getItem('svs_rally_data:state:3573'),'keep');
});
test('unavailable storage and vibration cannot block button actions',()=>{
 const saved={getItem(){throw new Error();},setItem(){throw new Error();}};
 assert.deepEqual(readPreferences(saved),{tutorialSeen:false,haptics:true});
 assert.equal(savePreferences({tutorialSeen:true},saved).tutorialSeen,true);
 assert.equal(tapFeedback(true,{}),false);
 assert.equal(tapFeedback(true,{vibrate(){throw new Error();}}),false);
 let pulses=0;const device={vibrate(ms){assert.equal(ms,8);pulses++;return true;}};
 assert.equal(tapFeedback(false,device),false);assert.equal(pulses,0);
 assert.equal(tapFeedback(true,device),true);assert.equal(pulses,1);
});
