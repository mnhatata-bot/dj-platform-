'use client';
import {useState} from 'react';
import {supabase} from '@/lib/supabase';
import {useLocale} from '@/modules/localization/ui/provider';
import ImageInput from '@/modules/providers/ui/image-input';
import {mediaUrl} from '@/modules/providers/application/catalog';
export default function EventArtwork({event,onSaved}:{event:{id:string;banner_url?:string|null;description?:string|null};onSaved:()=>void}){
 const {t}=useLocale();const [image,setImage]=useState<string|null>(event.banner_url?.startsWith('/api/v1/media/')?event.banner_url.slice(14):null);const [changed,setChanged]=useState(false);const [description,setDescription]=useState(event.description||'');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 async function save(){setBusy(true);setError('');setNotice('');try{const patch={description,...(changed?{banner_url:mediaUrl(image)||null}:{})};const r=await supabase.from('events').update(patch).eq('id',event.id).select('id').single();if(r.error)throw r.error;setNotice(t('saved'));onSaved();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <form className="module-form" onSubmit={e=>{e.preventDefault();void save();}}><ImageInput label={t('event.cover')} value={image} onChange={id=>{setImage(id);setChanged(true);}}/><label>{t('event.description')}<textarea rows={4} value={description} maxLength={6000} onChange={e=>setDescription(e.target.value)}/></label><button className="button primary" disabled={busy}>{t('save')}</button>{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}</form>;
}
