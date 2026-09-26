create table public.provider_catalogs(
 id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.provider_pages(id) on delete cascade,name text not null check(length(btrim(name)) between 2 and 120),description text not null default '',status text not null default 'ACTIVE' check(status in ('DRAFT','ACTIVE','PAUSED')),sort_order integer not null default 0,created_at timestamptz not null default now(),unique(provider_id,name)
);
alter table public.provider_offerings add column catalog_id uuid references public.provider_catalogs(id) on delete set null;
alter table public.provider_offerings add column sku text;
alter table public.provider_offerings add column pricing_model text not null default 'FIXED' check(pricing_model in ('FIXED','FROM','QUOTE','HOURLY','DAILY','PER_PERSON','PER_UNIT'));
alter table public.provider_offerings add column inventory_mode text not null default 'UNLIMITED' check(inventory_mode in ('UNLIMITED','TRACKED','SCHEDULED'));
alter table public.provider_offerings add column stock_quantity integer check(stock_quantity is null or stock_quantity>=0);
alter table public.provider_offerings add column minimum_quantity integer not null default 1 check(minimum_quantity>0);
alter table public.provider_offerings add column maximum_quantity integer check(maximum_quantity is null or maximum_quantity>=minimum_quantity);
alter table public.provider_offerings add column lead_time_hours integer not null default 0 check(lead_time_hours between 0 and 8760);
create unique index provider_offering_sku on public.provider_offerings(provider_id,sku) where sku is not null;
create table public.provider_attribute_definitions(
 id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.provider_pages(id) on delete cascade,key text not null check(key ~ '^[a-z][a-z0-9_]{1,49}$'),label text not null check(length(btrim(label)) between 2 and 80),data_type text not null check(data_type in ('TEXT','NUMBER','BOOLEAN','SELECT','MULTISELECT','DATE','DURATION')),options jsonb not null default '[]'::jsonb check(jsonb_typeof(options)='array'),unit text,required boolean not null default false,filterable boolean not null default true,sort_order integer not null default 0,unique(provider_id,key)
);
create table public.provider_offering_attribute_values(
 offering_id uuid not null references public.provider_offerings(id) on delete cascade,attribute_id uuid not null references public.provider_attribute_definitions(id) on delete cascade,value jsonb not null,primary key(offering_id,attribute_id)
);
create table public.provider_offering_variants(
 id uuid primary key default gen_random_uuid(),offering_id uuid not null references public.provider_offerings(id) on delete cascade,sku text,title text not null check(length(btrim(title)) between 1 and 120),price_delta numeric(12,2) not null default 0,stock_quantity integer check(stock_quantity is null or stock_quantity>=0),attributes jsonb not null default '{}'::jsonb check(jsonb_typeof(attributes)='object'),status text not null default 'ACTIVE' check(status in ('ACTIVE','PAUSED')),unique(offering_id,sku)
);
create table public.provider_offering_availability(
 id uuid primary key default gen_random_uuid(),offering_id uuid not null references public.provider_offerings(id) on delete cascade,starts_at timestamptz not null,ends_at timestamptz not null,capacity integer not null default 1 check(capacity>0),reserved integer not null default 0 check(reserved>=0 and reserved<=capacity),price_override numeric(12,2),status text not null default 'AVAILABLE' check(status in ('AVAILABLE','BLOCKED','SOLD_OUT')),check(ends_at>starts_at)
);
create or replace function public.validate_provider_attribute_value() returns trigger language plpgsql set search_path='' as $$
declare definition public.provider_attribute_definitions%rowtype; offering_provider uuid;
begin
 select * into definition from public.provider_attribute_definitions where id=new.attribute_id;
 select provider_id into offering_provider from public.provider_offerings where id=new.offering_id;
 if definition.id is null or offering_provider is distinct from definition.provider_id then raise exception 'Attribute does not belong to this provider'; end if;
 if (definition.data_type in ('TEXT','SELECT','DATE') and jsonb_typeof(new.value)<>'string')
  or (definition.data_type in ('NUMBER','DURATION') and jsonb_typeof(new.value)<>'number')
  or (definition.data_type='BOOLEAN' and jsonb_typeof(new.value)<>'boolean')
  or (definition.data_type='MULTISELECT' and jsonb_typeof(new.value)<>'array') then raise exception 'Attribute value has the wrong type'; end if;
 if definition.data_type='SELECT' and not definition.options @> jsonb_build_array(new.value) then raise exception 'Value is not an allowed option'; end if;
 if definition.data_type='MULTISELECT' and exists(select 1 from jsonb_array_elements(new.value) value where jsonb_typeof(value)<>'string' or not definition.options @> jsonb_build_array(value)) then raise exception 'Value contains an invalid option'; end if;
 return new;
