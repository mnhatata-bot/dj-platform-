-- Provider-neutral subscriptions and server-authoritative feature entitlements.
create table public.plans(
 code text primary key check(code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
 name text not null check(length(name) between 2 and 80),
 audience text not null check(audience in ('ALL','ARTIST','ORGANIZATION')),
 monthly_price numeric(12,2) not null default 0 check(monthly_price>=0),
 currency text not null default 'SAR' check(currency ~ '^[A-Z]{3}$'),
 entitlements jsonb not null default '{}'::jsonb check(jsonb_typeof(entitlements)='object'),
 active boolean not null default true,
 sort_order integer not null default 0,
 created_at timestamptz not null default now()
);
create table public.subscriptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.profiles(id) on delete cascade,
 organization_id uuid references public.organizations(id) on delete cascade,
 plan_code text not null references public.plans(code),
 status text not null check(status in ('TRIALING','ACTIVE','PAST_DUE','PAUSED','CANCELLED','EXPIRED')),
 source text not null default 'ADMIN' check(source in ('ADMIN','PAYMENT_PROVIDER','PROMOTION','MIGRATION')),
 external_reference text,
 starts_at timestamptz not null default now(),
 current_period_end timestamptz,
 cancel_at_period_end boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((user_id is not null)::integer+(organization_id is not null)::integer=1)
);
create unique index subscriptions_active_user on public.subscriptions(user_id) where user_id is not null and status in ('TRIALING','ACTIVE','PAST_DUE');
create unique index subscriptions_active_org on public.subscriptions(organization_id) where organization_id is not null and status in ('TRIALING','ACTIVE','PAST_DUE');
create index subscriptions_expiry on public.subscriptions(current_period_end) where status in ('TRIALING','ACTIVE','PAST_DUE');
create table public.entitlement_overrides(
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.profiles(id) on delete cascade,
 organization_id uuid references public.organizations(id) on delete cascade,
 entitlement_key text not null check(entitlement_key ~ '^[a-z][a-z0-9_.]{1,79}$'),
 value jsonb not null,
 reason text not null check(length(btrim(reason)) between 3 and 500),
 expires_at timestamptz,
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 check((user_id is not null)::integer+(organization_id is not null)::integer=1)
);
create unique index entitlement_override_user on public.entitlement_overrides(user_id,entitlement_key) where user_id is not null;
create unique index entitlement_override_org on public.entitlement_overrides(organization_id,entitlement_key) where organization_id is not null;

insert into public.plans(code,name,audience,monthly_price,entitlements,sort_order) values
('FREE','Cuelance Free','ALL',0,'{"epk.templates":1,"epk.publications":1,"ai.daily":20,"storage.mb":250,"organizations.max":1,"team.max":1,"marketplace.apply":true,"marketplace.publish":true,"communities.enabled":true,"ticketing.enabled":true,"analytics.level":"basic","custom_domain":false}',0),
('ARTIST_PRO','Artist Pro','ARTIST',79,'{"epk.templates":5,"epk.publications":20,"ai.daily":100,"storage.mb":5000,"organizations.max":1,"team.max":1,"marketplace.apply":true,"marketplace.publish":true,"communities.enabled":true,"ticketing.enabled":true,"analytics.level":"advanced","custom_domain":true}',10),
('PROMOTER_PRO','Promoter Pro','ORGANIZATION',249,'{"epk.templates":5,"epk.publications":20,"ai.daily":100,"storage.mb":20000,"organizations.max":3,"team.max":10,"marketplace.apply":true,"marketplace.publish":true,"communities.enabled":true,"ticketing.enabled":true,"analytics.level":"advanced","custom_domain":true}',20),
('BUSINESS','Cuelance Business','ORGANIZATION',699,'{"epk.templates":5,"epk.publications":100,"ai.daily":500,"storage.mb":100000,"organizations.max":10,"team.max":50,"marketplace.apply":true,"marketplace.publish":true,"communities.enabled":true,"ticketing.enabled":true,"analytics.level":"business","custom_domain":true}',30)
on conflict(code) do update set name=excluded.name,audience=excluded.audience,monthly_price=excluded.monthly_price,entitlements=excluded.entitlements,sort_order=excluded.sort_order;

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlement_overrides enable row level security;
create policy plans_catalog_read on public.plans for select to authenticated using(active);
create policy subscriptions_owner_read on public.subscriptions for select to authenticated using(
 public.account_active() and (user_id=(select auth.uid()) or exists(select 1 from public.organization_members m where m.organization_id=subscriptions.organization_id and m.user_id=(select auth.uid())))
);
create policy overrides_owner_read on public.entitlement_overrides for select to authenticated using(
 public.account_active() and (user_id=(select auth.uid()) or exists(select 1 from public.organization_members m where m.organization_id=entitlement_overrides.organization_id and m.user_id=(select auth.uid())))
);
revoke all on public.plans,public.subscriptions,public.entitlement_overrides from anon,authenticated;
grant select on public.plans,public.subscriptions,public.entitlement_overrides to authenticated;

