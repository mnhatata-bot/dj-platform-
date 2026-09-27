create or replace function public.agency_member(p_organization uuid,p_roles text[] default array['OWNER','ADMIN','MANAGER','EDITOR','FINANCE','VIEWER']) returns boolean language sql stable security definer set search_path='' as $$
 select public.account_active() and exists(select 1 from public.organization_members m where m.organization_id=p_organization and m.user_id=(select auth.uid()) and m.role=any(p_roles))
$$;
revoke all on function public.agency_member(uuid,text[]) from public,anon;
grant execute on function public.agency_member(uuid,text[]) to authenticated;

create table public.agency_roster(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 artist_profile_id uuid references public.dj_profiles(id) on delete set null,stage_name text not null check(length(btrim(stage_name)) between 2 and 120),contact_email text check(contact_email is null or contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
 territory text not null default '',genres text[] not null default '{}',base_fee numeric(12,2) not null default 0 check(base_fee>=0),currency text not null default 'SAR' check(currency ~ '^[A-Z]{3}$'),commission_percent numeric(5,2) not null default 15 check(commission_percent between 0 and 100),
 status text not null default 'ACTIVE' check(status in ('INVITED','ACTIVE','PAUSED','ARCHIVED')),notes text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index agency_roster_artist on public.agency_roster(organization_id,artist_profile_id) where artist_profile_id is not null;
create index agency_roster_org on public.agency_roster(organization_id,status,stage_name);

create table public.agency_calendar_items(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,roster_id uuid references public.agency_roster(id) on delete cascade,
 kind text not null check(kind in ('HOLD','BOOKING','TRAVEL','REHEARSAL','UNAVAILABLE','TASK')),title text not null check(length(btrim(title)) between 2 and 160),location text not null default '',starts_at timestamptz not null,ends_at timestamptz not null,
 status text not null default 'TENTATIVE' check(status in ('TENTATIVE','CONFIRMED','CANCELLED')),notes text not null default '',created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),check(ends_at>starts_at)
);
create index agency_calendar_range on public.agency_calendar_items(organization_id,starts_at,ends_at);

create table public.agency_offers(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,roster_id uuid not null references public.agency_roster(id) on delete restrict,
 title text not null check(length(btrim(title)) between 2 and 160),counterparty_name text not null check(length(btrim(counterparty_name)) between 2 and 160),counterparty_email text check(counterparty_email is null or counterparty_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
 event_name text not null default '',event_location text not null default '',event_starts_at timestamptz,performance_minutes integer check(performance_minutes is null or performance_minutes between 1 and 1440),fee numeric(12,2) not null default 0 check(fee>=0),currency text not null default 'SAR' check(currency ~ '^[A-Z]{3}$'),
 status text not null default 'DRAFT' check(status in ('DRAFT','SENT','NEGOTIATING','ACCEPTED','DECLINED','WITHDRAWN')),artist_approval text not null default 'PENDING' check(artist_approval in ('PENDING','APPROVED','DECLINED')),
 terms text not null default '' check(length(terms)<=20000),expires_at timestamptz,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index agency_offers_pipeline on public.agency_offers(organization_id,status,created_at desc);

create table public.agency_offer_history(
 id uuid primary key default gen_random_uuid(),offer_id uuid not null references public.agency_offers(id) on delete cascade,actor_user_id uuid references public.profiles(id),from_status text,to_status text not null,note text not null default '',created_at timestamptz not null default now()
);
create index agency_offer_history_offer on public.agency_offer_history(offer_id,created_at);

create table public.agency_contracts(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,offer_id uuid not null references public.agency_offers(id) on delete restrict,
 title text not null check(length(btrim(title)) between 2 and 160),version integer not null default 1 check(version>0),body text not null check(length(btrim(body)) between 20 and 50000),status text not null default 'DRAFT' check(status in ('DRAFT','SENT','PARTIALLY_SIGNED','EXECUTED','VOID')),
 agency_signed_by uuid references public.profiles(id),agency_signed_at timestamptz,artist_signed_by uuid references public.profiles(id),artist_signed_at timestamptz,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(offer_id,version)
);
create index agency_contracts_org on public.agency_contracts(organization_id,status,created_at desc);

create table public.agency_deal_messages(
 id uuid primary key default gen_random_uuid(),offer_id uuid not null references public.agency_offers(id) on delete cascade,sender_user_id uuid not null references public.profiles(id),body text not null check(length(btrim(body)) between 1 and 4000),created_at timestamptz not null default now()
);
create table public.agency_deal_documents(
 id uuid primary key default gen_random_uuid(),offer_id uuid not null references public.agency_offers(id) on delete cascade,title text not null check(length(btrim(title)) between 2 and 160),media_asset_id uuid not null references public.media_assets(id) on delete restrict,category text not null default 'OTHER' check(category in ('OFFER','CONTRACT','RIDER','TRAVEL','INVOICE','OTHER')),uploaded_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);

alter table public.agency_roster enable row level security;alter table public.agency_calendar_items enable row level security;alter table public.agency_offers enable row level security;alter table public.agency_offer_history enable row level security;alter table public.agency_contracts enable row level security;alter table public.agency_deal_messages enable row level security;alter table public.agency_deal_documents enable row level security;

create policy agency_roster_read on public.agency_roster for select to authenticated using(public.agency_member(organization_id) or exists(select 1 from public.dj_profiles d where d.id=artist_profile_id and d.user_id=(select auth.uid())));
create policy agency_roster_manage on public.agency_roster for all to authenticated using(public.agency_member(organization_id,array['OWNER','ADMIN','MANAGER'])) with check(public.agency_member(organization_id,array['OWNER','ADMIN','MANAGER']));
create policy agency_calendar_read on public.agency_calendar_items for select to authenticated using(public.agency_member(organization_id) or exists(select 1 from public.agency_roster r join public.dj_profiles d on d.id=r.artist_profile_id where r.id=roster_id and d.user_id=(select auth.uid())));
create policy agency_calendar_manage on public.agency_calendar_items for all to authenticated using(public.agency_member(organization_id,array['OWNER','ADMIN','MANAGER','EDITOR'])) with check(public.agency_member(organization_id,array['OWNER','ADMIN','MANAGER','EDITOR']) and created_by=(select auth.uid()) and (roster_id is null or exists(select 1 from public.agency_roster r where r.id=roster_id and r.organization_id=agency_calendar_items.organization_id)));
create policy agency_offers_read on public.agency_offers for select to authenticated using(public.agency_member(organization_id) or exists(select 1 from public.agency_roster r join public.dj_profiles d on d.id=r.artist_profile_id where r.id=roster_id and d.user_id=(select auth.uid())));
create policy agency_offers_create on public.agency_offers for insert to authenticated with check(public.agency_member(organization_id,array['OWNER','ADMIN','MANAGER']) and created_by=(select auth.uid()) and exists(select 1 from public.agency_roster r where r.id=roster_id and r.organization_id=agency_offers.organization_id));
create policy agency_history_read on public.agency_offer_history for select to authenticated using(exists(select 1 from public.agency_offers o join public.agency_roster r on r.id=o.roster_id left join public.dj_profiles d on d.id=r.artist_profile_id where o.id=offer_id and (public.agency_member(o.organization_id) or d.user_id=(select auth.uid()))));
create policy agency_contracts_read on public.agency_contracts for select to authenticated using(public.agency_member(organization_id) or exists(select 1 from public.agency_offers o join public.agency_roster r on r.id=o.roster_id join public.dj_profiles d on d.id=r.artist_profile_id where o.id=offer_id and d.user_id=(select auth.uid())));
create policy agency_contracts_create on public.agency_contracts for insert to authenticated with check(public.agency_member(organization_id,array['OWNER','ADMIN','MANAGER']) and created_by=(select auth.uid()) and exists(select 1 from public.agency_offers o where o.id=offer_id and o.organization_id=agency_contracts.organization_id));
create policy agency_deal_messages_read on public.agency_deal_messages for select to authenticated using(exists(select 1 from public.agency_offers o join public.agency_roster r on r.id=o.roster_id left join public.dj_profiles d on d.id=r.artist_profile_id where o.id=offer_id and (public.agency_member(o.organization_id) or d.user_id=(select auth.uid()))));
create policy agency_deal_messages_create on public.agency_deal_messages for insert to authenticated with check(sender_user_id=(select auth.uid()) and exists(select 1 from public.agency_offers o join public.agency_roster r on r.id=o.roster_id left join public.dj_profiles d on d.id=r.artist_profile_id where o.id=offer_id and (public.agency_member(o.organization_id) or d.user_id=(select auth.uid()))));
create policy agency_documents_read on public.agency_deal_documents for select to authenticated using(exists(select 1 from public.agency_offers o join public.agency_roster r on r.id=o.roster_id left join public.dj_profiles d on d.id=r.artist_profile_id where o.id=offer_id and (public.agency_member(o.organization_id) or d.user_id=(select auth.uid()))));
create policy agency_documents_create on public.agency_deal_documents for insert to authenticated with check(uploaded_by=(select auth.uid()) and exists(select 1 from public.agency_offers o where o.id=offer_id and public.agency_member(o.organization_id,array['OWNER','ADMIN','MANAGER','EDITOR'])) and exists(select 1 from public.media_assets a where a.id=media_asset_id and a.owner_user_id=(select auth.uid())));

revoke all on public.agency_roster,public.agency_calendar_items,public.agency_offers,public.agency_offer_history,public.agency_contracts,public.agency_deal_messages,public.agency_deal_documents from anon,authenticated;
grant select,insert,update,delete on public.agency_roster,public.agency_calendar_items to authenticated;
grant select,insert on public.agency_offers,public.agency_contracts,public.agency_deal_messages,public.agency_deal_documents to authenticated;
grant select on public.agency_offer_history to authenticated;
grant select,insert,update,delete on public.agency_roster,public.agency_calendar_items,public.agency_offers,public.agency_offer_history,public.agency_contracts,public.agency_deal_messages,public.agency_deal_documents to service_role;

create or replace function public.agency_transition_offer(p_offer uuid,p_status text,p_note text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare row public.agency_offers%rowtype; allowed boolean:=false;
begin
 select * into row from public.agency_offers where id=p_offer for update;
 if row.id is null or not public.agency_member(row.organization_id,array['OWNER','ADMIN','MANAGER']) then raise exception 'Offer unavailable'; end if;
 if row.status='DRAFT' and p_status in ('SENT','WITHDRAWN') then allowed:=true;
 elsif row.status='SENT' and p_status in ('NEGOTIATING','ACCEPTED','DECLINED','WITHDRAWN') then allowed:=true;
 elsif row.status='NEGOTIATING' and p_status in ('SENT','ACCEPTED','DECLINED','WITHDRAWN') then allowed:=true;end if;
 if not allowed then raise exception 'Invalid offer transition'; end if;
 update public.agency_offers set status=p_status,updated_at=now() where id=p_offer;
 insert into public.agency_offer_history(offer_id,actor_user_id,from_status,to_status,note) values(p_offer,(select auth.uid()),row.status,p_status,left(p_note,1000));
 return p_offer;
end $$;

create or replace function public.agency_artist_offer_response(p_offer uuid,p_approved boolean,p_note text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare row public.agency_offers%rowtype;
begin
 select o.* into row from public.agency_offers o join public.agency_roster r on r.id=o.roster_id join public.dj_profiles d on d.id=r.artist_profile_id where o.id=p_offer and d.user_id=(select auth.uid()) for update of o;
 if row.id is null or row.status not in ('SENT','NEGOTIATING','ACCEPTED') then raise exception 'Offer unavailable for artist response'; end if;
 update public.agency_offers set artist_approval=case when p_approved then 'APPROVED' else 'DECLINED' end,updated_at=now() where id=p_offer;
 insert into public.agency_offer_history(offer_id,actor_user_id,from_status,to_status,note) values(p_offer,(select auth.uid()),row.status,row.status,left(case when p_approved then 'Artist approved. ' else 'Artist declined. ' end||p_note,1000));return p_offer;
end $$;

create or replace function public.agency_sign_contract(p_contract uuid,p_as text) returns uuid language plpgsql security definer set search_path='' as $$
declare contract public.agency_contracts%rowtype; artist_user uuid; agency_ok boolean; artist_ok boolean;
begin
 select * into contract from public.agency_contracts where id=p_contract for update;
 select d.user_id into artist_user from public.agency_offers o join public.agency_roster r on r.id=o.roster_id left join public.dj_profiles d on d.id=r.artist_profile_id where o.id=contract.offer_id;
 if contract.id is null or contract.status not in ('SENT','PARTIALLY_SIGNED') then raise exception 'Contract is not ready for signature'; end if;
 if p_as='AGENCY' and public.agency_member(contract.organization_id,array['OWNER','ADMIN','MANAGER']) then update public.agency_contracts set agency_signed_by=(select auth.uid()),agency_signed_at=now() where id=p_contract;
 elsif p_as='ARTIST' and artist_user=(select auth.uid()) then update public.agency_contracts set artist_signed_by=(select auth.uid()),artist_signed_at=now() where id=p_contract;else raise exception 'Signature permission denied';end if;
 select agency_signed_at is not null,artist_signed_at is not null into agency_ok,artist_ok from public.agency_contracts where id=p_contract;
 update public.agency_contracts set status=case when agency_ok and artist_ok then 'EXECUTED' else 'PARTIALLY_SIGNED' end,updated_at=now() where id=p_contract;return p_contract;
end $$;

create or replace function public.agency_send_contract(p_contract uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select organization_id into org from public.agency_contracts where id=p_contract and status='DRAFT' for update;
 if org is null or not public.agency_member(org,array['OWNER','ADMIN','MANAGER']) then raise exception 'Contract unavailable';end if;
 update public.agency_contracts set status='SENT',updated_at=now() where id=p_contract;return p_contract;
end $$;
revoke all on function public.agency_transition_offer(uuid,text,text),public.agency_artist_offer_response(uuid,boolean,text),public.agency_sign_contract(uuid,text),public.agency_send_contract(uuid) from public,anon;
grant execute on function public.agency_transition_offer(uuid,text,text),public.agency_artist_offer_response(uuid,boolean,text),public.agency_sign_contract(uuid,text),public.agency_send_contract(uuid) to authenticated;

create or replace function private.notify_agency_offer() returns trigger language plpgsql security definer set search_path='' as $$
declare artist uuid; artist_name text;
begin
 select d.user_id,r.stage_name into artist,artist_name from public.agency_roster r left join public.dj_profiles d on d.id=r.artist_profile_id where r.id=new.roster_id;
 if artist is not null then perform private.enqueue_notification(artist,'agency.offer.'||lower(new.status),'Agency offer update',artist_name||': '||new.title||' is '||lower(new.status),'agency_offer',new.id::text,jsonb_build_object('status',new.status));end if;return new;
end $$;
create trigger agency_offer_notification after insert or update of status on public.agency_offers for each row execute function private.notify_agency_offer();

create or replace function public.admin_list(p_entity text,p_page integer default 0,p_search text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows_json jsonb; total bigint;
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 if p_entity not in ('profiles','dj_profiles','organizations','events','communities','tickets','ticket_orders','opportunities','cms_pages','audit_logs','feature_flags','platform_settings','user_roles','ai_requests','vendor_profiles','vendor_products','vendor_quote_requests','vendor_quotes','my_cuelance_items','operational_logs','provider_pages','provider_offerings','provider_inquiries','provider_catalogs','provider_attribute_definitions','provider_offering_variants','provider_offering_availability','provider_orders','provider_order_history','provider_order_deliverables','beta_access','user_notifications','notification_outbox','agency_roster','agency_calendar_items','agency_offers','agency_offer_history','agency_contracts','agency_deal_messages','agency_deal_documents') then raise exception 'Invalid resource'; end if;
 if p_page<0 or p_page>10000 or length(p_search)>100 then raise exception 'Invalid page'; end if;
 execute format('select count(*) from public.%I t where to_jsonb(t)::text ilike $1',p_entity) into total using '%'||p_search||'%';
 execute format('select coalesce(jsonb_agg(r),''[]'') from (select to_jsonb(t)-''credential_token'' as r from public.%I t where to_jsonb(t)::text ilike $1 order by to_jsonb(t)::text limit 25 offset $2) q',p_entity) into rows_json using '%'||p_search||'%',p_page*25;
 return jsonb_build_object('rows',rows_json,'total',total);
end $$;
revoke execute on function public.admin_list(text,integer,text) from public,anon;
grant execute on function public.admin_list(text,integer,text) to authenticated;
