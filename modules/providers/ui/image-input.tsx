'use client';
import { useId,useState } from 'react';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api-client';
import { useLocale } from '@/modules/localization/ui/provider';
import { Visual } from './visual';
import { mediaUrl } from '../application/catalog';
export default function ImageInput({value,onChange,label}:{value:string|null;onChange:(id:string|null)=>void;label:string}) {
 const {t}=useLocale(); const id=useId();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function upload(file:File){
  setBusy(true);setError('');
  try {
   const ext=file.name.split('.').pop()?.toLowerCase();
   if(!ext || !['jpg','jpeg','png','webp'].includes(ext)||!file.size||file.size>10485760) throw new Error(t('page.imageHelp'));
   const {data}=await supabase.auth.getUser();if(!data.user)throw new Error(t('signin'));
   const key=`${data.user.id}/${crypto.randomUUID()}.${ext}`;
   const result=await supabase.storage.from('media').upload(key,file,{upsert:false});if(result.error)throw result.error;
   let asset:{id:string};
   try{asset=await api('/api/v1/media/complete',{key,name:file.name.slice(0,160),alt:label});}catch(e){await supabase.storage.from('media').remove([key]);throw e;}
   const publish=await supabase.from('media_assets').update({visibility:'PUBLIC'}).eq('id',asset.id).select('id').single();if(publish.error)throw publish.error;
   onChange(asset.id);
  } catch(e){setError(e instanceof Error?e.message:t('error'));}finally{setBusy(false);}
 }
 return <div className="image-input"><label htmlFor={id}>{label}</label><Visual src={mediaUrl(value)} alt={label}/><input id={id} type="file" disabled={busy} accept=".jpg,.jpeg,.png,.webp" aria-describedby={`${id}-help`} onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0]);e.target.value='';}}/><small id={`${id}-help`}>{t('page.imageHelp')}</small>{busy&&<p role="status">{t('working')}</p>}{error&&<p role="alert">{error}</p>}{value&&<button type="button" className="button small" onClick={()=>onChange(null)}>{t('remove')}</button>}</div>;
}