end $$;
create trigger validate_provider_attribute_value before insert or update on public.provider_offering_attribute_values for each row execute function public.validate_provider_attribute_value();
create or replace function public.validate_provider_offering_catalog() returns trigger language plpgsql set search_path='' as $$
begin
 if new.catalog_id is not null and not exists(select 1 from public.provider_catalogs where id=new.catalog_id and provider_id=new.provider_id) then raise exception 'Catalogue does not belong to this provider'; end if;
 return new;
end $$;
create trigger validate_provider_offering_catalog before insert or update of catalog_id,provider_id on public.provider_offerings for each row execute function public.validate_provider_offering_catalog();
alter table public.provider_catalogs enable row level security;alter table public.provider_attribute_definitions enable row level security;alter table public.provider_offering_attribute_values enable row level security;alter table public.provider_offering_variants enable row level security;alter table public.provider_offering_availability enable row level security;
create policy provider_catalog_public on public.provider_catalogs for select to anon,authenticated using(status='ACTIVE' and exists(select 1 from public.provider_pages p where p.id=provider_id and p.status='PUBLISHED'));
create policy provider_catalog_owner on public.provider_catalogs for all to authenticated using(exists(select 1 from public.provider_pages p where p.id=provider_id and p.owner_user_id=(select auth.uid()))) with check(exists(select 1 from public.provider_pages p where p.id=provider_id and p.owner_user_id=(select auth.uid())));
create policy attribute_definition_public on public.provider_attribute_definitions for select to anon,authenticated using(exists(select 1 from public.provider_pages p where p.id=provider_id and p.status='PUBLISHED'));
create policy attribute_definition_owner on public.provider_attribute_definitions for all to authenticated using(exists(select 1 from public.provider_pages p where p.id=provider_id and p.owner_user_id=(select auth.uid()))) with check(exists(select 1 from public.provider_pages p where p.id=provider_id and p.owner_user_id=(select auth.uid())));
create policy attribute_value_public on public.provider_offering_attribute_values for select to anon,authenticated using(exists(select 1 from public.provider_offerings o join public.provider_pages p on p.id=o.provider_id where o.id=offering_id and o.status='ACTIVE' and p.status='PUBLISHED'));
create policy attribute_value_owner on public.provider_offering_attribute_values for all to authenticated using(exists(select 1 from public.provider_offerings o join public.provider_pages p on p.id=o.provider_id where o.id=offering_id and p.owner_user_id=(select auth.uid()))) with check(exists(select 1 from public.provider_offerings o join public.provider_pages p on p.id=o.provider_id join public.provider_attribute_definitions d on d.id=attribute_id and d.provider_id=p.id where o.id=offering_id and p.owner_user_id=(select auth.uid())));
create policy variant_public on public.provider_offering_variants for select to anon,authenticated using(status='ACTIVE' and exists(select 1 from public.provider_offerings o join public.provider_pages p on p.id=o.provider_id where o.id=offering_id and o.status='ACTIVE' and p.status='PUBLISHED'));
create policy variant_owner on public.provider_offering_variants for all to authenticated using(exists(select 1 from public.provider_offerings o join public.provider_pages p on p.id=o.provider_id where o.id=offering_id and p.owner_user_id=(select auth.uid()))) with check(exists(select 1 from public.provider_offerings o join public.provider_pages p on p.id=o.provider_id where o.id=offering_id and p.owner_user_id=(select auth.uid())));
create policy availability_public on public.provider_offering_availability for select to anon,authenticated using(status='AVAILABLE' and ends_at>now() and exists(select 1 from public.provider_offerings o join public.provider_pages p on p.id=o.provider_id where o.id=offering_id and o.status='ACTIVE' and p.status='PUBLISHED'));
create policy availability_owner on public.provider_offering_availability for all to authenticated using(exists(select 1 from public.provider_offerings o join public.provider_pages p on p.id=o.provider_id where o.id=offering_id and p.owner_user_id=(select auth.uid()))) with check(exists(select 1 from public.provider_offerings o join public.provider_pages p on p.id=o.provider_id where o.id=offering_id and p.owner_user_id=(select auth.uid())));
revoke all on public.provider_catalogs,public.provider_attribute_definitions,public.provider_offering_attribute_values,public.provider_offering_variants,public.provider_offering_availability from anon,authenticated;
grant select on public.provider_catalogs,public.provider_attribute_definitions,public.provider_offering_attribute_values,public.provider_offering_variants,public.provider_offering_availability to anon,authenticated;
grant insert,update,delete on public.provider_catalogs,public.provider_attribute_definitions,public.provider_offering_attribute_values,public.provider_offering_variants,public.provider_offering_availability to authenticated;
grant select,insert,update,delete on public.provider_catalogs,public.provider_attribute_definitions,public.provider_offering_attribute_values,public.provider_offering_variants,public.provider_offering_availability to service_role;