create or replace function public.entitlement_snapshot(p_organization uuid default null) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare selected_plan public.plans%rowtype; selected_subscription public.subscriptions%rowtype; merged jsonb; usage jsonb;
begin
 if auth.uid() is null or not public.account_active() then raise exception 'Authentication required'; end if;
 if p_organization is not null and not exists(select 1 from public.organization_members where organization_id=p_organization and user_id=auth.uid()) then raise exception 'Organization access denied'; end if;
 select s.* into selected_subscription from public.subscriptions s where
  ((p_organization is not null and s.organization_id=p_organization) or (p_organization is null and s.user_id=auth.uid()))
  and s.status in ('TRIALING','ACTIVE') and (s.current_period_end is null or s.current_period_end>now())
 order by case s.status when 'ACTIVE' then 0 else 1 end,s.created_at desc limit 1;
 select * into selected_plan from public.plans where code=coalesce(selected_subscription.plan_code,'FREE') and active;
 if selected_plan.code is null then select * into selected_plan from public.plans where code='FREE'; end if;
 merged:=selected_plan.entitlements;
 select merged||coalesce(jsonb_object_agg(o.entitlement_key,o.value),'{}'::jsonb) into merged from public.entitlement_overrides o where
  ((p_organization is not null and o.organization_id=p_organization) or (p_organization is null and o.user_id=auth.uid()))
  and (o.expires_at is null or o.expires_at>now());
 usage:=jsonb_build_object(
  'ai.today',(select count(*) from public.ai_requests where user_id=auth.uid() and created_at>=date_trunc('day',now())),
  'media.assets',(select count(*) from public.media_assets where owner_user_id=auth.uid()),
  'organizations',(select count(*) from public.organization_members where user_id=auth.uid() and role='OWNER')
 );
 return jsonb_build_object('plan',selected_plan.code,'name',selected_plan.name,'status',coalesce(selected_subscription.status,'FREE'),'period_end',selected_subscription.current_period_end,'entitlements',merged,'usage',usage);
end $$;

create or replace function public.entitlement_allowed(p_key text,p_organization uuid default null) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare value jsonb;
begin
 if p_key !~ '^[a-z][a-z0-9_.]{1,79}$' then return false; end if;
 value:=public.entitlement_snapshot(p_organization)->'entitlements'->p_key;
 return coalesce(value='true'::jsonb,false);
end $$;

create or replace function public.admin_set_subscription(p_user uuid,p_organization uuid,p_plan text,p_status text,p_period_end timestamptz default null) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 if (p_user is not null)::integer+(p_organization is not null)::integer<>1 then raise exception 'Choose one subscriber'; end if;
 if p_status not in ('TRIALING','ACTIVE','PAST_DUE','PAUSED','CANCELLED','EXPIRED') or not exists(select 1 from public.plans where code=p_plan and active) then raise exception 'Invalid subscription'; end if;
 if p_user is not null then update public.subscriptions set status='CANCELLED',updated_at=now() where user_id=p_user and status in ('TRIALING','ACTIVE','PAST_DUE');
 else update public.subscriptions set status='CANCELLED',updated_at=now() where organization_id=p_organization and status in ('TRIALING','ACTIVE','PAST_DUE'); end if;
 insert into public.subscriptions(user_id,organization_id,plan_code,status,current_period_end) values(p_user,p_organization,p_plan,p_status,p_period_end) returning id into result;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'subscription.set','subscription',result::text,jsonb_build_object('plan',p_plan,'status',p_status,'user_id',p_user,'organization_id',p_organization));
 return result;
end $$;
revoke all on function public.entitlement_snapshot(uuid),public.entitlement_allowed(text,uuid),public.admin_set_subscription(uuid,uuid,text,text,timestamptz) from public,anon;
grant execute on function public.entitlement_snapshot(uuid),public.entitlement_allowed(text,uuid) to authenticated;
grant execute on function public.admin_set_subscription(uuid,uuid,text,text,timestamptz) to authenticated;

-- Existing AI workflow now derives its daily quota from the active plan.
create or replace function public.begin_ai_request(p_action text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; daily_limit integer;
begin
 if not public.account_active() then raise exception 'Account unavailable'; end if;
 if p_action not in ('GENERATE_BIO','SHORTEN_BIO','CHANGE_TONE','PROMOTER_BIO','FESTIVAL_BIO','BRAND_BIO','TRANSLATE','GRAMMAR_FIX','SEO_DESCRIPTION','CAREER_SUMMARY') then raise exception 'Invalid action'; end if;
 if exists(select 1 from public.feature_flags where key='ai_enabled' and not enabled) then raise exception 'AI disabled by administrator'; end if;
 daily_limit:=greatest(0,coalesce((public.entitlement_snapshot(null)->'entitlements'->>'ai.daily')::integer,0));
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,8));
 if (select count(*) from public.ai_requests where user_id=auth.uid() and created_at>now()-interval '1 day')>=daily_limit or (select count(*) from public.ai_requests where user_id=auth.uid() and created_at>now()-interval '1 minute')>=3 then raise exception 'AI allowance reached. Upgrade or try later.'; end if;
 insert into public.ai_requests(user_id,action) values(auth.uid(),p_action) returning id into result;
 return result;
end $$;
revoke all on function public.begin_ai_request(text) from public,anon;
grant execute on function public.begin_ai_request(text) to authenticated;
