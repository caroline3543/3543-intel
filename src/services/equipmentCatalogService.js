import catalog from '../data/heroCatalog.json' with {type:'json'};
import {normalizeAvatarUrl} from './playerAvatarService.js';
const CDN='https://raw.githubusercontent.com/chiefpansancolt/whiteout-survival-data/b686c68ba1cc955ee75cf2725a4cd0210ec7cd1e';
const image=path=>path?CDN+path.split('/').map(encodeURIComponent).join('/'):null;
const text=value=>typeof value==='string' && value.trim()?value.trim():null;
const num=value=>['string','number'].includes(typeof value) && String(value).trim()!=='' && Number.isFinite(Number(value))?Number(value):null;
function label(value){const s=text(value);return s && !/^\d+$/.test(s) && !/^(hero|gear|equipment|widget|skill)[\s#_-]*\d+$/i.test(s)?s:null;}
const byName=new Map(Object.values(catalog).flatMap(h=>[[h.name.toLowerCase().replace(/[^a-z]/g,''),h],[h.slug,h]]));
export function interpretHero(raw={}){
 const hero=raw && typeof raw==='object'?raw:{id:raw};
 const reportedGear=hero.gear ?? hero.gear_tiles ?? hero.equipment;
 const widgetTile=Array.isArray(reportedGear)?reportedGear.find(x=>x?.exclusive):null;
 const known=catalog[String(hero.id ?? hero.hero_id)] || byName.get(String(hero.name || (/^[a-z][a-z -]*$/i.test(String(hero.id))?hero.id:'')).toLowerCase().replace(/[^a-z]/g,''));
 return {...hero,name:known?.name || label(hero.name) || 'Unidentified hero',icon:normalizeAvatarUrl(hero.icon) || image(known?.image),catalogued:!!known,
  troop:known?.troop || label(hero.troop_label),generation:known?.generation,rarity:known?.rarity,
  level:hero.level ?? hero.hero_level ?? hero.lv,position:hero.position ?? hero.pos,
  widgetName:label(hero.exclusive_gear?.name) || known?.widget?.name || 'Exclusive widget',widgetIcon:normalizeAvatarUrl(hero.exclusive_gear?.icon) || image(known?.widget?.image),
  widgetLevel:hero.exclusive_gear_level ?? hero.exclusive_gear?.level ?? hero.widget_level ?? hero.widget_lv ?? hero.exclusive_equip_lv ?? hero.exclusive_lv ?? widgetTile?.gear_level ?? widgetTile?.slv,
  hasWidget:hero.exclusive_gear!=null || hero.exclusive_equip!=null || hero.exclusive_gear_level!=null || hero.widget_level!=null || hero.widget_lv!=null || hero.exclusive_equip_lv!=null || widgetTile!=null,
  gear:(Array.isArray(reportedGear)?reportedGear:[]).filter(x=>x && typeof x==='object' && !x.exclusive).map(x=>interpretHeroGear(x,known?.troop))};
}
export function interpretHeroGear(item={},heroTroop){
 const eid=String(item.eid ?? ''),match=/^10([1-4])([1-3])([1-5])\d{2}$/.exec(eid);
 const slots={1:'Goggles',2:'Gloves',3:'Belt',4:'Boots'},troops={1:'Infantry',2:'Lancer',3:'Marksman'};
 const rawSlot=item.slot ?? item.sid,slot=slots[rawSlot] || (match?slots[match[1]]:null) || label(rawSlot);
 const troop=label(item.troop_label) || troops[item.troop] || (match?troops[match[2]]:null) || heroTroop;
 const enhancement=num(item.enhancement_level ?? item.gear_level ?? item.slv),red=item.red===true || (enhancement!=null && enhancement>=101);
 const quality=red?'Red':label(item.quality_label) || label(item.quality) || {1:'Common',2:'Uncommon',3:'Rare',4:'Epic',5:'Mythic'}[match?.[3] ?? item.quality];
 const slotKey={Goggles:'goggles',Helmet:'goggles',Gloves:'gloves',Belt:'belt',Armor:'belt',Boots:'boots'}[slot];
 const path=slotKey && ['Infantry','Lancer','Marksman'].includes(troop)?`/images/hero-gear/${slotKey}-${troop.toLowerCase()}.png`:null;
 return {...item,name:label(item.name) || slot || 'Unidentified equipment',icon:normalizeAvatarUrl(item.icon) || image(path),troop,quality,red,
 enhancement:enhancement==null?null:enhancement>=101?enhancement-100:enhancement,mastery:item.refine_level ?? item.rlv};
}
export function interpretedStars(hero){
 if(label(hero.star_label))return hero.star_label;
 const stars=num(hero.stars);if(stars!=null && stars>=0 && stars<=5)return `${stars} ★`;
 const raw=num(hero.star_raw ?? hero.star);
 if(raw==null || !Number.isInteger(raw) || raw<0 || raw>30)return null;
 const whole=Math.floor(raw/6),tier=raw%6;return tier?`${whole} ★ · tier ${tier}/6`:`${whole} ★`;
}
export function interpretChiefGear(item={}){
 const raw=num(item.strength_level) ?? (/^\d+$/.test(String(item.equipid))?Number(item.equipid)%100:null);
 const q=num(item.quality) ?? (raw==null?null:raw<=2?2:raw<=6?3:raw<=14?4:raw<=30?5:6);
 const quality=label(item.quality_label) || label(item.quality) || {2:'Green',3:'Blue',4:'Purple',5:'Gold',6:'Red'}[q];
 const tier=label(item.tier) || (raw==null?null:raw>=35?`${quality || 'Chief gear'} T${Math.min(6,Math.floor((raw-35)/4)+1)}`:raw>=19?`${quality || 'Chief gear'} T${Math.floor((raw-19)/4)+1}`:raw>=11 && raw<=14?'Purple T1':quality);
 const slot=label(item.slot),name=label(item.name) || slot || 'Chief equipment';
 const key={cap:'Cap',helmet:'Cap',watch:'Watch',coat:'Coat',armor:'Coat',pants:'Pants',ring:'Ring',weapon:'Weapon'}[name.toLowerCase()];
 const rarity={Green:'Common',Blue:'Rare',Purple:'Epic',Gold:'Mythic',Red:'Legendary'}[quality];
 return {...item,name,quality,tier,icon:normalizeAvatarUrl(item.icon) || (key && rarity?image(`/images/chief-gear/${key}-${rarity}.png`):null)};
}
