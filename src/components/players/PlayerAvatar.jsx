import { useState } from 'react';
import { playerAvatarUrl } from '../../services/playerAvatarService.js';
import { C } from '../../utils/constants.js';
export function PlayerAvatar({player, size=46, color=C.muted, bordered=false}) {
  const [failedUrl, setFailedUrl] = useState(null);
  const src = playerAvatarUrl(player);
  const name = player?.username || player?.alias || 'Unknown player';
  const initials = name.split(/\s+/).map(word=>word[0] || '').join('').slice(0,2).toUpperCase() || '?';
  return <div style={{width:size,height:size,borderRadius:'50%',background:color+'33',border:bordered?`2px solid ${color}`:undefined,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:Math.round(size*.38),color:C.white,flexShrink:0,overflow:'hidden'}}>
    {src && src !== failedUrl
      ? <img src={src} alt={`${name}'s in-game profile picture`} width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailedUrl(src)} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
      : <span aria-label={name}>{initials}</span>}
  </div>;
}
