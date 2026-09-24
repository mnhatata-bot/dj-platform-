-- Cuelance V2.2: Vendor OS, B2B/B2C marketplace and My Cuelance consumer hub.
create table if not exists public.vendor_profiles (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 capabilities text[] not null default array[]::text[],
 service_categories text[] not null default array[]::text[],
 service_areas text[] not null default array[]::text[],
 verification_status text not null default 'PENDING' check (verification_status in ('PENDING','APPROVED','REJECTED','SUSPENDED')),
 storefront_status text not null default 'DRAFT' check (storefront_status in ('DRAFT','PUBLISHED','PAUSED')),
 commercial_settings jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id)
);
create table if not exists public.vendor_products (
 id uuid primary key default gen_random_uuid(),
 vendor_id uuid not null references public.vendor_profiles(id) on delete cascade,
 name text not null check (length(btrim(name)) between 2 and 140),
 category text not null,
 offering_type text not null check (offering_type in ('B2B_RENTAL','B2B_SERVICE','B2C_PRODUCT','B2C_EXPERIENCE')),
 description text,
 price numeric(12,2) not null default 0 check (price >= 0),
 currency text not null default 'SAR',
 deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
 inventory_quantity integer not null default 1 check (inventory_quantity >= 0),
 status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.vendor_quote_requests (
 id uuid primary key default gen_random_uuid(),
 buyer_organization_id uuid references public.organizations(id) on delete set null,
 requester_user_id uuid not null references public.profiles(id),
 event_id uuid references public.events(id) on delete set null,
 requirement text not null check (length(btrim(requirement)) between 3 and 2000),
 needed_at timestamptz,
 city text,
 status text not null default 'REQUESTED' check (status in ('REQUESTED','QUOTED','APPROVED','DECLINED','CANCELLED','FULFILLED')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.vendor_quotes (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.vendor_quote_requests(id) on delete cascade,
 vendor_id uuid not null references public.vendor_profiles(id) on delete cascade,
 amount numeric(12,2) not null check (amount >= 0),
 currency text not null default 'SAR',
 message text not null default '',
 status text not null default 'SUBMITTED' check (status in ('SUBMITTED','REVISED','APPROVED','DECLINED','EXPIRED')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(request_id,vendor_id)
);
create table if not exists public.my_cuelance_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 item_type text not null check (item_type in ('TICKET','EVENT','COMMUNITY','FORM','ORDER','BENEFIT','FOLLOW','MESSAGE')),
 title text not null check (length(btrim(title)) between 2 and 180),
 status text not null default 'ACTIVE',
 resource_type text,
 resource_id uuid,
 metadata jsonb not null default '{}'::jsonb,
 starts_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists vendor_products_vendor_status on public.vendor_products(vendor_id,status);
create index if not exists vendor_quote_requests_user_date on public.vendor_quote_requests(requester_user_id,created_at desc);
create index if not exists vendor_quotes_request on public.vendor_quotes(request_id,status);
create index if not exists my_cuelance_user_type_date on public.my_cuelance_items(user_id,item_type,created_at desc);

alter table public.vendor_profiles enable row level security;
alter table public.vendor_products enable row level security;
alter table public.vendor_quote_requests enable row level security;
alter table public.vendor_quotes enable row level security;
alter table public.my_cuelance_items enable row level security;

create or replace function public.is_org_member(p_org uuid, p_roles text[] default null) returns boolean
language sql stable security definer set search_path='' as $$
 select public.account_active() and exists (
  select 1 from public.organization_members m
  where m.organization_id = p_org and m.user_id = auth.uid()
  and (p_roles is null or m.role = any(p_roles))
 )
$$;
revoke all on function public.is_org_member(uuid,text[]) from public;
grant execute on function public.is_org_member(uuid,text[]) to authenticated;

create policy vendor_profiles_public_read on public.vendor_profiles
 for select to anon, authenticated using (storefront_status='PUBLISHED' and verification_status='APPROVED');
create policy vendor_profiles_member_read on public.vendor_profiles
 for select to authenticated using (public.is_org_member(organization_id) or public.platform_admin());
create policy vendor_profiles_member_write on public.vendor_profiles
 for all to authenticated
 using (public.is_org_member(organization_id, array['OWNER','ADMIN','MANAGER','EDITOR']) or public.platform_admin())
 with check (public.is_org_member(organization_id, array['OWNER','ADMIN','MANAGER','EDITOR']) or public.platform_admin());

create policy vendor_products_public_read on public.vendor_products
 for select to anon, authenticated using (
  status='ACTIVE' and exists (
   select 1 from public.vendor_profiles v
   where v.id=vendor_id and v.storefront_status='PUBLISHED' and v.verification_status='APPROVED'
  )
 );
create policy vendor_products_member_read on public.vendor_products
 for select to authenticated using (
  exists(select 1 from public.vendor_profiles v where v.id=vendor_id and public.is_org_member(v.organization_id))
  or public.platform_admin()
 );
create policy vendor_products_member_write on public.vendor_products
 for all to authenticated
 using (
  exists(select 1 from public.vendor_profiles v where v.id=vendor_id and public.is_org_member(v.organization_id,array['OWNER','ADMIN','MANAGER','EDITOR']))
  or public.platform_admin()
 )
 with check (
  exists(select 1 from public.vendor_profiles v where v.id=vendor_id and public.is_org_member(v.organization_id,array['OWNER','ADMIN','MANAGER','EDITOR']))
  or public.platform_admin()
 );

create policy rfq_owner_read on public.vendor_quote_requests
 for select to authenticated using (requester_user_id=auth.uid() or public.is_org_member(buyer_organization_id) or public.platform_admin());
create policy rfq_create on public.vendor_quote_requests
 for insert to authenticated with check (requester_user_id=auth.uid() and public.account_active());
create policy rfq_owner_update on public.vendor_quote_requests
 for update to authenticated using (requester_user_id=auth.uid() or public.is_org_member(buyer_organization_id,array['OWNER','ADMIN','MANAGER'])) with check (requester_user_id=auth.uid() or public.is_org_member(buyer_organization_id,array['OWNER','ADMIN','MANAGER']));

create policy quotes_participant_read on public.vendor_quotes
 for select to authenticated using (
  exists(select 1 from public.vendor_quote_requests r where r.id=request_id and (r.requester_user_id=auth.uid() or public.is_org_member(r.buyer_organization_id)))
  or exists(select 1 from public.vendor_profiles v where v.id=vendor_id and public.is_org_member(v.organization_id))
  or public.platform_admin()
 );
create policy quotes_vendor_write on public.vendor_quotes
 for all to authenticated
 using (exists(select 1 from public.vendor_profiles v where v.id=vendor_id and public.is_org_member(v.organization_id,array['OWNER','ADMIN','MANAGER','EDITOR'])) or public.platform_admin())
 with check (exists(select 1 from public.vendor_profiles v where v.id=vendor_id and public.is_org_member(v.organization_id,array['OWNER','ADMIN','MANAGER','EDITOR'])) or public.platform_admin());

create policy my_cuelance_own_read on public.my_cuelance_items
 for select to authenticated using (user_id=auth.uid() and public.account_active());
create policy my_cuelance_own_insert on public.my_cuelance_items
 for insert to authenticated with check (user_id=auth.uid() and public.account_active());

create or replace function public.upsert_vendor_profile(
 p_organization uuid,
 p_capabilities text[],
 p_categories text[],
 p_areas text[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.is_org_member(p_organization,array['OWNER','ADMIN','MANAGER','EDITOR']) then raise exception 'Permission denied'; end if;
 insert into public.vendor_profiles(organization_id,capabilities,service_categories,service_areas,verification_status,storefront_status)
 values(p_organization,p_capabilities,p_categories,p_areas,'APPROVED','PUBLISHED')
 on conflict(organization_id) do update set capabilities=excluded.capabilities,service_categories=excluded.service_categories,service_areas=excluded.service_areas,updated_at=now()
 returning id into result;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'vendor.upsert','vendor_profile',result::text,jsonb_build_object('organization_id',p_organization,'capabilities',p_capabilities));
 return result;
end $$;

create or replace function public.create_vendor_rfq(
 p_buyer_org uuid,
 p_requirement text,
 p_city text default null,
 p_needed_at timestamptz default null,
 p_event uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.account_active() then raise exception 'Account unavailable'; end if;
 if p_buyer_org is not null and not public.is_org_member(p_buyer_org,array['OWNER','ADMIN','MANAGER','EDITOR']) then raise exception 'Permission denied'; end if;
 insert into public.vendor_quote_requests(buyer_organization_id,requester_user_id,event_id,requirement,city,needed_at)
 values(p_buyer_org,auth.uid(),p_event,btrim(p_requirement),p_city,p_needed_at) returning id into result;
 insert into public.my_cuelance_items(user_id,item_type,title,status,resource_type,resource_id,metadata)
 values(auth.uid(),'FORM','B2B vendor request','REQUESTED','vendor_quote_request',result,jsonb_build_object('city',p_city));
 return result;
end $$;

revoke all on function public.upsert_vendor_profile(uuid,text[],text[],text[]), public.create_vendor_rfq(uuid,text,text,timestamptz,uuid) from public;
grant execute on function public.upsert_vendor_profile(uuid,text[],text[],text[]), public.create_vendor_rfq(uuid,text,text,timestamptz,uuid) to authenticated;

create or replace function public.admin_list(p_entity text,p_page integer default 0,p_search text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; rows_json jsonb; total bigint;
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 if p_entity not in ('profiles','dj_profiles','organizations','events','communities','tickets','ticket_orders','opportunities','cms_pages','audit_logs','feature_flags','platform_settings','user_roles','ai_requests','vendor_profiles','vendor_products','vendor_quote_requests','vendor_quotes','my_cuelance_items') then raise exception 'Invalid resource'; end if;
 if p_page<0 or p_page>10000 or length(p_search)>100 then raise exception 'Invalid page'; end if;
 execute format('select count(*) from public.%I t where to_jsonb(t)::text ilike $1',p_entity) into total using '%'||p_search||'%';
 execute format('select coalesce(jsonb_agg(r),''[]'') from (select to_jsonb(t)-''credential_token'' as r from public.%I t where to_jsonb(t)::text ilike $1 order by to_jsonb(t)::text limit 25 offset $2) q',p_entity) into rows_json using '%'||p_search||'%',p_page*25;
 return jsonb_build_object('rows',rows_json,'total',total);
end $$;
revoke all on function public.admin_list(text,integer,text) from public;
grant execute on function public.admin_list(text,integer,text) to authenticated;
