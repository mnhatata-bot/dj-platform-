-- Cuelance operations log: clear admin-visible diagnostics for failures and optimization.
create table if not exists public.operational_logs (
 id uuid primary key default gen_random_uuid(),
 level text not null check (level in ('INFO','WARNING','ERROR','FATAL')),
 area text not null check (length(btrim(area)) between 2 and 80),
 message text not null check (length(btrim(message)) between 1 and 2000),
 context jsonb not null default '{}'::jsonb,
 user_id uuid references public.profiles(id) on delete set null,
 request_path text,
 user_agent text,
 resolved_at timestamptz,
 resolution_note text,
 created_at timestamptz not null default now()
);
create index if not exists operational_logs_level_date on public.operational_logs(level,created_at desc);
create index if not exists operational_logs_area_date on public.operational_logs(area,created_at desc);
create index if not exists operational_logs_unresolved on public.operational_logs(created_at desc) where resolved_at is null;
alter table public.operational_logs enable row level security;

create policy operational_logs_admin_read on public.operational_logs
 for select to authenticated using (public.platform_admin());
create policy operational_logs_admin_update on public.operational_logs
 for update to authenticated using (public.platform_admin()) with check (public.platform_admin());

create or replace function public.record_operational_log(
 p_level text,
 p_area text,
 p_message text,
 p_context jsonb default '{}'::jsonb,
 p_request_path text default null,
 p_user_agent text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; caller uuid := auth.uid();
begin
 if p_level not in ('INFO','WARNING','ERROR','FATAL') then raise exception 'Invalid log level'; end if;
 if length(btrim(p_area)) not between 2 and 80 or length(btrim(p_message)) not between 1 and 2000 then raise exception 'Invalid log payload'; end if;
 if p_context is null or jsonb_typeof(p_context) <> 'object' or octet_length(p_context::text) > 20000 then raise exception 'Invalid log context'; end if;
 if caller is null then
  raise exception 'Authentication required';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text, 41));
 if (select count(*) from public.operational_logs where user_id=caller and created_at>now()-interval '1 minute') >= 30 then
  raise exception 'Log rate limit reached';
 end if;
 insert into public.operational_logs(level,area,message,context,user_id,request_path,user_agent)
 values(p_level,btrim(p_area),btrim(p_message),p_context,caller,left(p_request_path,500),left(p_user_agent,500))
 returning id into result;
 return result;
end $$;

create or replace function public.resolve_operational_log(p_id uuid, p_note text default '') returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 update public.operational_logs
 set resolved_at=now(), resolution_note=left(coalesce(p_note,''),1000)
 where id=p_id;
 if not found then raise exception 'Log not found'; end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'ops_log.resolve','operational_log',p_id::text,jsonb_build_object('note',left(coalesce(p_note,''),1000)));
end $$;

create or replace function public.admin_list(p_entity text,p_page integer default 0,p_search text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; rows_json jsonb; total bigint;
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 if p_entity not in ('profiles','dj_profiles','organizations','events','communities','tickets','ticket_orders','opportunities','cms_pages','audit_logs','feature_flags','platform_settings','user_roles','ai_requests','vendor_profiles','vendor_products','vendor_quote_requests','vendor_quotes','my_cuelance_items','operational_logs') then raise exception 'Invalid resource'; end if;
 if p_page<0 or p_page>10000 or length(p_search)>100 then raise exception 'Invalid page'; end if;
 execute format('select count(*) from public.%I t where to_jsonb(t)::text ilike $1',p_entity) into total using '%'||p_search||'%';
 execute format('select coalesce(jsonb_agg(r),''[]'') from (select to_jsonb(t)-''credential_token'' as r from public.%I t where to_jsonb(t)::text ilike $1 order by to_jsonb(t)::text limit 25 offset $2) q',p_entity) into rows_json using '%'||p_search||'%',p_page*25;
 return jsonb_build_object('rows',rows_json,'total',total);
end $$;

revoke all on function public.record_operational_log(text,text,text,jsonb,text,text), public.resolve_operational_log(uuid,text), public.admin_list(text,integer,text) from public;
grant execute on function public.record_operational_log(text,text,text,jsonb,text,text) to authenticated;
grant execute on function public.resolve_operational_log(uuid,text), public.admin_list(text,integer,text) to authenticated;
