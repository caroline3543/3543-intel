// Input contains independently labelled candidate outcomes, never images or fingerprints.
export function scoreAvatarIdentity(cases){
 const seen=new Set();
 let eligible=0,correct=0,incorrect=0,abstained=0,unavailable=0;
 for(const c of cases){
  if(!c.caseId||seen.has(c.caseId)||!Array.isArray(c.candidateIds)||!c.expectedId)throw Error('Invalid or duplicate labelled case');
  seen.add(c.caseId);
  if(!c.candidateIds.includes(c.expectedId))throw Error('Expected identity absent from shortlist');
  if(c.suggestedId!=null&&!c.candidateIds.includes(c.suggestedId))throw Error('Suggestion outside shortlist');
  eligible++;
  if(c.suggestedId==null){abstained++;if(c.unavailable)unavailable++;}
  else if(c.suggestedId===c.expectedId)correct++;
  else incorrect++;
 }
 return {eligible,correct,incorrect,abstained,unavailable,coverage:eligible?correct/eligible:0,precision:correct+incorrect?correct/(correct+incorrect):null};
}
