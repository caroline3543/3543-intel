import {rankAvatarEvidence} from './avatarCandidateEvidence.js';
// No automatic identity selection, no persisted evidence, no roster mutation.
export async function reviewAvatarSuggestions({fingerprint,candidates,referenceCache,signal}){
 if(!fingerprint||signal?.aborted||!referenceCache)return null;
 const unique=[...new Map(candidates.filter(p=>p?.id!=null).map(p=>[p.id,p])).values()];
 // Compare only a small existing username shortlist. Do not imply global uniqueness.
 if(unique.length<2||unique.length>8)return null;
 const references=[];
 for(let i=0;i<unique.length;i+=2){
  if(signal?.aborted)return null;
  const pair=await Promise.all(unique.slice(i,i+2).map(async p=>({id:p.id,fingerprint:await referenceCache.get(p)})));
  references.push(...pair);
 }
 if(signal?.aborted||references.some(r=>!r.fingerprint))return null;
 const result=rankAvatarEvidence(fingerprint,references);
 return result.recommendedId==null?null:{candidateId:result.recommendedId,scope:'username-shortlist',advisory:true};
}
