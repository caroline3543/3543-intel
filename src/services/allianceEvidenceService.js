const valid=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export function allianceEvidence(player){
 const stats=player.providerStats,details=player.providerDetails;
 let evidence=Object.hasOwn(stats||{},'allianceObservation')?stats.allianceObservation:valid(stats?.retrievedAt)&&typeof stats.allianceTag==='string'?{tag:stats.allianceTag.trim(),at:stats.retrievedAt,noAlliance:false}:null;
 const raw=details?.raw?.player;
 if(valid(details?.retrievedAt)&&raw&&(!evidence?.at||Date.parse(details.retrievedAt)>=Date.parse(evidence.at))){
  if(raw.alliance===null)evidence={tag:'',at:details.retrievedAt,noAlliance:true};
  else if(typeof raw.alliance?.abbr==='string')evidence={tag:raw.alliance.abbr.trim(),at:details.retrievedAt,noAlliance:!raw.alliance.abbr.trim()};
 }
 return evidence&&valid(evidence.at)?evidence:{tag:'',at:null,noAlliance:false};
}
