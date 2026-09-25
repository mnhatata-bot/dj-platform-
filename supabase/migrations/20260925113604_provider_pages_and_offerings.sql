-- Public provider pages and their marketplace offerings share one source of truth.
create table public.provider_pages (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null check(role in ('artist','promoter','venue','community','agency','production','vendor','staff')),
 slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{2,69}$'),
 display_name text not null check(length(btrim(display_name)) between 2 and 120),
 headline text not null default '' check(length(headline)<=180),
 bio text not null default '' check(length(bio)<=6000),
 city text not null default '' check(length(city)<=120),
 website text not null default '' check(website='' or website ~ '^https://[^[:space:]]+$'),
 cover_asset_id uuid references public.media_assets(id) on delete set null,
 avatar_asset_id uuid references public.media_assets(id) on delete set null,
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','PAUSED')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_user_id,role)
);
create table public.provider_offerings (
 id uuid primary key default gen_random_uuid(),
 provider_id uuid not null references public.provider_pages(id) on delete cascade,
 title text not null check(length(btrim(title)) between 2 and 140),
 description text not null default '' check(length(description)<=3000),
 kind text not null check(kind in ('SERVICE','PRODUCT','RENTAL','EXPERIENCE')),
 price numeric(12,2) not null default 0 check(price>=0),
 currency text not null default 'SAR' check(currency ~ '^[A-Z]{3}$'),
 image_asset_id uuid references public.media_assets(id) on delete set null,
 status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','PAUSED')),
 created_at timestamptz not null default now()
);
create table public.provider_inquiries (
 id uuid primary key default gen_random_uuid(),
 provider_id uuid not null references public.provider_pages(id) on delete cascade,
 offering_id uuid references public.provider_offerings(id) on delete set null,
 requester_user_id uuid not null references public.profiles(id),
 message text not null check(length(btrim(message)) between 10 and 3000),
 reply text not null default '' check(length(reply)<=3000),
 status text not null default 'NEW' check(status in ('NEW','CONTACTED','CLOSED')),
 created_at timestamptz not null default now()
);
create index provider_pages_published on public.provider_pages(role,city) where status='PUBLISHED';
create index provider_offerings_provider on public.provider_offerings(provider_id,status);
create index provider_inquiries_provider on public.provider_inquiries(provider_id,created_at desc);
create index provider_inquiries_requester on public.provider_inquiries(requester_user_id,created_at desc);
alter table public.provider_pages enable row level security;
alter table public.provider_offerings enable row level security;
alter table public.provider_inquiries enable row level security;
create policy provider_pages_public on public.provider_pages for select to anon,authenticated using(status='PUBLISHED');
create policy provider_pages_owner on public.provider_pages for all to authenticated using(owner_user_id=auth.uid() and public.account_active()) with check(owner_user_id=auth.uid() and public.account_active());
create policy offerings_public on public.provider_offerings for select to anon,authenticated using(status='ACTIVE' and exists(select 1 from public.provider_pages p where p.id=provider_id and p.status='PUBLISHED'));
create policy offerings_owner on public.provider_offerings for all to authenticated using(public.account_active() and exists(select 1 from public.provider_pages p where p.id=provider_id and p.owner_user_id=auth.uid())) with check(public.account_active() and exists(select 1 from public.provider_pages p where p.id=provider_id and p.owner_user_id=auth.uid()));
create policy inquiries_read on public.provider_inquiries for select to authenticated using(public.account_active() and (requester_user_id=auth.uid() or exists(select 1 from public.provider_pages p where p.id=provider_id and p.owner_user_id=auth.uid())));
create policy inquiries_create on public.provider_inquiries for insert to authenticated with check(public.account_active() and requester_user_id=auth.uid() and status='NEW' and exists(select 1 from public.provider_pages p where p.id=provider_id and p.status='PUBLISHED' and p.owner_user_id<>auth.uid()) and (offering_id is null or exists(select 1 from public.provider_offerings o where o.id=offering_id and o.provider_id=provider_inquiries.provider_id and o.status='ACTIVE')));
create policy inquiries_manage on public.provider_inquiries for update to authenticated using(public.account_active() and exists(select 1 from public.provider_pages p where p.id=provider_id and p.owner_user_id=auth.uid())) with check(public.account_active() and exists(select 1 from public.provider_pages p where p.id=provider_id and p.owner_user_id=auth.uid()));
revoke all on public.provider_pages,public.provider_offerings,public.provider_inquiries from anon,authenticated;
grant select on public.provider_pages,public.provider_offerings to anon,authenticated;
grant insert,update,delete on public.provider_pages,public.provider_offerings to authenticated;
grant select on public.provider_inquiries to authenticated;
grant insert(provider_id,offering_id,requester_user_id,message) on public.provider_inquiries to authenticated;
grant update(status,reply) on public.provider_inquiries to authenticated;
-- Reject private/foreign media even when a client bypasses the UI.
create function public.validate_provider_media() returns trigger language plpgsql security invoker set search_path='' as $$
declare asset uuid; assets uuid[];
begin
 if tg_table_name='provider_pages' then
  assets:=array[new.cover_asset_id,new.avatar_asset_id];
  new.updated_at:=now();
  if tg_op='UPDATE' and (new.owner_user_id<>old.owner_user_id or new.role<>old.role) then raise exception 'Page ownership and role cannot change'; end if;
  if new.status='PUBLISHED' and (length(btrim(new.bio))<20 or new.cover_asset_id is null) then raise exception 'Add a cover image and a biography of at least 20 characters before publishing'; end if;
 else
  assets:=array[new.image_asset_id];
  if tg_op='UPDATE' and new.provider_id<>old.provider_id then raise exception 'Offering provider cannot change'; end if;
 end if;
 foreach asset in array assets loop
  if asset is not null and not exists(select 1 from public.media_assets m where m.id=asset and m.owner_user_id=auth.uid() and m.visibility='PUBLIC' and m.kind='IMAGE') then raise exception 'Choose one of your public images'; end if;
 end loop;
 return new;
end $$;
create trigger provider_media before insert or update on public.provider_pages for each row execute function public.validate_provider_media();
create trigger offering_media before insert or update on public.provider_offerings for each row execute function public.validate_provider_media();
create function public.limit_provider_inquiries() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,73));
 if (select count(*) from public.provider_inquiries where requester_user_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'Inquiry limit reached. Try again later'; end if;
 return new;
end $$;
create trigger inquiry_limit before insert on public.provider_inquiries for each row execute function public.limit_provider_inquiries();
