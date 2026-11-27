import {avatarDistance} from './avatarFingerprint.js';
// Advisory only: thresholds are experimental and never authorize an identity.
export function rankAvatarEvidence(screenshot,references,{maxDistance=.18,minMargin=.08}={}){
 const ranked=references.map(r=>({id:r.id,distance:avatarDistance(screenshot,r.fingerprint)}))
 .filter(r=>r.id!=null&&r.distance!==null).sort((a,b)=>a.distance-b.distance);
 const first=ranked[0],second=ranked[1];
 if(!first||first.distance>maxDistance)return {ranked,recommendedId:null,reason:'no-close-reference'};
 if(second&&second.distance-first.distance<minMargin)return {ranked,recommendedId:null,reason:'ambiguous-reference'};
 return {ranked,recommendedId:first.id,reason:'advisory-only'};
}
