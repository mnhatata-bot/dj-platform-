'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {useLocale} from '@/modules/localization/ui/provider';
import {ModuleHeading,Status} from '@/modules/ui/guided';
type Inquiry={id:string;message:string;reply:string;status:string;created_at:string};
export default function MyInquiries(){const {t}=useLocale();const [items,setItems]=useState<Inquiry[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 async function load(){setLoading(true);setError('');try{const {data}=await supabase.auth.getUser();if(!data.user)throw new Error(t('signin'));const r=await supabase.from('provider_inquiries').select('id,message,reply,status,created_at').eq('requester_user_id',data.user.id).order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;setItems(r.data||[]);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 return <><ModuleHeading title={t('page.myInquiries')} help={t('page.inquiryHelp')}/><button className="button" disabled={loading} onClick={load}>{t('refresh')}</button><Status text={error} error/>{loading?<p>{t('loading')}</p>:!items.length?<p>{t('empty')}</p>:items.map(i=><article className="card" key={i.id}><small>{new Date(i.created_at).toLocaleString()} · {i.status}</small><p className="preserve-lines">{i.message}</p><h3>{t('page.reply')}</h3><p className="preserve-lines">{i.reply||t('page.awaiting')}</p></article>)}</>;
}
