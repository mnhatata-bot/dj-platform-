create table public.custom_domains(
 id uuid primary key default gen_random_uuid(),owner_user_id uuid references public.profiles(id) on delete cascade,organization_id uuid references public.organizations(id) on delete cascade,
 domain text not null unique check(domain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'),target_type text not null check(target_type in ('EPK','PROVIDER_PAGE','CMS_PAGE','ORGANIZATION')),target_id text not null,
 registrar text not null default 'EXTERNAL' check(registrar in ('EXTERNAL','GODADDY')),managed_registration boolean not null default false,
 status text not null default 'REQUESTED' check(status in ('REQUESTED','DNS_REQUIRED','VERIFYING','ACTIVE','FAILED','REMOVED')),verification_token uuid not null default gen_random_uuid(),
 dns_instructions jsonb not null default '[]'::jsonb check(jsonb_typeof(dns_instructions)='array'),vercel_verified boolean not null default false,certificate_status text not null default 'PENDING' check(certificate_status in ('PENDING','ISSUING','ACTIVE','FAILED')),
 auto_renew boolean not null default false,last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),verified_at timestamptz,
 check((owner_user_id is not null)::integer+(organization_id is not null)::integer=1)
);
create index custom_domains_owner on public.custom_domains(owner_user_id,status);create index custom_domains_org on public.custom_domains(organization_id,status);
create table public.domain_dns_records(
 id uuid primary key default gen_random_uuid(),custom_domain_id uuid not null references public.custom_domains(id) on delete cascade,type text not null check(type in ('A','AAAA','CNAME','TXT','MX','CAA')),name text not null,value text not null,ttl integer not null default 600 check(ttl between 60 and 86400),provider_record_id text,status text not null default 'PENDING' check(status in ('PENDING','APPLIED','VERIFIED','FAILED')),last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.platform_jobs(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind ~ '^[A-Z][A-Z0-9_]{2,79}$'),dedupe_key text not null unique,payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
 status text not null default 'PENDING' check(status in ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED')),attempts integer not null default 0 check(attempts between 0 and 20),scheduled_at timestamptz not null default now(),locked_at timestamptz,last_error text,result jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),completed_at timestamptz
);
create index platform_jobs_queue on public.platform_jobs(kind,status,scheduled_at) where status in ('PENDING','PROCESSING');
create table public.media_derivatives(
 id uuid primary key default gen_random_uuid(),media_asset_id uuid not null references public.media_assets(id) on delete cascade,kind text not null check(kind in ('THUMBNAIL','PREVIEW','TRANSCODE')),storage_key text not null unique,mime_type text not null,width integer,height integer,duration_seconds numeric,status text not null default 'READY' check(status in ('PROCESSING','READY','FAILED')),metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),unique(media_asset_id,kind)
);

alter table public.custom_domains enable row level security;alter table public.domain_dns_records enable row level security;alter table public.platform_jobs enable row level security;alter table public.media_derivatives enable row level security;
create policy custom_domain_owner on public.custom_domains for select to authenticated using(public.account_active() and (owner_user_id=(select auth.uid()) or exists(select 1 from public.organization_members m where m.organization_id=custom_domains.organization_id and m.user_id=(select auth.uid()))));
create policy domain_dns_owner on public.domain_dns_records for select to authenticated using(exists(select 1 from public.custom_domains d where d.id=custom_domain_id and (d.owner_user_id=(select auth.uid()) or exists(select 1 from public.organization_members m where m.organization_id=d.organization_id and m.user_id=(select auth.uid())))));
create policy media_derivative_read on public.media_derivatives for select to authenticated using(exists(select 1 from public.media_assets a where a.id=media_asset_id and (a.owner_user_id=(select auth.uid()) or a.visibility='PUBLIC')));
create policy media_derivative_public on public.media_derivatives for select to anon using(exists(select 1 from public.media_assets a where a.id=media_asset_id and a.visibility='PUBLIC'));
revoke all on public.custom_domains,public.domain_dns_records,public.platform_jobs,public.media_derivatives from anon,authenticated;
grant select on public.custom_domains,public.domain_dns_records,public.media_derivatives to authenticated;grant select on public.media_derivatives to anon;
grant select,insert,update,delete on public.custom_domains,public.domain_dns_records,public.platform_jobs,public.media_derivatives to service_role;

