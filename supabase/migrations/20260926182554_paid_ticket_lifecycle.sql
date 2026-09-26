-- Complete paid-ticket operations. Inventory is reserved for a short checkout
-- window and becomes sold only after a verified provider capture.
alter table public.ticket_types add column if not exists quantity_reserved integer not null default 0 check(quantity_reserved>=0);
alter table public.ticket_types add column if not exists price numeric(12,2) not null default 0;
alter table public.ticket_types add column if not exists currency text not null default 'SAR';
alter table public.ticket_types add column if not exists capacity integer not null default 1;
alter table public.ticket_types add column if not exists quantity_sold integer not null default 0;
alter table public.ticket_orders add column if not exists ticket_type_id uuid references public.ticket_types(id) on delete restrict;
alter table public.ticket_orders alter column id set default gen_random_uuid();
alter table public.ticket_orders add column if not exists event_id uuid references public.events(id) on delete restrict;
alter table public.ticket_orders add column if not exists user_id uuid references public.profiles(id) on delete restrict;
alter table public.ticket_orders add column if not exists buyer_email text;
alter table public.ticket_orders add column if not exists amount numeric(12,2) not null default 0;
alter table public.ticket_orders add column if not exists currency text not null default 'SAR';
alter table public.ticket_orders add column if not exists status text not null default 'PAYMENT_PENDING';
alter table public.ticket_orders add column if not exists created_at timestamptz not null default now();
alter table public.ticket_orders add column if not exists quantity integer not null default 1 check(quantity=1);
alter table public.ticket_orders add column if not exists idempotency_key uuid;
alter table public.ticket_orders add column if not exists expires_at timestamptz;
alter table public.ticket_orders add column if not exists refunded_amount numeric(12,2) not null default 0 check(refunded_amount>=0);
alter table public.ticket_orders add column if not exists updated_at timestamptz not null default now();
create unique index if not exists ticket_order_user_idempotency on public.ticket_orders(user_id,idempotency_key) where idempotency_key is not null;
create index if not exists ticket_order_event_status on public.ticket_orders(event_id,status,created_at desc);
alter table public.ticket_orders drop constraint if exists ticket_orders_status_check;
alter table public.ticket_orders add constraint ticket_orders_status_check check(status in ('PENDING','PAID','PAYMENT_PENDING','COMPLETED','CANCELLED','EXPIRED','REFUND_PENDING','REFUNDED','PARTIALLY_REFUNDED','FAILED'));
alter table public.tickets add column if not exists order_id uuid references public.ticket_orders(id) on delete restrict;
alter table public.tickets alter column id set default gen_random_uuid();
alter table public.tickets add column if not exists ticket_type_id uuid references public.ticket_types(id) on delete restrict;
alter table public.tickets add column if not exists event_id uuid references public.events(id) on delete restrict;
alter table public.tickets add column if not exists attendee_email text;
alter table public.tickets add column if not exists issued_at timestamptz not null default now();
alter table public.tickets add column if not exists holder_user_id uuid references public.profiles(id) on delete restrict;
alter table public.tickets add column if not exists updated_at timestamptz not null default now();
alter table public.tickets drop constraint if exists tickets_status_check;
alter table public.tickets add constraint tickets_status_check check(status in ('PENDING','ACTIVE','ISSUED','CHECKED_IN','CANCELLED','REFUND_PENDING','REFUNDED','REVOKED','TRANSFERRED'));
update public.tickets t set holder_user_id=o.user_id from public.ticket_orders o where o.id=t.order_id and t.holder_user_id is null;
create index if not exists tickets_holder on public.tickets(holder_user_id,issued_at desc);