create table public.provider_orders(
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.provider_pages(id), offering_id uuid not null references public.provider_offerings(id), customer_user_id uuid not null references public.profiles(id), inquiry_id uuid references public.provider_inquiries(id),
 status text not null default 'REQUESTED' check(status in ('REQUESTED','QUOTE_SENT','ACCEPTED','PAYMENT_PENDING','DEPOSIT_PAID','CONFIRMED','SCHEDULED','IN_PROGRESS','FULFILLED','COMPLETED','CANCEL_REQUESTED','CANCELLED','DISPUTED','REFUNDED','DECLINED')),
 quantity integer not null default 1 check(quantity between 1 and 1000), unit_price numeric(12,2) not null check(unit_price>=0), subtotal numeric(12,2) generated always as (quantity*unit_price) stored,
 tax_amount numeric(12,2) not null default 0 check(tax_amount>=0), total_amount numeric(12,2) not null check(total_amount>=0), deposit_amount numeric(12,2) not null default 0 check(deposit_amount>=0), amount_paid numeric(12,2) not null default 0 check(amount_paid>=0), currency text not null check(currency ~ '^[A-Z]{3}$'),
 requirements text not null check(length(btrim(requirements)) between 10 and 4000), service_location text not null default '' check(length(service_location)<=500), starts_at timestamptz, ends_at timestamptz, customer_note text not null default '', provider_note text not null default '', cancellation_reason text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), accepted_at timestamptz, fulfilled_at timestamptz, completed_at timestamptz,
 check(ends_at is null or starts_at is null or ends_at>starts_at), check(deposit_amount<=total_amount), check(amount_paid<=total_amount)
);
create table public.provider_order_history(
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.provider_orders(id) on delete cascade, actor_user_id uuid references public.profiles(id), from_status text, to_status text not null, note text not null default '', created_at timestamptz not null default now()
);
create table public.provider_order_deliverables(
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.provider_orders(id) on delete cascade, title text not null check(length(btrim(title)) between 2 and 160), description text not null default '', media_asset_id uuid references public.media_assets(id), status text not null default 'PENDING' check(status in ('PENDING','SUBMITTED','ACCEPTED','REVISION_REQUESTED')), submitted_at timestamptz, accepted_at timestamptz
);
create index provider_orders_customer on public.provider_orders(customer_user_id,created_at desc);
create index provider_orders_provider on public.provider_orders(provider_id,status,created_at desc);
create index provider_order_history_order on public.provider_order_history(order_id,created_at);
alter table public.provider_orders enable row level security;alter table public.provider_order_history enable row level security;alter table public.provider_order_deliverables enable row level security;
create policy provider_orders_participants_read on public.provider_orders for select to authenticated using(public.account_active() and (customer_user_id=(select auth.uid()) or exists(select 1 from public.provider_pages p where p.id=provider_id and p.owner_user_id=(select auth.uid()))));
create policy provider_order_history_read on public.provider_order_history for select to authenticated using(exists(select 1 from public.provider_orders o join public.provider_pages p on p.id=o.provider_id where o.id=order_id and (o.customer_user_id=(select auth.uid()) or p.owner_user_id=(select auth.uid()))));
create policy provider_order_deliverables_read on public.provider_order_deliverables for select to authenticated using(exists(select 1 from public.provider_orders o join public.provider_pages p on p.id=o.provider_id where o.id=order_id and (o.customer_user_id=(select auth.uid()) or p.owner_user_id=(select auth.uid()))));
revoke all on public.provider_orders,public.provider_order_history,public.provider_order_deliverables from anon,authenticated;
grant select on public.provider_orders,public.provider_order_history,public.provider_order_deliverables to authenticated;
grant select,insert,update,delete on public.provider_orders,public.provider_order_history,public.provider_order_deliverables to service_role;

