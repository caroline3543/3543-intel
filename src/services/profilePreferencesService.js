import {supabase} from './supabaseClient.js';
import {normalizeProfileSectionOrder} from './profileSectionOrder.js';

// Never accept a caller-supplied user ID. Supabase RLS independently checks
// auth.uid() for every read and write.
export async function profilePreferenceIdentity(){
 if(!supabase)return null;
 const {data,error}=await supabase.auth.getUser();
 if(error)throw error;
 return data.user?.id||null;
}
export async function loadProfileSectionOrder(){
 const id=await profilePreferenceIdentity();
 if(!id)return {status:'signed-out',order:normalizeProfileSectionOrder()};
 const {data,error}=await supabase.from('organiser_profile_preferences')
   .select('section_order').eq('user_id',id).maybeSingle();
 if(error)throw error;
 return {status:'ready',order:normalizeProfileSectionOrder(data?.section_order)};
}
export async function saveProfileSectionOrder(order){
 const id=await profilePreferenceIdentity();
 if(!id)throw Error('Sign in before saving your profile layout.');
 const normalized=normalizeProfileSectionOrder(order);
 const {error}=await supabase.from('organiser_profile_preferences')
   .upsert({user_id:id,section_order:normalized,updated_at:new Date().toISOString()},{onConflict:'user_id'});
 if(error)throw error;
 return normalized;
}
