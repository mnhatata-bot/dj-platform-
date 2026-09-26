-- Controlled beta perimeter and durable notification delivery.
insert into public.feature_flags(key,enabled) values
 ('beta_invite_only',true),('payments_enabled',false),('notifications_enabled',true)
on conflict(key) do nothing;

create or replace function private.guard_controlled_beta_payment() returns trigger language plpgsql set search_path='' as $$
begin
 if new.amount>0 and not coalesce((select enabled from public.feature_flags where key='payments_enabled'),false) then raise exception 'Payments are disabled during the controlled beta'; end if;
 return new;
end $$;
create trigger controlled_beta_payment_guard before insert on public.payment_checkouts for each row execute function private.guard_controlled_beta_payment();

create table public.beta_access(
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.profiles(id) on delete cascade,
 email text check(email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
 status text not null default 'INVITED' check(status in ('INVITED','ACTIVE','REVOKED')),
 notes text not null default '' check(length(notes)<=1000),
 invited_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(user_id is not null or email is not null)
);
create unique index beta_access_user on public.beta_access(user_id) where user_id is not null;
create unique index beta_access_email on public.beta_access(lower(email)) where email is not null;
alter table public.beta_access enable row level security;
revoke all on public.beta_access from anon,authenticated;
grant select,insert,update,delete on public.beta_access to service_role;

create or replace function public.account_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.profiles p where p.id=(select auth.uid()) and not p.is_suspended
  and (
   not coalesce((select enabled from public.feature_flags where key='beta_invite_only'),false)
   or exists(select 1 from public.user_roles r where r.user_id=p.id and r.role_code in ('PLATFORM_ADMIN','SUPER_ADMIN'))
   or exists(select 1 from public.beta_access b where b.status='ACTIVE' and (b.user_id=p.id or (b.email is not null and lower(b.email)=lower(coalesce((select auth.jwt()->>'email'),'')))))
  )
 )
$$;

create or replace function public.beta_access_status() returns text language sql stable security definer set search_path='' as $$
 select case
  when (select auth.uid()) is null then 'SIGNED_OUT'
  when exists(select 1 from public.profiles where id=(select auth.uid()) and is_suspended) then 'SUSPENDED'
  when exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role_code in ('PLATFORM_ADMIN','SUPER_ADMIN')) then 'ACTIVE'
  when not coalesce((select enabled from public.feature_flags where key='beta_invite_only'),false) then 'ACTIVE'
  else coalesce((select status from public.beta_access where user_id=(select auth.uid()) or lower(email)=lower(coalesce((select auth.jwt()->>'email'),'')) order by case status when 'ACTIVE' then 1 when 'INVITED' then 2 else 3 end limit 1),'PENDING') end
$$;
revoke all on function public.beta_access_status() from public,anon;
grant execute on function public.beta_access_status() to authenticated;

create or replace function public.admin_manage_beta_access(p_email text,p_status text,p_notes text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; matched_user uuid;
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 if lower(trim(p_email)) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or p_status not in ('INVITED','ACTIVE','REVOKED') or length(p_notes)>1000 then raise exception 'Invalid beta access record'; end if;
 select id into matched_user from auth.users where lower(email)=lower(trim(p_email));
 insert into public.beta_access(user_id,email,status,notes,invited_by) values(matched_user,lower(trim(p_email)),p_status,p_notes,(select auth.uid()))
 on conflict((lower(email))) where email is not null do update set user_id=coalesce(excluded.user_id,public.beta_access.user_id),status=excluded.status,notes=excluded.notes,updated_at=now()
 returning id into result;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values((select auth.uid()),'beta_access.'||lower(p_status),'beta_access',result::text,jsonb_build_object('email',lower(trim(p_email))));
 return result;
end $$;
revoke all on function public.admin_manage_beta_access(text,text,text) from public,anon;
grant execute on function public.admin_manage_beta_access(text,text,text) to authenticated;

create table public.user_notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind ~ '^[a-z][a-z0-9_.-]{1,79}$'),title text not null check(length(title) between 2 and 160),body text not null check(length(body) between 2 and 2000),
 resource_type text,resource_id text,payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),read_at timestamptz,created_at timestamptz not null default now()
);
create index user_notifications_inbox on public.user_notifications(user_id,read_at,created_at desc);
alter table public.user_notifications enable row level security;
create policy notification_owner_read on public.user_notifications for select to authenticated using(user_id=(select auth.uid()) and public.account_active());
create policy notification_owner_update on public.user_notifications for update to authenticated using(user_id=(select auth.uid()) and public.account_active()) with check(user_id=(select auth.uid()) and public.account_active());
revoke all on public.user_notifications from anon,authenticated;
grant select on public.user_notifications to authenticated;
grant update(read_at) on public.user_notifications to authenticated;
grant select,insert,update,delete on public.user_notifications to service_role;

