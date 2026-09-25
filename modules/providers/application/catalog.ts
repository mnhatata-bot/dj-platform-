import type { SupabaseClient } from '@supabase/supabase-js';
export const providerRoles = ['artist','promoter','venue','community','agency','production','vendor','staff'] as const;
export type ProviderRole = typeof providerRoles[number];
export type ProviderPage = {id:string; owner_user_id:string; role:ProviderRole; slug:string; display_name:string; headline:string; bio:string; city:string; website:string; cover_asset_id:string|null; avatar_asset_id:string|null; status:string};
export type Offering = {id:string; provider_id:string; title:string; description:string; kind:string; price:number; currency:string; image_asset_id:string|null; status:string};
export async function publishedPage(db:SupabaseClient,slug:string) {
 const {data,error}=await db.from('provider_pages').select('*').eq('slug',slug).eq('status','PUBLISHED').maybeSingle();
 if(error) throw new Error('Provider directory unavailable');
 return data as ProviderPage|null;
}
export async function offeringsFor(db:SupabaseClient,providerId:string) {
 const {data,error}=await db.from('provider_offerings').select('*').eq('provider_id',providerId).eq('status','ACTIVE').order('created_at',{ascending:false});
 if(error) throw new Error('Offerings unavailable');
 return (data||[]) as Offering[];
}
export function mediaUrl(id:string|null|undefined) {return id ? `/api/v1/media/${encodeURIComponent(id)}` : undefined;}
