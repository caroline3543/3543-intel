const names={en:'English',zh:'Chinese','zh-CN':'Chinese (Simplified)','zh-TW':'Chinese (Traditional)',es:'Spanish',pt:'Portuguese',ru:'Russian',ar:'Arabic',tr:'Turkish',de:'German',fr:'French',id:'Indonesian',vi:'Vietnamese',th:'Thai',ko:'Korean',ja:'Japanese',pl:'Polish',it:'Italian',nl:'Dutch',hi:'Hindi',ms:'Malay',uk:'Ukrainian',cs:'Czech',ro:'Romanian',sv:'Swedish',fi:'Finnish',da:'Danish',no:'Norwegian',hu:'Hungarian',el:'Greek',he:'Hebrew'};
export function gameLanguageCode(value){
 if(typeof value!=='string' || !value.trim())return null;
 const raw=value.trim(),named=Object.entries(names).find(([,name])=>name.toLowerCase()===raw.toLowerCase());
 if(named)return named[0];
 const code=raw.replaceAll('_','-');
 if(!/^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/i.test(code))return null;
 try{return Intl.getCanonicalLocales(code)[0]}catch{return null}
}
export function gameLanguageName(value){
 const code=gameLanguageCode(value);if(!code)return null;
 if(names[code])return names[code];if(names[code.split('-')[0]])return names[code.split('-')[0]];
 try{const name=new Intl.DisplayNames(['en'],{type:'language',fallback:'none'}).of(code);return name || `Game language (${code})`}catch{return `Game language (${code})`}
}
export function providerField(player,key){
 const records=[{raw:player.providerDetails?.raw?.player,at:player.providerDetails?.retrievedAt},{raw:player.providerStats?.raw,at:player.providerStats?.retrievedAt}];
 return records.filter(r=>r.raw?.[key]!=null && r.raw[key]!=='').sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0))[0]?.raw?.[key];
}
export function withGameLanguage(player,previousCode=player.gameLanguage){
 const code=gameLanguageCode(providerField(player,'language')) || gameLanguageCode(player.gameLanguage);
 if(!code)return player;
 const name=gameLanguageName(code),oldName=gameLanguageName(previousCode);
 const additional=(player.languages || []).filter(l=>l!==oldName && l!==name);
 const languages=[name,...new Set(additional)];
 if(code===player.gameLanguage && JSON.stringify(languages)===JSON.stringify(player.languages))return player;
 return {...player,gameLanguage:code,languages};
}
