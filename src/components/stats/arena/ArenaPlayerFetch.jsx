import {C} from '../../../utils/constants.js';
import {useArenaPlayerFetch} from '../../../hooks/useArenaPlayerFetch.js';
import {arenaButton,arenaInput} from './arenaStyles.js';
export function ArenaPlayerFetch({label,stateId,selectionVersion,selectedFid,onFetched}){
 const {fid,edit,busy,error,fetch}=useArenaPlayerFetch({stateId,selectionVersion,selectedFid,onFetched});
 return <div style={{margin:'8px 0 12px'}}><label style={{fontSize:12}}>{label} player ID<input aria-label={`${label} player ID`} inputMode="numeric" value={fid} onChange={e=>edit(e.target.value)} placeholder="In-game chief ID" style={arenaInput}/></label><button disabled={busy || !/^[1-9]\d{3,14}$/.test(fid.trim())} onClick={()=>void fetch()} style={{...arenaButton,width:'100%',marginTop:6}}>{busy?'Fetching heroes & gear…':`Fetch ${label.toLowerCase()} heroes & gear`}</button>{selectedFid && <p style={{fontSize:11,color:C.muted,margin:'5px 0'}}>Showing ID {selectedFid}{fid.trim()!==selectedFid?' · fetch to change player':''}</p>}{error && <p role="alert" style={{fontSize:12,color:C.red,overflowWrap:'anywhere'}}>{error}</p>}</div>;
}
