import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreScreenshot} from './3573-ocr-score.mjs';
const label={center:.4,name:'Bahias66²',power:3418,registration:'unassigned'};
const row={bounds:{top:.36,bottom:.44},name:label.name,power:3418,registration:'unassigned'};
test('perfect recognition scores every field',()=>{
 const s=scoreScreenshot({legion:1,rows:[label]},{legion:1,rows:[row]});
 for(const key of ['detected','nameCorrect','powerCorrect','registrationCorrect','otherLegionCorrect'])assert.equal(s[key],1);
 assert.equal(s.legionCorrect,true);assert.equal(s.extra,0);
});
test('wrong name does not conceal correct power or incorrect registration',()=>{
 const s=scoreScreenshot({legion:1,rows:[label]},{legion:2,rows:[{...row,name:'Bahias66',registration:'combatant'}]});
 assert.equal(s.nameCorrect,0);assert.equal(s.powerCorrect,1);assert.equal(s.registrationCorrect,0);assert.equal(s.legionCorrect,false);
});
test('missing and extra cards are counted separately',()=>{
 const s=scoreScreenshot({legion:1,rows:[label]},{legion:1,rows:[{...row,bounds:{top:.6,bottom:.68}}]});
 assert.equal(s.detected,0);assert.equal(s.extra,1);
});
test('other legion number must match independently',()=>{
 const s=scoreScreenshot({legion:1,rows:[{...label,registration:'other-legion',otherLegion:2}]},{legion:1,rows:[{...row,registration:'other-legion'}]});
 assert.equal(s.registrationCorrect,1);assert.equal(s.otherLegionCorrect,0);
});
