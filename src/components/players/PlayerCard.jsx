import { C, FC_BADGE_IMAGES } from '../../utils/constants.js';
import { FC_OPTIONS } from '../../utils/constants.js';
import { PlayerAvatar } from './PlayerAvatar.jsx';
import { useState } from 'react';
function isFullyMatchedHelios(troops) {
  const set = troops.filter(Boolean);
  return set.length === 3 && set.every(t => t.startsWith('Helios')) && set.every(t => t === set[0]);
}

// Troop progression groups: matching Helios, partial Helios, then other troops.
export function getPriorityTier(player) {
  const troops = [player.troops?.infantry, player.troops?.lancer, player.troops?.marksman];
  const heliosCount = troops.filter(t => t && t.startsWith('Helios')).length;
  if (heliosCount === 0) return 3;
  if (isFullyMatchedHelios(troops)) return 1;
  return 2;
}

// Keep the existing progression tie-break for players at the same furnace.
function isFullyUpgraded(player) {
  const set = [player.troops?.infantry, player.troops?.lancer, player.troops?.marksman].filter(Boolean);
  if (set.length < 2) return true;
  return set.every(t => t === set[0]);
}

// FC_OPTIONS is defined highest-first in constants.js, so a lower
// index means a HIGHER furnace level — this rank is used directly as
// a sort key (lower = better), not inverted.
function furnaceRank(fc) {
  const i = FC_OPTIONS.indexOf(fc);
  return i === -1 ? FC_OPTIONS.length : i; // unset/unknown sorts last
}

// Full sort key for the Priority sort option in RosterTab — tier
// first (1 before 2 before 3), then furnace level (higher first),
// then fully-upgraded before partially-upgraded at the same level,
// then name as the final tiebreak.
export function prioritySortKey(player) {
  return {
    tier: getPriorityTier(player),
    furnaceRank: furnaceRank(player.furnaceLevel),
    upgradeGap: isFullyUpgraded(player) ? 0 : 1,
  };
}

export function comparePriority(a, b) {
  const ka = prioritySortKey(a), kb = prioritySortKey(b);
  if (ka.tier !== kb.tier) return ka.tier - kb.tier;
  if (ka.furnaceRank !== kb.furnaceRank) return ka.furnaceRank - kb.furnaceRank;
  if (ka.upgradeGap !== kb.upgradeGap) return ka.upgradeGap - kb.upgradeGap;
  return (a.username || a.alias || '').localeCompare(b.username || b.alias || '');
}


const compact=value=>Number(value).toLocaleString('en-US',{notation:'compact',maximumFractionDigits:1});
const control={minHeight:44,minWidth:44,borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,padding:10,fontSize:14,cursor:'pointer'};
export function PlayerCard({player,onClick,onDelete,missingCount,onToggleRallyLead,onOpenFields,bulkMode,isSelected}) {
  const [menu,setMenu]=useState(false);
  const name=player.username||player.alias||'Unknown';
  const leader=player.roles?.includes('Rally Lead');
  const heroes=(player.joinerHeroes||[]).filter(h=>h.skillLevel>=5);
  const power=player.power??player.providerStats?.power;
  return <article style={{background:isSelected?C.gold+'18':C.card,border:`1px solid ${isSelected?C.gold:C.border}`,borderRadius:12,marginBottom:10,padding:12}}>
    <div style={{display:'flex',gap:10,alignItems:'center'}}>
      <button onClick={onClick} aria-label={bulkMode?`${isSelected?'Deselect':'Select'} ${name}`:`Open ${name}`} aria-pressed={bulkMode?isSelected:undefined} style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0,textAlign:'left',border:0,background:'none',padding:0,minHeight:48,color:C.white,cursor:'pointer'}}>
        {bulkMode?<span aria-hidden="true" style={{fontSize:22,color:isSelected?C.gold:C.icy}}>{isSelected?'☑':'☐'}</span>:<PlayerAvatar player={player} size={44}/>}
        <span style={{flex:1,minWidth:0}}>
          <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:16,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>{player.furnaceLevel && (FC_BADGE_IMAGES[player.furnaceLevel]?<img src={FC_BADGE_IMAGES[player.furnaceLevel]} alt={player.furnaceLevel} style={{width:24,height:24,flexShrink:0}}/>:<span style={{fontSize:13,color:C.gold,flexShrink:0}}>{player.furnaceLevel}</span>)}</span>
          <span style={{display:'block',fontSize:14,color:C.icy,marginTop:4}}>{player.allianceTag?`[${player.allianceTag}]`:'Alliance unknown'}{power!=null?` · Power ${compact(power)}`:''}</span>
        </span>
      </button>
      {!bulkMode && <button style={control} aria-label={`Options for ${name}`} aria-expanded={menu} onClick={()=>setMenu(!menu)}>•••</button>}
    </div>
    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>{[['Inf','infantry',C.inf],['Lan','lancer',C.lan],['Mar','marksman',C.mar]].map(([label,key,color])=><span key={key} style={{fontSize:13,color:C.icy,background:C.section,borderRadius:6,padding:'5px 7px'}}><span style={{color}}>{label}</span> {player.troops?.[key]||'Unknown'}</span>)}</div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginTop:8}}>
      {player.blacklisted?<span style={{fontSize:13,color:C.red}}>Excluded from battle plans</span>:leader?<span style={{fontSize:13,color:C.gold}}>Rally leader</span>:null}
      {heroes.length>0&&<span style={{fontSize:13,color:C.icy}}>{heroes.length} Skill 5 joiner {heroes.length===1?'hero':'heroes'}</span>}
      {missingCount>0&&<button style={{...control,color:C.gold}} onClick={onOpenFields}>Review {missingCount} {missingCount===1?'field':'fields'}</button>}
    </div>
    {menu&&!bulkMode && <div style={{display:'grid',gap:8,marginTop:10}}>
      <button style={control} onClick={()=>{onToggleRallyLead?.();setMenu(false);}}>{leader?'Remove rally leader role':'Set as rally leader'}</button>
      <button style={{...control,color:C.red}} onClick={()=>{setMenu(false);onDelete(player.id);}}>Remove from roster…</button>
    </div>}
  </article>;
}
