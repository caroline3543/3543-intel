(function(){
 'use strict';const params=new URLSearchParams(location.search),state=params.get('state'),alliance=params.get('alliance');
 if(!/^\d{1,5}$/.test(state||'') || Number(state)<1 || !alliance || alliance.length>20){document.body.textContent='Choose a state and alliance in the app.';throw Error('Invalid hive workspace')}
 window.HiveEmbed=Object.freeze({stateId:state,alliance,key:`bear-hive-intel:state:${state}:alliance:${encodeURIComponent(alliance)}`});
})();
