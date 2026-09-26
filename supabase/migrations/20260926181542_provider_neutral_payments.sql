-- Provider-neutral payment ledger. Provider credentials stay in server environment
-- variables; the database stores normalized references and verified outcomes only.
create table public.payment_checkouts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete restrict,
 organization_id uuid references public.organizations(id) on delete restrict,
 purpose text not null check(purpose in ('SUBSCRIPTION','TICKET_ORDER','PROVIDER_ORDER')),
 provider text not null check(provider ~ '^[A-Z][A-Z0-9_]{1,39}$'),
 status text not null default 'CREATED' check(status in ('CREATED','PROVIDER_PENDING','APPROVED','COMPLETED','FAILED','CANCELLED','EXPIRED','REFUNDED','PARTIALLY_REFUNDED')),
 amount numeric(12,2) not null check(amount>=0),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 plan_code text references public.plans(code),
 resource_type text,
 resource_id uuid,
 provider_order_id text,
 provider_capture_id text,
 idempotency_key uuid not null default gen_random_uuid(),
 failure_code text,
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(provider,provider_order_id),
 unique(user_id,idempotency_key),
 check((purpose='SUBSCRIPTION' and plan_code is not null) or purpose<>'SUBSCRIPTION')
);
create index payment_checkouts_owner_created on public.payment_checkouts(user_id,created_at desc);
create index payment_checkouts_organization on public.payment_checkouts(organization_id,created_at desc) where organization_id is not null;

create table public.payment_events(
 id uuid primary key default gen_random_uuid(),
 provider text not null,
 provider_event_id text not null,
 event_type text not null,
 provider_order_id text,
 verified boolean not null,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 processing_status text not null default 'RECEIVED' check(processing_status in ('RECEIVED','PROCESSED','IGNORED','FAILED')),
 processing_error text,
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 unique(provider,provider_event_id)
);

create table public.payment_refunds(
 id uuid primary key default gen_random_uuid(),
 checkout_id uuid not null references public.payment_checkouts(id) on delete restrict,
 provider_refund_id text,
 amount numeric(12,2) not null check(amount>0),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 status text not null check(status in ('PENDING','COMPLETED','FAILED','CANCELLED')),
 reason text,
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(checkout_id,provider_refund_id)
);

alter table public.payment_checkouts enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_refunds enable row level security;
create policy payment_checkout_owner_read on public.payment_checkouts for select to authenticated using(
 public.account_active() and (user_id=(select auth.uid()) or (organization_id is not null and exists(
  select 1 from public.organization_members m where m.organization_id=payment_checkouts.organization_id and m.user_id=(select auth.uid())
 )))
);
create policy payment_refund_owner_read on public.payment_refunds for select to authenticated using(
 exists(select 1 from public.payment_checkouts c where c.id=payment_refunds.checkout_id and (c.user_id=(select auth.uid()) or (c.organization_id is not null and exists(
  select 1 from public.organization_members m where m.organization_id=c.organization_id and m.user_id=(select auth.uid())
 ))))
);
revoke all on public.payment_checkouts,public.payment_events,public.payment_refunds from anon,authenticated;
grant select on public.payment_checkouts,public.payment_refunds to authenticated;
grant select,insert,update,delete on public.payment_checkouts,public.payment_events,public.payment_refunds to service_role;

create or replace function public.begin_subscription_checkout(p_plan text,p_organization uuid default null,p_idempotency uuid default gen_random_uuid()) returns public.payment_checkouts
language plpgsql security definer set search_path='' as $$
declare selected_plan public.plans%rowtype; result public.payment_checkouts%rowtype;
begin
 if (select auth.uid()) is null or not public.account_active() then raise exception 'Authentication required'; end if;
 if p_organization is not null and not exists(select 1 from public.organization_members m where m.organization_id=p_organization and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN','FINANCE')) then raise exception 'Billing permission denied'; end if;
 select * into selected_plan from public.plans where code=p_plan and active and monthly_price>0;
 if selected_plan.code is null then raise exception 'Paid plan unavailable'; end if;
 if selected_plan.audience='ORGANIZATION' and p_organization is null then raise exception 'Organization plan requires an organization'; end if;
 if selected_plan.audience='ARTIST' and p_organization is not null then raise exception 'Artist plan belongs to an account'; end if;
 insert into public.payment_checkouts(user_id,organization_id,purpose,provider,amount,currency,plan_code,idempotency_key)
 values((select auth.uid()),p_organization,'SUBSCRIPTION','PAYPAL',selected_plan.monthly_price,selected_plan.currency,selected_plan.code,p_idempotency)
 on conflict(user_id,idempotency_key) do update set updated_at=public.payment_checkouts.updated_at
 returning * into result;
 return result;
end $$;

-- Called only by the server after the provider signature and amount are verified.
create or replace function public.complete_verified_payment(p_provider text,p_event_id text,p_event_type text,p_order_id text,p_capture_id text,p_amount numeric,p_currency text,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare checkout public.payment_checkouts%rowtype; subscription_id uuid; event_id uuid;
begin
 insert into public.payment_events(provider,provider_event_id,event_type,provider_order_id,verified,payload)
 values(p_provider,p_event_id,p_event_type,p_order_id,true,p_payload)
 on conflict(provider,provider_event_id) do nothing returning id into event_id;
 if event_id is null then select id into event_id from public.payment_events where provider=p_provider and provider_event_id=p_event_id; return event_id; end if;
 select * into checkout from public.payment_checkouts where provider=p_provider and provider_order_id=p_order_id for update;
 if checkout.id is null then update public.payment_events set processing_status='IGNORED',processing_error='Unknown provider order',processed_at=now() where id=event_id; return event_id; end if;
 if checkout.amount<>p_amount or checkout.currency<>upper(p_currency) then
  update public.payment_events set processing_status='FAILED',processing_error='Amount or currency mismatch',processed_at=now() where id=event_id;
  return event_id;
 end if;
 if checkout.status='COMPLETED' then update public.payment_events set processing_status='PROCESSED',processed_at=now() where id=event_id; return event_id; end if;
 update public.payment_checkouts set status='COMPLETED',provider_capture_id=p_capture_id,completed_at=now(),updated_at=now() where id=checkout.id;
 if checkout.purpose='SUBSCRIPTION' then
  if checkout.organization_id is null then update public.subscriptions set status='CANCELLED',updated_at=now() where user_id=checkout.user_id and status in ('TRIALING','ACTIVE','PAST_DUE');
  else update public.subscriptions set status='CANCELLED',updated_at=now() where organization_id=checkout.organization_id and status in ('TRIALING','ACTIVE','PAST_DUE'); end if;
  insert into public.subscriptions(user_id,organization_id,plan_code,status,source,external_reference,current_period_end)
  values(case when checkout.organization_id is null then checkout.user_id end,checkout.organization_id,checkout.plan_code,'ACTIVE','PAYMENT_PROVIDER',checkout.id::text,now()+interval '1 month') returning id into subscription_id;
 end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(checkout.user_id,'payment.completed','payment_checkout',checkout.id::text,jsonb_build_object('provider',p_provider,'subscription_id',subscription_id));
 update public.payment_events set processing_status='PROCESSED',processed_at=now() where id=event_id;
 return event_id;
end $$;

revoke all on function public.begin_subscription_checkout(text,uuid,uuid),public.complete_verified_payment(text,text,text,text,text,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.begin_subscription_checkout(text,uuid,uuid) to authenticated;
grant execute on function public.complete_verified_payment(text,text,text,text,text,numeric,text,jsonb) to service_role;
