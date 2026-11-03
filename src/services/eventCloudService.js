import {activeStateId,normalizeStateId} from './stateWorkspaceService.js';
import {supabase} from './supabaseClient.js';
/** Explicit event-cloud operations. Local event editing is not an implicit cloud write. */
export async function readEventCloudRows(){
 if(!supabase)throw Error('Cloud unavailable');
 const state=normalizeStateId(activeStateId());
 const {data,error}=await supabase.from('events').select('id,data,updated_at').eq('state_id',state);
 if(error)throw Error('Unable to read cloud events');
 return data||[];
}
export async function saveEventCloudIfUnchanged(event,expectedUpdatedAt=null){
 if(!supabase)throw Error('Cloud unavailable');
 const state=normalizeStateId(activeStateId());
 if(!event||!event.id)throw Error('Invalid event');
 const {data,error}=await supabase.rpc('save_event_if_unchanged',{
 p_state:state,p_id:String(event.id),p_alliance_tag:String(event.allianceTags?.[0]||''),
 p_data:event,p_expected_updated_at:expectedUpdatedAt,
 });
 if(error)throw Error('Cloud save failed: '+error.message);
 if(!data)throw Error('Cloud event changed or exists already. Reload before saving.');
 return data;
}