create or replace function public.request_custom_domain(p_domain text,p_target_type text,p_target_id text,p_organization uuid default null,p_registrar text default 'EXTERNAL') returns uuid language plpgsql security definer set search_path='' as $$
declare normalized text:=lower(trim(p_domain));result uuid;
begin
 if (select auth.uid()) is null or not public.account_active() then raise exception 'Authentication required';end if;
 if normalized !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$' or p_target_type not in ('EPK','PROVIDER_PAGE','CMS_PAGE','ORGANIZATION') or p_registrar not in ('EXTERNAL','GODADDY') then raise exception 'Invalid domain request';end if;
 if p_organization is not null and not exists(select 1 from public.organization_members where organization_id=p_organization and user_id=(select auth.uid()) and role in ('OWNER','ADMIN','MANAGER')) then raise exception 'Organization permission denied';end if;
 if not public.entitlement_allowed('custom_domain',p_organization) then raise exception 'Custom domain entitlement required';end if;
 if p_target_type='EPK' and not exists(select 1 from public.epks e join public.dj_profiles d on d.id=e.dj_profile_id where e.id=p_target_id::uuid and d.user_id=(select auth.uid())) then raise exception 'EPK permission denied';end if;
 if p_target_type='PROVIDER_PAGE' and not exists(select 1 from public.provider_pages p where p.id=p_target_id::uuid and p.owner_user_id=(select auth.uid())) then raise exception 'Provider page permission denied';end if;
 if p_target_type='ORGANIZATION' and (p_organization is null or p_target_id<>p_organization::text) then raise exception 'Organization target mismatch';end if;
 if p_target_type='CMS_PAGE' and not public.platform_admin() then raise exception 'CMS permission denied';end if;
 insert into public.custom_domains(owner_user_id,organization_id,domain,target_type,target_id,registrar,managed_registration) values(case when p_organization is null then (select auth.uid()) end,p_organization,normalized,p_target_type,p_target_id,p_registrar,false) returning id into result;
 insert into public.platform_jobs(kind,dedupe_key,payload) values('DOMAIN_PROVISION','domain:'||result::text,jsonb_build_object('custom_domain_id',result)) on conflict(dedupe_key) do nothing;return result;
end $$;
revoke all on function public.request_custom_domain(text,text,text,uuid,text) from public,anon;
grant execute on function public.request_custom_domain(text,text,text,uuid,text) to authenticated;

