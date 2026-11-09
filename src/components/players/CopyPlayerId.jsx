import {useState} from 'react';
import {C} from '../../utils/constants.js';
import {profileButton} from './ProfileParts.jsx';
export function CopyPlayerId({fid}) {
  const [status,setStatus]=useState('');
  if(!fid)return null;
  async function copy(){
    try { await navigator.clipboard.writeText(String(fid)); setStatus('Copied'); }
    catch { setStatus('Select the ID to copy it.'); }
  }
  return <div style={{marginTop:8}}>
    <button type="button" onClick={copy} aria-label={`Copy player ID ${fid}`} style={{...profileButton,width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
      <span style={{color:C.icy}}>Player ID</span><span style={{color:C.white}}>{fid}</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
    </button>
    {status&&<span role="status" style={{display:'block',fontSize:13,color:C.icy,marginTop:6}}>{status}</span>}
    {status==='Select the ID to copy it.'&&<input aria-label="Player ID for manual copying" readOnly value={String(fid)} onFocus={e=>e.target.select()} style={{...profileButton,width:'100%',boxSizing:'border-box',fontSize:16,marginTop:6}}/>}
  </div>;
}
