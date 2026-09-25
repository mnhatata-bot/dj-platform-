import {notFound} from 'next/navigation';
import {database} from '@/lib/server-auth';
import {publishedPage,offeringsFor} from '@/modules/providers/application/catalog';
import PublicProvider from '@/modules/providers/ui/public-page';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const page=await publishedPage(database(),slug);return {title:page?`${page.display_name} | Cuelance`:'Cuelance',description:page?.headline,alternates:{canonical:`https://www.cuelance.com/p/${encodeURIComponent(slug)}`},openGraph:{title:page?.display_name,description:page?.headline}};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const db=database();const page=await publishedPage(db,slug);if(!page)notFound();const offerings=await offeringsFor(db,page.id);return <PublicProvider page={page} offerings={offerings}/>;}