create or replace function public.create_provider_order(p_offering uuid,p_quantity integer,p_requirements text,p_location text default '',p_starts_at timestamptz default null,p_ends_at timestamptz default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare offering public.provider_offerings%rowtype; provider public.provider_pages%rowtype; result uuid;
begin
 if (select auth.uid()) is null or not public.account_active() then raise exception 'Authentication required'; end if;
 if p_quantity not between 1 and 1000 or length(btrim(p_requirements)) not between 10 and 4000 or length(p_location)>500 or (p_ends_at is not null and p_starts_at is not null and p_ends_at<=p_starts_at) then raise exception 'Invalid order request'; end if;
 select * into offering from public.provider_offerings where id=p_offering and status='ACTIVE';select * into provider from public.provider_pages where id=offering.provider_id and status='PUBLISHED';
 if offering.id is null or provider.id is null or provider.owner_user_id=(select auth.uid()) or p_quantity<offering.minimum_quantity or (offering.maximum_quantity is not null and p_quantity>offering.maximum_quantity) or (offering.inventory_mode='TRACKED' and coalesce(offering.stock_quantity,0)<p_quantity) then raise exception 'Offering unavailable or requested quantity invalid'; end if;
 insert into public.provider_orders(provider_id,offering_id,customer_user_id,quantity,unit_price,total_amount,currency,requirements,service_location,starts_at,ends_at)
 values(provider.id,offering.id,(select auth.uid()),p_quantity,offering.price,offering.price*p_quantity,offering.currency,btrim(p_requirements),btrim(p_location),p_starts_at,p_ends_at) returning id into result;
 insert into public.provider_order_history(order_id,actor_user_id,to_status,note) values(result,(select auth.uid()),'REQUESTED','Customer submitted order request');return result;
end $$;

create or replace function public.provider_quote_order(p_order uuid,p_unit_price numeric,p_tax numeric,p_deposit numeric,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare order_row public.provider_orders%rowtype; total numeric;
begin
 select o.* into order_row from public.provider_orders o join public.provider_pages p on p.id=o.provider_id where o.id=p_order and p.owner_user_id=(select auth.uid()) for update of o;
 if order_row.id is null or order_row.status not in ('REQUESTED','QUOTE_SENT') or p_unit_price<0 or p_tax<0 then raise exception 'Order cannot be quoted'; end if;
 total:=order_row.quantity*p_unit_price+p_tax;if p_deposit<0 or p_deposit>total then raise exception 'Invalid deposit'; end if;
 update public.provider_orders set status='QUOTE_SENT',unit_price=p_unit_price,tax_amount=p_tax,total_amount=total,deposit_amount=p_deposit,provider_note=left(p_note,4000),updated_at=now() where id=p_order;
 insert into public.provider_order_history(order_id,actor_user_id,from_status,to_status,note) values(p_order,(select auth.uid()),order_row.status,'QUOTE_SENT','Provider issued quote');return p_order;
end $$;

create or replace function public.customer_order_action(p_order uuid,p_action text,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare order_row public.provider_orders%rowtype; next_status text;
begin
 select * into order_row from public.provider_orders where id=p_order and customer_user_id=(select auth.uid()) for update;
 if order_row.id is null then raise exception 'Order unavailable'; end if;
 if p_action='ACCEPT' and order_row.status='QUOTE_SENT' then next_status:='ACCEPTED';
 elsif p_action='CANCEL' and order_row.status in ('REQUESTED','QUOTE_SENT','ACCEPTED') then next_status:='CANCELLED';
 elsif p_action='REQUEST_CANCEL' and order_row.status in ('DEPOSIT_PAID','CONFIRMED','SCHEDULED','IN_PROGRESS') then next_status:='CANCEL_REQUESTED';
 elsif p_action='DISPUTE' and order_row.status in ('IN_PROGRESS','FULFILLED','COMPLETED') then next_status:='DISPUTED';
 elsif p_action='ACCEPT_DELIVERY' and order_row.status='FULFILLED' then next_status:='COMPLETED'; else raise exception 'Invalid customer action'; end if;
 update public.provider_orders set status=next_status,customer_note=left(p_note,4000),accepted_at=case when next_status='ACCEPTED' then now() else accepted_at end,completed_at=case when next_status='COMPLETED' then now() else completed_at end,updated_at=now() where id=p_order;
 insert into public.provider_order_history(order_id,actor_user_id,from_status,to_status,note) values(p_order,(select auth.uid()),order_row.status,next_status,left(p_note,1000));return p_order;
end $$;

create or replace function public.provider_fulfillment_action(p_order uuid,p_status text,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare order_row public.provider_orders%rowtype; allowed boolean:=false;
begin
 select o.* into order_row from public.provider_orders o join public.provider_pages p on p.id=o.provider_id where o.id=p_order and p.owner_user_id=(select auth.uid()) for update of o;
 if order_row.status='CONFIRMED' and p_status='SCHEDULED' then allowed:=true;elsif order_row.status in ('CONFIRMED','SCHEDULED') and p_status='IN_PROGRESS' then allowed:=true;elsif order_row.status='IN_PROGRESS' and p_status='FULFILLED' then allowed:=true;elsif order_row.status in ('REQUESTED','QUOTE_SENT') and p_status='DECLINED' then allowed:=true;elsif order_row.status='CANCEL_REQUESTED' and p_status='CANCELLED' then allowed:=true;end if;
 if order_row.id is null or not allowed then raise exception 'Invalid fulfilment transition'; end if;
 update public.provider_orders set status=p_status,provider_note=left(p_note,4000),fulfilled_at=case when p_status='FULFILLED' then now() else fulfilled_at end,updated_at=now() where id=p_order;
 insert into public.provider_order_history(order_id,actor_user_id,from_status,to_status,note) values(p_order,(select auth.uid()),order_row.status,p_status,left(p_note,1000));return p_order;
end $$;

create or replace function public.begin_provider_order_checkout(p_order uuid,p_idempotency uuid) returns public.payment_checkouts
language plpgsql security definer set search_path='' as $$
declare order_row public.provider_orders%rowtype; existing public.payment_checkouts%rowtype; due numeric; result public.payment_checkouts%rowtype;
begin
 select * into existing from public.payment_checkouts where user_id=(select auth.uid()) and idempotency_key=p_idempotency;if existing.id is not null then return existing;end if;
 select * into order_row from public.provider_orders where id=p_order and customer_user_id=(select auth.uid()) for update;if order_row.id is null or order_row.status not in ('ACCEPTED','DEPOSIT_PAID') then raise exception 'Order is not ready for payment';end if;
 due:=case when order_row.status='DEPOSIT_PAID' then order_row.total_amount-order_row.amount_paid when order_row.deposit_amount>0 then order_row.deposit_amount else order_row.total_amount end;if due<=0 then raise exception 'Payment amount unavailable';end if;
 insert into public.payment_checkouts(user_id,purpose,provider,status,amount,currency,resource_type,resource_id,idempotency_key,metadata) values((select auth.uid()),'PROVIDER_ORDER','PAYPAL','CREATED',due,order_row.currency,'provider_order',order_row.id,p_idempotency,jsonb_build_object('provider_id',order_row.provider_id,'offering_id',order_row.offering_id)) returning * into result;
 update public.provider_orders set status='PAYMENT_PENDING',updated_at=now() where id=order_row.id;insert into public.provider_order_history(order_id,actor_user_id,from_status,to_status,note) values(order_row.id,(select auth.uid()),order_row.status,'PAYMENT_PENDING','Checkout started');return result;
end $$;

create or replace function public.complete_provider_order_payment(p_order_id text,p_capture_id text,p_amount numeric,p_currency text,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare checkout public.payment_checkouts%rowtype; order_row public.provider_orders%rowtype; next_status text;
begin
 select * into checkout from public.payment_checkouts where provider='PAYPAL' and provider_order_id=p_order_id for update;if checkout.id is null or checkout.purpose<>'PROVIDER_ORDER' then raise exception 'Provider checkout unavailable';end if;
 if checkout.amount<>p_amount or checkout.currency<>upper(p_currency) then raise exception 'Payment amount mismatch';end if;if checkout.status='COMPLETED' then return checkout.resource_id;end if;
 select * into order_row from public.provider_orders where id=checkout.resource_id for update;if order_row.status<>'PAYMENT_PENDING' then raise exception 'Order not payable';end if;
 next_status:=case when order_row.amount_paid+p_amount>=order_row.total_amount then 'CONFIRMED' else 'DEPOSIT_PAID' end;
 update public.payment_checkouts set status='COMPLETED',provider_capture_id=p_capture_id,completed_at=now(),updated_at=now(),metadata=metadata||jsonb_build_object('capture',p_payload) where id=checkout.id;
 update public.provider_orders set amount_paid=amount_paid+p_amount,status=next_status,updated_at=now() where id=order_row.id;
 if next_status='CONFIRMED' then update public.provider_offerings set stock_quantity=greatest(0,stock_quantity-order_row.quantity) where id=order_row.offering_id and inventory_mode='TRACKED';end if;
 insert into public.provider_order_history(order_id,actor_user_id,from_status,to_status,note) values(order_row.id,order_row.customer_user_id,'PAYMENT_PENDING',next_status,'Verified payment captured');return order_row.id;
end $$;

revoke all on function public.create_provider_order(uuid,integer,text,text,timestamptz,timestamptz),public.provider_quote_order(uuid,numeric,numeric,numeric,text),public.customer_order_action(uuid,text,text),public.provider_fulfillment_action(uuid,text,text),public.begin_provider_order_checkout(uuid,uuid),public.complete_provider_order_payment(text,text,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_provider_order(uuid,integer,text,text,timestamptz,timestamptz),public.provider_quote_order(uuid,numeric,numeric,numeric,text),public.customer_order_action(uuid,text,text),public.provider_fulfillment_action(uuid,text,text),public.begin_provider_order_checkout(uuid,uuid) to authenticated;
grant execute on function public.complete_provider_order_payment(text,text,numeric,text,jsonb) to service_role;

create or replace function public.admin_list(p_entity text,p_page integer default 0,p_search text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; rows_json jsonb; total bigint;
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 if p_entity not in ('profiles','dj_profiles','organizations','events','communities','tickets','ticket_orders','opportunities','cms_pages','audit_logs','feature_flags','platform_settings','user_roles','ai_requests','vendor_profiles','vendor_products','vendor_quote_requests','vendor_quotes','my_cuelance_items','operational_logs','provider_pages','provider_offerings','provider_inquiries','provider_catalogs','provider_attribute_definitions','provider_offering_variants','provider_offering_availability','provider_orders','provider_order_history','provider_order_deliverables') then raise exception 'Invalid resource'; end if;
 if p_page<0 or p_page>10000 or length(p_search)>100 then raise exception 'Invalid page'; end if;
 execute format('select count(*) from public.%I t where to_jsonb(t)::text ilike $1',p_entity) into total using '%'||p_search||'%';
 execute format('select coalesce(jsonb_agg(r),''[]'') from (select to_jsonb(t)-''credential_token'' as r from public.%I t where to_jsonb(t)::text ilike $1 order by to_jsonb(t)::text limit 25 offset $2) q',p_entity) into rows_json using '%'||p_search||'%',p_page*25;
 return jsonb_build_object('rows',rows_json,'total',total);
end $$;
revoke execute on function public.admin_list(text,integer,text) from public,anon;
grant execute on function public.admin_list(text,integer,text) to authenticated;
