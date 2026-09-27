-- Keep checkout retries deterministic under duplicate requests and reject
-- idempotency keys reused for a different purchase intent.

create or replace function public.begin_subscription_checkout(
 p_plan text,
 p_organization uuid default null,
 p_idempotency uuid default gen_random_uuid()
) returns public.payment_checkouts
language plpgsql security definer set search_path='' as $$
declare
 selected_plan public.plans%rowtype;
 existing public.payment_checkouts%rowtype;
 result public.payment_checkouts%rowtype;
begin
 if (select auth.uid()) is null or not public.account_active() then raise exception 'Authentication required'; end if;
 if p_organization is not null and not exists(
  select 1 from public.organization_members m
  where m.organization_id=p_organization and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN','FINANCE')
 ) then raise exception 'Billing permission denied'; end if;
 select * into selected_plan from public.plans where code=p_plan and active and monthly_price>0;
 if selected_plan.code is null then raise exception 'Paid plan unavailable'; end if;
 if selected_plan.audience='ORGANIZATION' and p_organization is null then raise exception 'Organization plan requires an organization'; end if;
 if selected_plan.audience='ARTIST' and p_organization is not null then raise exception 'Artist plan belongs to an account'; end if;

 select * into existing from public.payment_checkouts
 where user_id=(select auth.uid()) and idempotency_key=p_idempotency;
 if existing.id is not null then
  if existing.purpose<>'SUBSCRIPTION'
   or existing.plan_code is distinct from selected_plan.code
   or existing.organization_id is distinct from p_organization
  then raise exception 'Idempotency key already used for another checkout'; end if;
  return existing;
 end if;

 insert into public.payment_checkouts(user_id,organization_id,purpose,provider,amount,currency,plan_code,idempotency_key)
 values((select auth.uid()),p_organization,'SUBSCRIPTION','PAYPAL',selected_plan.monthly_price,selected_plan.currency,selected_plan.code,p_idempotency)
 on conflict(user_id,idempotency_key) do nothing
 returning * into result;
 if result.id is null then
  select * into existing from public.payment_checkouts
  where user_id=(select auth.uid()) and idempotency_key=p_idempotency;
  if existing.purpose<>'SUBSCRIPTION'
   or existing.plan_code is distinct from selected_plan.code
   or existing.organization_id is distinct from p_organization
  then raise exception 'Idempotency key already used for another checkout'; end if;
  return existing;
 end if;
 return result;
end $$;

create or replace function public.begin_paid_ticket_checkout(
 p_ticket_type uuid,
 p_buyer_email text,
 p_idempotency uuid
) returns public.payment_checkouts
language plpgsql security definer set search_path='' as $$
declare
 tt public.ticket_types%rowtype;
 ev public.events%rowtype;
 existing public.payment_checkouts%rowtype;
 order_id uuid;
 result public.payment_checkouts%rowtype;
begin
 if (select auth.uid()) is null or not public.account_active() then raise exception 'Authentication required'; end if;
 if p_buyer_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Valid buyer email required'; end if;
 select c.* into existing from public.payment_checkouts c
 where c.user_id=(select auth.uid()) and c.idempotency_key=p_idempotency;
 if existing.id is not null then
  if existing.purpose<>'TICKET_ORDER'
   or existing.metadata->>'ticket_type_id' is distinct from p_ticket_type::text
   or not exists(select 1 from public.ticket_orders o where o.id=existing.resource_id and lower(o.buyer_email)=lower(p_buyer_email))
  then raise exception 'Idempotency key already used for another checkout'; end if;
  return existing;
 end if;

 perform private.release_expired_ticket_reservations();
 select * into tt from public.ticket_types where id=p_ticket_type for update;
 if tt.id is null or tt.status<>'ACTIVE' or tt.price<=0 then raise exception 'Paid ticket unavailable'; end if;

 -- A concurrent request may have completed while this request waited for the
 -- inventory row lock. Re-read the key before reserving another ticket.
 select c.* into existing from public.payment_checkouts c
 where c.user_id=(select auth.uid()) and c.idempotency_key=p_idempotency;
 if existing.id is not null then
  if existing.purpose<>'TICKET_ORDER'
   or existing.metadata->>'ticket_type_id' is distinct from p_ticket_type::text
   or not exists(select 1 from public.ticket_orders o where o.id=existing.resource_id and lower(o.buyer_email)=lower(p_buyer_email))
  then raise exception 'Idempotency key already used for another checkout'; end if;
  return existing;
 end if;

 select * into ev from public.events where id=tt.event_id;
 if ev.id is null or ev.status not in ('PUBLISHED','LIVE') or tt.quantity_sold+tt.quantity_reserved>=tt.capacity then raise exception 'Ticket unavailable or sold out'; end if;
 if (tt.sales_start is not null and tt.sales_start>now()) or (tt.sales_end is not null and tt.sales_end<=now()) or tt.approval_required or ev.approval_required then raise exception 'Ticket sale unavailable or approval required'; end if;
 insert into public.ticket_orders(event_id,ticket_type_id,user_id,buyer_email,amount,currency,status,quantity,idempotency_key,expires_at)
 values(tt.event_id,tt.id,(select auth.uid()),lower(p_buyer_email),tt.price,tt.currency,'PAYMENT_PENDING',1,p_idempotency,now()+interval '15 minutes') returning id into order_id;
 update public.ticket_types set quantity_reserved=quantity_reserved+1 where id=tt.id;
 insert into public.payment_checkouts(user_id,purpose,provider,status,amount,currency,resource_type,resource_id,idempotency_key,metadata)
 values((select auth.uid()),'TICKET_ORDER','PAYPAL','CREATED',tt.price,tt.currency,'ticket_order',order_id,p_idempotency,jsonb_build_object('event_id',tt.event_id,'ticket_type_id',tt.id,'buyer_email',lower(p_buyer_email))) returning * into result;
 return result;