create table public.notification_outbox(
 id uuid primary key default gen_random_uuid(),notification_id uuid references public.user_notifications(id) on delete set null,
 recipient_email text not null check(recipient_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),template_key text not null,
 subject text not null check(length(subject) between 2 and 200),body_text text not null check(length(body_text) between 2 and 10000),payload jsonb not null default '{}'::jsonb,
 status text not null default 'PENDING' check(status in ('PENDING','PROCESSING','SENT','FAILED','CANCELLED')),attempts integer not null default 0 check(attempts between 0 and 10),
 scheduled_at timestamptz not null default now(),locked_at timestamptz,sent_at timestamptz,last_error text,created_at timestamptz not null default now()
);
create index notification_outbox_queue on public.notification_outbox(status,scheduled_at) where status in ('PENDING','PROCESSING');
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon,authenticated;
grant select,insert,update,delete on public.notification_outbox to service_role;

create or replace function private.enqueue_notification(p_user uuid,p_kind text,p_title text,p_body text,p_resource_type text default null,p_resource_id text default null,p_payload jsonb default '{}'::jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; recipient text;
begin
 if p_user is null or not coalesce((select enabled from public.feature_flags where key='notifications_enabled'),true) then return null; end if;
 insert into public.user_notifications(user_id,kind,title,body,resource_type,resource_id,payload) values(p_user,p_kind,left(p_title,160),left(p_body,2000),p_resource_type,p_resource_id,p_payload) returning id into result;
 select lower(email) into recipient from auth.users where id=p_user;
 if recipient is not null then insert into public.notification_outbox(notification_id,recipient_email,template_key,subject,body_text,payload) values(result,recipient,p_kind,left(p_title,200),left(p_body,10000),p_payload); end if;
 return result;
end $$;
revoke all on function private.enqueue_notification(uuid,text,text,text,text,text,jsonb) from public,anon,authenticated;

create or replace function private.notify_provider_order_status() returns trigger language plpgsql security definer set search_path='' as $$
declare customer uuid; owner uuid; listing text; target uuid;
begin
 select o.customer_user_id,p.owner_user_id,f.title into customer,owner,listing from public.provider_orders o join public.provider_pages p on p.id=o.provider_id join public.provider_offerings f on f.id=o.offering_id where o.id=new.order_id;
 foreach target in array array[customer,owner] loop
  if target is distinct from new.actor_user_id then perform private.enqueue_notification(target,'provider_order.'||lower(new.to_status),'Order '||replace(initcap(lower(new.to_status)),'_',' '),listing||' is now '||replace(lower(new.to_status),'_',' '),'provider_order',new.order_id::text,jsonb_build_object('status',new.to_status)); end if;
 end loop;
 return new;
end $$;
create trigger provider_order_notifications after insert on public.provider_order_history for each row execute function private.notify_provider_order_status();

create or replace function private.notify_ticket_issued() returns trigger language plpgsql security definer set search_path='' as $$
declare event_title text;
begin
 if new.holder_user_id is not null and new.status in ('ACTIVE','ISSUED') then
  select title into event_title from public.events where id=new.event_id;
  perform private.enqueue_notification(new.holder_user_id,'ticket.issued','Your ticket is ready',coalesce(event_title,'Event')||' is now in your wallet.','ticket',new.id::text,jsonb_build_object('event_id',new.event_id));
 end if; return new;
end $$;
create trigger ticket_issued_notification after insert on public.tickets for each row execute function private.notify_ticket_issued();

create or replace function public.claim_notification_batch(p_limit integer default 25) returns setof public.notification_outbox language plpgsql security definer set search_path='' as $$
begin
 if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;
 return query update public.notification_outbox o set status='PROCESSING',attempts=attempts+1,locked_at=now()
 where id in (select id from public.notification_outbox where (status='PENDING' or (status='PROCESSING' and locked_at<now()-interval '10 minutes')) and scheduled_at<=now() and attempts<5 order by created_at for update skip locked limit greatest(1,least(p_limit,100))) returning o.*;
end $$;
create or replace function public.finish_notification_delivery(p_id uuid,p_success boolean,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;
 update public.notification_outbox set status=case when p_success then 'SENT' when attempts>=5 then 'FAILED' else 'PENDING' end,sent_at=case when p_success then now() end,last_error=case when p_success then null else left(coalesce(p_error,'Delivery failed'),1000) end,scheduled_at=case when p_success then scheduled_at else now()+(least(attempts,5)*interval '5 minutes') end where id=p_id and status='PROCESSING';
end $$;
revoke all on function public.claim_notification_batch(integer),public.finish_notification_delivery(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.claim_notification_batch(integer),public.finish_notification_delivery(uuid,boolean,text) to service_role;

create or replace function public.admin_action(p_action text,p_id text,p_value text) returns void language plpgsql security definer set search_path='' as $$
declare old_value jsonb;
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 if p_action='suspend' then
  if p_id::uuid=(select auth.uid()) then raise exception 'Cannot suspend yourself'; end if;
  if exists(select 1 from public.user_roles where user_id=p_id::uuid and role_code='SUPER_ADMIN') then raise exception 'Super administrator protected'; end if;
  select jsonb_build_object('is_suspended',is_suspended) into old_value from public.profiles where id=p_id::uuid; update public.profiles set is_suspended=p_value::boolean where id=p_id::uuid;
 elsif p_action='verify_artist' then if p_value not in ('VERIFIED','UNVERIFIED') then raise exception 'Invalid verification'; end if;update public.dj_profiles set verification_status=p_value where id=p_id::uuid;
 elsif p_action='revoke_ticket' then update public.tickets set status='REVOKED' where id=p_id::uuid and status in ('ACTIVE','ISSUED');
 elsif p_action='feature' then
  if p_id not in ('ai_enabled','marketplace_enabled','communities_enabled','ticketing_enabled','beta_invite_only','payments_enabled','notifications_enabled') then raise exception 'Invalid feature'; end if;
  insert into public.feature_flags(key,enabled) values(p_id,p_value::boolean) on conflict(key) do update set enabled=excluded.enabled,updated_at=now();
 elsif p_action in ('grant_role','revoke_role') then
  if not exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role_code='SUPER_ADMIN') or p_value='SUPER_ADMIN' or p_id::uuid=(select auth.uid()) then raise exception 'Role change forbidden'; end if;
  if p_action='grant_role' then insert into public.user_roles(user_id,role_code) values(p_id::uuid,p_value) on conflict do nothing; else delete from public.user_roles where user_id=p_id::uuid and role_code=p_value; end if;
 else raise exception 'Unsupported action'; end if;
 if not found then raise exception 'Resource unavailable or state unchanged'; end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values((select auth.uid()),'admin.'||p_action,p_action,p_id,jsonb_build_object('before',old_value,'value',p_value));
end $$;
revoke all on function public.admin_action(text,text,text) from public,anon;
grant execute on function public.admin_action(text,text,text) to authenticated;

create or replace function public.admin_list(p_entity text,p_page integer default 0,p_search text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows_json jsonb; total bigint;
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 if p_entity not in ('profiles','dj_profiles','organizations','events','communities','tickets','ticket_orders','opportunities','cms_pages','audit_logs','feature_flags','platform_settings','user_roles','ai_requests','vendor_profiles','vendor_products','vendor_quote_requests','vendor_quotes','my_cuelance_items','operational_logs','provider_pages','provider_offerings','provider_inquiries','provider_catalogs','provider_attribute_definitions','provider_offering_variants','provider_offering_availability','provider_orders','provider_order_history','provider_order_deliverables','beta_access','user_notifications','notification_outbox') then raise exception 'Invalid resource'; end if;
 if p_page<0 or p_page>10000 or length(p_search)>100 then raise exception 'Invalid page'; end if;
 execute format('select count(*) from public.%I t where to_jsonb(t)::text ilike $1',p_entity) into total using '%'||p_search||'%';
 execute format('select coalesce(jsonb_agg(r),''[]'') from (select to_jsonb(t)-''credential_token'' as r from public.%I t where to_jsonb(t)::text ilike $1 order by to_jsonb(t)::text limit 25 offset $2) q',p_entity) into rows_json using '%'||p_search||'%',p_page*25;
 return jsonb_build_object('rows',rows_json,'total',total);
end $$;
revoke execute on function public.admin_list(text,integer,text) from public,anon;
grant execute on function public.admin_list(text,integer,text) to authenticated;
