import {notFound} from 'next/navigation';
import {database} from '@/lib/server-auth';
import PublicEvent from '@/modules/events/ui/public-event';
export const dynamic='force-dynamic';
async function getEvent(slug:string){const {data,error}=await database().from('events').select('id,title,description,banner_url,venue,city,address,starts_at,timezone,status').eq('slug',slug).eq('visibility','PUBLIC').in('status',['PUBLISHED','LIVE','ENDED']).maybeSingle();if(error)throw new Error('Events unavailable');return data;}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const event=await getEvent(slug);return {title:event?`${event.title} | Cuelance`:'Cuelance',description:event?.description,alternates:{canonical:`https://www.cuelance.com/events/${encodeURIComponent(slug)}`}};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const event=await getEvent(slug);if(!event)notFound();const {data,error}=await database().from('ticket_types').select('id,name,description,price,currency,capacity,quantity_sold,status').eq('event_id',event.id).eq('status','ACTIVE');if(error)throw new Error('Ticket types unavailable');return <PublicEvent event={event} types={event.status==='ENDED'?[]:data||[]}/>;}