end $$;

create or replace function public.begin_provider_order_checkout(
 p_order uuid,
 p_idempotency uuid
) returns public.payment_checkouts
language plpgsql security definer set search_path='' as $$
declare
 order_row public.provider_orders%rowtype;
 existing public.payment_checkouts%rowtype;
 due numeric;
 result public.payment_checkouts%rowtype;
begin
 if (select auth.uid()) is null or not public.account_active() then raise exception 'Authentication required'; end if;
 select * into existing from public.payment_checkouts
 where user_id=(select auth.uid()) and idempotency_key=p_idempotency;
 if existing.id is not null then
  if existing.purpose<>'PROVIDER_ORDER' or existing.resource_id is distinct from p_order
  then raise exception 'Idempotency key already used for another checkout'; end if;
  return existing;
 end if;

 select * into order_row from public.provider_orders
 where id=p_order and customer_user_id=(select auth.uid()) for update;
 if order_row.id is null then raise exception 'Order is not ready for payment'; end if;

 -- Re-read after the order lock to make simultaneous retries deterministic.
 select * into existing from public.payment_checkouts
 where user_id=(select auth.uid()) and idempotency_key=p_idempotency;
 if existing.id is not null then
  if existing.purpose<>'PROVIDER_ORDER' or existing.resource_id is distinct from p_order
  then raise exception 'Idempotency key already used for another checkout'; end if;
  return existing;
 end if;
 if order_row.status not in ('ACCEPTED','DEPOSIT_PAID') then raise exception 'Order is not ready for payment'; end if;

 due:=case when order_row.status='DEPOSIT_PAID' then order_row.total_amount-order_row.amount_paid when order_row.deposit_amount>0 then order_row.deposit_amount else order_row.total_amount end;
 if due<=0 then raise exception 'Payment amount unavailable'; end if;
 insert into public.payment_checkouts(user_id,purpose,provider,status,amount,currency,resource_type,resource_id,idempotency_key,metadata)
 values((select auth.uid()),'PROVIDER_ORDER','PAYPAL','CREATED',due,order_row.currency,'provider_order',order_row.id,p_idempotency,jsonb_build_object('provider_id',order_row.provider_id,'offering_id',order_row.offering_id)) returning * into result;
 update public.provider_orders set status='PAYMENT_PENDING',updated_at=now() where id=order_row.id;
 insert into public.provider_order_history(order_id,actor_user_id,from_status,to_status,note)
 values(order_row.id,(select auth.uid()),order_row.status,'PAYMENT_PENDING','Checkout started');
 return result;
end $$;

revoke all on function public.begin_subscription_checkout(text,uuid,uuid),public.begin_paid_ticket_checkout(uuid,text,uuid),public.begin_provider_order_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_subscription_checkout(text,uuid,uuid),public.begin_paid_ticket_checkout(uuid,text,uuid),public.begin_provider_order_checkout(uuid,uuid) to authenticated;
