const KEY='caroline3573_preferences_v1';
export function readPreferences(storage=localStorage){
  try{const value=JSON.parse(storage.getItem(KEY)||'{}');return {tutorialSeen:value.tutorialSeen===true,haptics:value.haptics!==false};}catch{return {tutorialSeen:false,haptics:true};}
}
export function savePreferences(patch,storage=localStorage){
  const next={...readPreferences(storage),...patch};
  try{storage.setItem(KEY,JSON.stringify(next));}catch{/* Preferences must never prevent roster use. */}
  return next;
}
export function tapFeedback(enabled,navigatorObject=navigator){
  if(!enabled||typeof navigatorObject.vibrate!=='function')return false;
  try{return navigatorObject.vibrate(8);}catch{return false;}
}
