'use client';
import {useEffect} from 'react';
import {supabase} from '@/lib/supabase';
import {useLocale} from '@/modules/localization/ui/provider';
export default function ErrorPage({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
 const {t}=useLocale();useEffect(()=>{void supabase.rpc('record_operational_log',{p_level:'ERROR',p_area:'page.render',p_message:'Page could not render',p_context:{reference:error.digest||'client'},p_request_path:window.location.pathname});},[error]);
 return <main className="public-body"><section className="card" role="alert"><h1>{t('error')}</h1>{error.digest&&<code>{error.digest}</code>}<div className="actions"><button className="button primary" onClick={reset}>{t('refresh')}</button><a className="button" href="/workspace">{t('page.dashboard')}</a></div></section></main>;
}
