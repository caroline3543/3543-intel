(function(){
 'use strict';const scope=window.HiveEmbed,validate=Hive.validate;
 Hive.validate=function(plan){
  const result=validate(plan);
  if(scope && (String(result.settings.state)!==scope.stateId || result.settings.alliance!==scope.alliance))throw Error('This backup belongs to a different state or alliance. Select its workspace before restoring.');
  return result;
 };
})();