create table public.ticket_transfers(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.tickets(id) on delete restrict,
 from_user_id uuid not null references public.profiles(id) on delete restrict,
 to_user_id uuid references public.profiles(id) on delete restrict,
 recipient_email text not null check(recipient_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
 transfer_token uuid not null default gen_random_uuid() unique,
 status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED','CANCELLED','EXPIRED')),
 expires_at timestamptz not null default now()+interval '48 hours',
 created_at timestamptz not null default now(),
 accepted_at timestamptz
);
create unique index ticket_one_pending_transfer on public.ticket_transfers(ticket_id) where status='PENDING';
alter table public.ticket_transfers enable row level security;
create policy ticket_transfer_participant_read on public.ticket_transfers for select to authenticated using(from_user_id=(select auth.uid()) or to_user_id=(select auth.uid()));
revoke all on public.ticket_transfers from anon,authenticated;
grant select on public.ticket_transfers to authenticated;
grant select,insert,update,delete on public.ticket_transfers to service_role;

drop policy if exists ticket_holder_read on public.tickets;
create policy ticket_holder_read on public.tickets for select to authenticated using(holder_user_id=(select auth.uid()));

create or replace function private.release_expired_ticket_reservations() returns integer
language plpgsql security definer set search_path='' as $$
declare released integer:=0;
begin
 with expired as (
  update public.ticket_orders set status='EXPIRED',updated_at=now()
  where status='PAYMENT_PENDING' and expires_at<=now()
  returning ticket_type_id,quantity,id
 ), inventory as (
  update public.ticket_types tt set quantity_reserved=greatest(0,tt.quantity_reserved-x.quantity)
  from (select ticket_type_id,sum(quantity)::integer quantity from expired group by ticket_type_id) x
  where tt.id=x.ticket_type_id returning tt.id
 )
 update public.payment_checkouts c set status='EXPIRED',updated_at=now()
 where c.purpose='TICKET_ORDER' and c.status in ('CREATED','PROVIDER_PENDING','APPROVED') and c.resource_id in (select id from expired);
 get diagnostics released=row_count;
 return released;
end $$;

create or replace function public.begin_paid_ticket_checkout(p_ticket_type uuid,p_buyer_email text,p_idempotency uuid) returns public.payment_checkouts
language plpgsql security definer set search_path='' as $$
declare tt public.ticket_types%rowtype; ev public.events%rowtype; existing public.payment_checkouts%rowtype; order_id uuid; result public.payment_checkouts%rowtype;
begin
 if (select auth.uid()) is null or not public.account_active() then raise exception 'Authentication required'; end if;
 if p_buyer_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Valid buyer email required'; end if;
 select c.* into existing from public.payment_checkouts c where c.user_id=(select auth.uid()) and c.idempotency_key=p_idempotency;
 if existing.id is not null then return existing; end if;
 perform private.release_expired_ticket_reservations();
 select * into tt from public.ticket_types where id=p_ticket_type for update;
 if tt.id is null or tt.status<>'ACTIVE' or tt.price<=0 then raise exception 'Paid ticket unavailable'; end if;
 select * into ev from public.events where id=tt.event_id;
 if ev.id is null or ev.status not in ('PUBLISHED','LIVE') or tt.quantity_sold+tt.quantity_reserved>=tt.capacity then raise exception 'Ticket unavailable or sold out'; end if;
 if (tt.sales_start is not null and tt.sales_start>now()) or (tt.sales_end is not null and tt.sales_end<=now()) or tt.approval_required or ev.approval_required then raise exception 'Ticket sale unavailable or approval required'; end if;
 insert into public.ticket_orders(event_id,ticket_type_id,user_id,buyer_email,amount,currency,status,quantity,idempotency_key,expires_at)
 values(tt.event_id,tt.id,(select auth.uid()),lower(p_buyer_email),tt.price,tt.currency,'PAYMENT_PENDING',1,p_idempotency,now()+interval '15 minutes') returning id into order_id;
 update public.ticket_types set quantity_reserved=quantity_reserved+1 where id=tt.id;
 insert into public.payment_checkouts(user_id,purpose,provider,status,amount,currency,resource_type,resource_id,idempotency_key,metadata)
 values((select auth.uid()),'TICKET_ORDER','PAYPAL','CREATED',tt.price,tt.currency,'ticket_order',order_id,p_idempotency,jsonb_build_object('event_id',tt.event_id,'ticket_type_id',tt.id)) returning * into result;
 return result;
end $$;

-- Replace payment completion so the same verified ledger can activate a plan or issue a ticket.
create or replace function public.complete_verified_payment(p_provider text,p_event_id text,p_event_type text,p_order_id text,p_capture_id text,p_amount numeric,p_currency text,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare checkout public.payment_checkouts%rowtype; subscription_id uuid; event_id uuid; ticket_order public.ticket_orders%rowtype; ticket_id uuid;
begin
 insert into public.payment_events(provider,provider_event_id,event_type,provider_order_id,verified,payload)
 values(p_provider,p_event_id,p_event_type,p_order_id,true,p_payload)
 on conflict(provider,provider_event_id) do nothing returning id into event_id;
 if event_id is null then select id into event_id from public.payment_events where provider=p_provider and provider_event_id=p_event_id; return event_id; end if;
 select * into checkout from public.payment_checkouts where provider=p_provider and provider_order_id=p_order_id for update;
 if checkout.id is null then update public.payment_events set processing_status='IGNORED',processing_error='Unknown provider order',processed_at=now() where id=event_id; return event_id; end if;
 if checkout.amount<>p_amount or checkout.currency<>upper(p_currency) then update public.payment_events set processing_status='FAILED',processing_error='Amount or currency mismatch',processed_at=now() where id=event_id; return event_id; end if;
 if checkout.status='COMPLETED' then update public.payment_events set processing_status='PROCESSED',processed_at=now() where id=event_id; return event_id; end if;
 if checkout.status not in ('CREATED','PROVIDER_PENDING','APPROVED') then update public.payment_events set processing_status='FAILED',processing_error='Checkout not payable',processed_at=now() where id=event_id; return event_id; end if;
 update public.payment_checkouts set status='COMPLETED',provider_capture_id=p_capture_id,completed_at=now(),updated_at=now() where id=checkout.id;
 if checkout.purpose='SUBSCRIPTION' then
  if checkout.organization_id is null then update public.subscriptions set status='CANCELLED',updated_at=now() where user_id=checkout.user_id and status in ('TRIALING','ACTIVE','PAST_DUE'); else update public.subscriptions set status='CANCELLED',updated_at=now() where organization_id=checkout.organization_id and status in ('TRIALING','ACTIVE','PAST_DUE'); end if;
  insert into public.subscriptions(user_id,organization_id,plan_code,status,source,external_reference,current_period_end) values(case when checkout.organization_id is null then checkout.user_id end,checkout.organization_id,checkout.plan_code,'ACTIVE','PAYMENT_PROVIDER',checkout.id::text,now()+interval '1 month') returning id into subscription_id;
 elsif checkout.purpose='TICKET_ORDER' then
  select * into ticket_order from public.ticket_orders where id=checkout.resource_id for update;
  if ticket_order.id is null or ticket_order.status<>'PAYMENT_PENDING' then raise exception 'Ticket order is not payable'; end if;
  update public.ticket_types set quantity_reserved=greatest(0,quantity_reserved-ticket_order.quantity),quantity_sold=quantity_sold+ticket_order.quantity where id=ticket_order.ticket_type_id;
  update public.ticket_orders set status='COMPLETED',updated_at=now() where id=ticket_order.id;
  insert into public.tickets(order_id,ticket_type_id,event_id,attendee_email,holder_user_id,status) values(ticket_order.id,ticket_order.ticket_type_id,ticket_order.event_id,ticket_order.buyer_email,ticket_order.user_id,'ACTIVE') returning id into ticket_id;
 end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(checkout.user_id,'payment.completed','payment_checkout',checkout.id::text,jsonb_build_object('provider',p_provider,'subscription_id',subscription_id,'ticket_id',ticket_id));
 update public.payment_events set processing_status='PROCESSED',processed_at=now() where id=event_id;
 return event_id;
end $$;

create or replace function public.request_ticket_refund(p_ticket uuid,p_reason text) returns public.payment_refunds
language plpgsql security definer set search_path='' as $$
declare ticket public.tickets%rowtype; order_row public.ticket_orders%rowtype; checkout public.payment_checkouts%rowtype; result public.payment_refunds%rowtype; caller uuid:=(select auth.uid());
begin
 if length(btrim(p_reason)) not between 3 and 500 then raise exception 'Refund reason required'; end if;
 select * into ticket from public.tickets where id=p_ticket for update;
 if ticket.status='REFUND_PENDING' and ticket.holder_user_id is not distinct from caller then
  select r.* into result from public.payment_refunds r join public.payment_checkouts c on c.id=r.checkout_id where c.resource_id=ticket.order_id and r.status='PENDING' order by r.created_at desc limit 1;
  if result.id is not null then return result; end if;
 end if;
 if caller is null or ticket.id is null or ticket.holder_user_id is distinct from caller or ticket.status not in ('ACTIVE','ISSUED') then raise exception 'Ticket not refundable'; end if;
 if not exists(select 1 from public.events where id=ticket.event_id and starts_at>now()) then raise exception 'Event has started'; end if;
 select * into order_row from public.ticket_orders where id=ticket.order_id for update;
 select * into checkout from public.payment_checkouts where resource_type='ticket_order' and resource_id=order_row.id and status='COMPLETED';
 if checkout.id is null then raise exception 'Paid checkout not found'; end if;
 insert into public.payment_refunds(checkout_id,amount,currency,status,reason,created_by) values(checkout.id,order_row.amount,order_row.currency,'PENDING',btrim(p_reason),caller) returning * into result;
 update public.tickets set status='REFUND_PENDING',updated_at=now() where id=ticket.id;
 update public.ticket_orders set status='REFUND_PENDING',updated_at=now() where id=order_row.id;
 return result;
end $$;

create or replace function public.complete_ticket_refund(p_refund uuid,p_provider_refund text,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare refund public.payment_refunds%rowtype; checkout public.payment_checkouts%rowtype; order_row public.ticket_orders%rowtype;
begin
 select * into refund from public.payment_refunds where id=p_refund for update;
 if refund.id is null or refund.status<>'PENDING' then return p_refund; end if;
 select * into checkout from public.payment_checkouts where id=refund.checkout_id for update;
 select * into order_row from public.ticket_orders where id=checkout.resource_id for update;
 update public.payment_refunds set provider_refund_id=p_provider_refund,status='COMPLETED',completed_at=now() where id=refund.id;
 update public.payment_checkouts set status='REFUNDED',updated_at=now() where id=checkout.id;
 update public.ticket_orders set status='REFUNDED',refunded_amount=refund.amount,updated_at=now() where id=order_row.id;
 update public.tickets set status='REFUNDED',updated_at=now() where order_id=order_row.id;
 update public.ticket_types set quantity_sold=greatest(0,quantity_sold-order_row.quantity) where id=order_row.ticket_type_id;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(order_row.user_id,'ticket.refunded','ticket_order',order_row.id::text,jsonb_build_object('refund_id',refund.id,'provider_refund_id',p_provider_refund,'provider_payload',p_payload));
 return refund.id;
end $$;

create or replace function public.request_ticket_transfer(p_ticket uuid,p_recipient_email text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if p_recipient_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Valid recipient email required'; end if;
 if not exists(select 1 from public.tickets t join public.events e on e.id=t.event_id where t.id=p_ticket and t.holder_user_id=(select auth.uid()) and t.status in ('ACTIVE','ISSUED') and e.starts_at>now()) then raise exception 'Ticket not transferable'; end if;
 update public.ticket_transfers set status='CANCELLED' where ticket_id=p_ticket and status='PENDING';
 insert into public.ticket_transfers(ticket_id,from_user_id,recipient_email) values(p_ticket,(select auth.uid()),lower(p_recipient_email)) returning transfer_token into result;
 return result;
end $$;

create or replace function public.cancel_complimentary_ticket(p_ticket uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare ticket public.tickets%rowtype; order_row public.ticket_orders%rowtype;
begin
 select * into ticket from public.tickets where id=p_ticket for update;
 if ticket.id is null or ticket.holder_user_id is distinct from (select auth.uid()) or ticket.status not in ('ACTIVE','ISSUED') then raise exception 'Ticket not cancellable'; end if;
 select * into order_row from public.ticket_orders where id=ticket.order_id for update;
 if order_row.amount>0 then raise exception 'Paid tickets require a refund request'; end if;
 if not exists(select 1 from public.events where id=ticket.event_id and starts_at>now()) then raise exception 'Event has started'; end if;
 update public.tickets set status='CANCELLED',updated_at=now() where id=ticket.id;
 update public.ticket_orders set status='CANCELLED',updated_at=now() where id=order_row.id;
 update public.ticket_types set quantity_sold=greatest(0,quantity_sold-order_row.quantity) where id=order_row.ticket_type_id;
 update public.ticket_transfers set status='CANCELLED' where ticket_id=ticket.id and status='PENDING';
 return ticket.id;
end $$;

create or replace function public.accept_ticket_transfer(p_token uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare transfer public.ticket_transfers%rowtype; caller_email text:=lower(coalesce(auth.jwt()->>'email','')); result uuid;
begin
 select * into transfer from public.ticket_transfers where transfer_token=p_token for update;
 if transfer.id is null or transfer.status<>'PENDING' or transfer.expires_at<=now() or caller_email='' or caller_email<>lower(transfer.recipient_email) then raise exception 'Transfer unavailable for this account'; end if;
 update public.tickets set holder_user_id=(select auth.uid()),attendee_email=caller_email,credential_token=gen_random_uuid(),updated_at=now() where id=transfer.ticket_id and holder_user_id=transfer.from_user_id and status in ('ACTIVE','ISSUED') returning id into result;
 if result is null then raise exception 'Ticket transfer failed'; end if;
 update public.ticket_transfers set status='ACCEPTED',to_user_id=(select auth.uid()),accepted_at=now() where id=transfer.id;
 return result;
end $$;

create or replace function public.ticket_reconciliation(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.events e where e.id=p_event and public.is_org_member(e.organization_id,array['OWNER','ADMIN','MANAGER','FINANCE'])) then raise exception 'Permission denied'; end if;
 select jsonb_build_object('orders',count(*),'gross',coalesce(sum(o.amount) filter(where o.status in ('COMPLETED','REFUND_PENDING','REFUNDED')),0),'refunded',coalesce(sum(o.refunded_amount),0),'net',coalesce(sum(o.amount-o.refunded_amount) filter(where o.status in ('COMPLETED','REFUND_PENDING','REFUNDED')),0),'currency',coalesce(max(o.currency),'SAR'),'completed',count(*) filter(where o.status='COMPLETED'),'pending',count(*) filter(where o.status='PAYMENT_PENDING'),'refunded_orders',count(*) filter(where o.status='REFUNDED')) into result from public.ticket_orders o where o.event_id=p_event;
 return result;
end $$;

revoke all on function private.release_expired_ticket_reservations(),public.begin_paid_ticket_checkout(uuid,text,uuid),public.complete_verified_payment(text,text,text,text,text,numeric,text,jsonb),public.request_ticket_refund(uuid,text),public.complete_ticket_refund(uuid,text,jsonb),public.request_ticket_transfer(uuid,text),public.cancel_complimentary_ticket(uuid),public.accept_ticket_transfer(uuid),public.ticket_reconciliation(uuid) from public,anon,authenticated;
grant execute on function public.begin_paid_ticket_checkout(uuid,text,uuid),public.request_ticket_refund(uuid,text),public.request_ticket_transfer(uuid,text),public.cancel_complimentary_ticket(uuid),public.accept_ticket_transfer(uuid),public.ticket_reconciliation(uuid) to authenticated;
grant execute on function public.complete_verified_payment(text,text,text,text,text,numeric,text,jsonb),public.complete_ticket_refund(uuid,text,jsonb) to service_role;