create or replace function public.request_domain_verification(p_domain uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.custom_domains d where d.id=p_domain and (d.owner_user_id=(select auth.uid()) or exists(select 1 from public.organization_members m where m.organization_id=d.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN','MANAGER')))) then raise exception 'Domain permission denied';end if;
 update public.custom_domains set status='VERIFYING',last_error=null,updated_at=now() where id=p_domain;
 insert into public.platform_jobs(kind,dedupe_key,payload,status,attempts,scheduled_at,locked_at,last_error,completed_at) values('DOMAIN_VERIFY','domain:'||p_domain::text,jsonb_build_object('custom_domain_id',p_domain),'PENDING',0,now(),null,null,null)
 on conflict(dedupe_key) do update set kind='DOMAIN_VERIFY',payload=excluded.payload,status='PENDING',attempts=0,scheduled_at=now(),locked_at=null,last_error=null,completed_at=null;
end $$;
revoke all on function public.request_domain_verification(uuid) from public,anon;
grant execute on function public.request_domain_verification(uuid) to authenticated;

create or replace function private.queue_media_processing() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='IMAGE' then insert into public.platform_jobs(kind,dedupe_key,payload) values('IMAGE_THUMBNAIL','thumbnail:'||new.id::text,jsonb_build_object('media_asset_id',new.id,'storage_key',new.storage_key,'mime_type',new.mime_type)) on conflict(dedupe_key) do nothing;
 elsif new.kind='VIDEO' then insert into public.platform_jobs(kind,dedupe_key,payload) values('VIDEO_TRANSCODE','transcode:'||new.id::text,jsonb_build_object('media_asset_id',new.id,'storage_key',new.storage_key,'mime_type',new.mime_type)) on conflict(dedupe_key) do nothing;end if;return new;
end $$;
create trigger queue_media_processing after insert on public.media_assets for each row execute function private.queue_media_processing();

create or replace function public.claim_platform_jobs(p_kinds text[],p_limit integer default 10) returns setof public.platform_jobs language plpgsql security definer set search_path='' as $$
begin
 if current_user not in ('service_role','postgres') then raise exception 'Service role required';end if;
 return query update public.platform_jobs j set status='PROCESSING',attempts=attempts+1,locked_at=now() where id in(select id from public.platform_jobs where kind=any(p_kinds) and (status='PENDING' or (status='PROCESSING' and locked_at<now()-interval '15 minutes')) and scheduled_at<=now() and attempts<8 order by created_at for update skip locked limit greatest(1,least(p_limit,50))) returning j.*;
end $$;
create or replace function public.finish_platform_job(p_id uuid,p_success boolean,p_result jsonb default '{}'::jsonb,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if current_user not in ('service_role','postgres') then raise exception 'Service role required';end if;
 update public.platform_jobs set status=case when p_success then 'COMPLETED' when attempts>=8 then 'FAILED' else 'PENDING' end,result=coalesce(p_result,'{}'::jsonb),last_error=case when p_success then null else left(coalesce(p_error,'Job failed'),2000) end,scheduled_at=case when p_success then scheduled_at else now()+(least(attempts,8)*interval '10 minutes') end,completed_at=case when p_success then now() end where id=p_id and status='PROCESSING';
end $$;
revoke all on function public.claim_platform_jobs(text[],integer),public.finish_platform_job(uuid,boolean,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_platform_jobs(text[],integer),public.finish_platform_job(uuid,boolean,jsonb,text) to service_role;

create or replace function public.admin_list(p_entity text,p_page integer default 0,p_search text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows_json jsonb;total bigint;
begin
 if not public.platform_admin() then raise exception 'Permission denied';end if;
 if p_entity not in ('profiles','dj_profiles','organizations','events','communities','tickets','ticket_orders','opportunities','cms_pages','audit_logs','feature_flags','platform_settings','user_roles','ai_requests','vendor_profiles','vendor_products','vendor_quote_requests','vendor_quotes','my_cuelance_items','operational_logs','provider_pages','provider_offerings','provider_inquiries','provider_catalogs','provider_attribute_definitions','provider_offering_variants','provider_offering_availability','provider_orders','provider_order_history','provider_order_deliverables','beta_access','user_notifications','notification_outbox','agency_roster','agency_calendar_items','agency_offers','agency_offer_history','agency_contracts','agency_deal_messages','agency_deal_documents','custom_domains','domain_dns_records','platform_jobs','media_derivatives') then raise exception 'Invalid resource';end if;
 if p_page<0 or p_page>10000 or length(p_search)>100 then raise exception 'Invalid page';end if;
 execute format('select count(*) from public.%I t where to_jsonb(t)::text ilike $1',p_entity) into total using '%'||p_search||'%';execute format('select coalesce(jsonb_agg(r),''[]'') from (select to_jsonb(t)-''credential_token'' as r from public.%I t where to_jsonb(t)::text ilike $1 order by to_jsonb(t)::text limit 25 offset $2) q',p_entity) into rows_json using '%'||p_search||'%',p_page*25;return jsonb_build_object('rows',rows_json,'total',total);
end $$;
revoke execute on function public.admin_list(text,integer,text) from public,anon;grant execute on function public.admin_list(text,integer,text) to authenticated;
