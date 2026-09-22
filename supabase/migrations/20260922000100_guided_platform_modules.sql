-- Cuelance: protected application services for media, AI, conversations and CMS.
create or replace function public.account_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and not is_suspended)
$$;
create or replace function public.platform_admin() returns boolean language sql stable security definer set search_path='' as $$
 select public.account_active() and exists(select 1 from public.user_roles where user_id=auth.uid() and role_code in ('PLATFORM_ADMIN','SUPER_ADMIN'))
$$;
revoke all on function public.account_active(),public.platform_admin() from public;
grant execute on function public.account_active(),public.platform_admin() to authenticated;
-- A member cannot restore their own suspended account by writing their profile.
revoke update on public.profiles from authenticated;
grant update(display_name,avatar_url,locale) on public.profiles to authenticated;

create table public.ai_requests (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
 action text not null,status text not null default 'PENDING' check(status in ('PENDING','COMPLETED','FAILED')),
 input_tokens integer not null default 0,output_tokens integer not null default 0,
 created_at timestamptz not null default now()
);
create index ai_requests_user_date on public.ai_requests(user_id,created_at);
alter table public.ai_requests enable row level security;
create policy ai_own_read on public.ai_requests for select to authenticated using(user_id=auth.uid() and public.account_active());
create or replace function public.begin_ai_request(p_action text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.account_active() then raise exception 'Account unavailable'; end if;
 if p_action not in ('GENERATE_BIO','SHORTEN_BIO','CHANGE_TONE','PROMOTER_BIO','FESTIVAL_BIO','BRAND_BIO','TRANSLATE','GRAMMAR_FIX','SEO_DESCRIPTION','CAREER_SUMMARY') then raise exception 'Invalid action'; end if;
 if exists(select 1 from public.feature_flags where key='ai_enabled' and not enabled) then raise exception 'AI disabled by administrator'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,8));
 if (select count(*) from public.ai_requests where user_id=auth.uid() and created_at>now()-interval '1 day')>=20 or
 (select count(*) from public.ai_requests where user_id=auth.uid() and created_at>now()-interval '1 minute')>=3 then raise exception 'AI allowance reached. Try later.'; end if;
 insert into public.ai_requests(user_id,action) values(auth.uid(),p_action) returning id into result;
 return result;
end $$;
create or replace function public.finish_ai_request(p_id uuid,p_status text,p_input integer default 0,p_output integer default 0) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('COMPLETED','FAILED') or p_input<0 or p_output<0 then raise exception 'Invalid usage'; end if;
 update public.ai_requests set status=p_status,input_tokens=p_input,output_tokens=p_output where id=p_id and user_id=auth.uid() and status='PENDING';
end $$;

create table public.conversations(id uuid primary key default gen_random_uuid(),resource_type text not null check(resource_type in ('application','booking')),resource_id uuid not null,title text not null,created_at timestamptz not null default now(),unique(resource_type,resource_id));
create table public.conversation_members(conversation_id uuid references public.conversations(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,primary key(conversation_id,user_id));
create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations(id) on delete cascade,sender_id uuid not null references public.profiles(id),body text not null check(length(btrim(body)) between 1 and 4000),client_id uuid not null,created_at timestamptz not null default now(),unique(sender_id,client_id));
create index messages_thread_date on public.messages(conversation_id,created_at);
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
create or replace function public.in_conversation(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.account_active() and exists(select 1 from public.conversation_members where conversation_id=p_id and user_id=auth.uid())
$$;
create policy conversations_read on public.conversations for select to authenticated using(public.in_conversation(id));
create policy participants_read on public.conversation_members for select to authenticated using(public.in_conversation(conversation_id));
create policy messages_read on public.messages for select to authenticated using(public.in_conversation(conversation_id));
create or replace function public.message_contexts() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(q),'[]') from (
 select 'application' as kind,a.id,o.title from public.applications a join public.dj_profiles d on d.id=a.dj_profile_id join public.opportunities o on o.id=a.opportunity_id
 where public.account_active() and (d.user_id=auth.uid() or exists(select 1 from public.organization_members m where m.organization_id=o.organization_id and m.user_id=auth.uid() and m.role in ('OWNER','ADMIN','MANAGER','EDITOR')))
 union all
 select 'booking',b.id,coalesce(b.organization_name,b.requester_name) from public.booking_inquiries b join public.dj_profiles d on d.id=b.dj_profile_id where public.account_active() and b.requester_user_id is not null and (d.user_id=auth.uid() or b.requester_user_id=auth.uid())
 ) q
$$;
create or replace function public.open_conversation(p_kind text,p_resource uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; artist uuid; requester uuid; org uuid; heading text;
begin
 if not public.account_active() then raise exception 'Account unavailable'; end if;
 if p_kind='application' then
 select d.user_id,o.organization_id,o.title into artist,org,heading from public.applications a join public.dj_profiles d on d.id=a.dj_profile_id join public.opportunities o on o.id=a.opportunity_id where a.id=p_resource;
 if artist is null or (artist<>auth.uid() and not exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid() and role in ('OWNER','ADMIN','MANAGER','EDITOR'))) then raise exception 'Permission denied'; end if;
 elsif p_kind='booking' then
 select d.user_id,b.requester_user_id,coalesce(b.organization_name,b.requester_name) into artist,requester,heading from public.booking_inquiries b join public.dj_profiles d on d.id=b.dj_profile_id where b.id=p_resource;
 if artist is null or requester is null or auth.uid() not in (artist,requester) then raise exception 'Permission denied'; end if;
 else raise exception 'Invalid conversation context'; end if;
 insert into public.conversations(resource_type,resource_id,title) values(p_kind,p_resource,heading) on conflict(resource_type,resource_id) do update set title=excluded.title returning id into cid;
 insert into public.conversation_members values(cid,artist) on conflict do nothing;
 if requester is not null then insert into public.conversation_members values(cid,requester) on conflict do nothing; end if;
 if org is not null then
 delete from public.conversation_members where conversation_id=cid and user_id<>artist;
 insert into public.conversation_members select cid,user_id from public.organization_members where organization_id=org and role in ('OWNER','ADMIN','MANAGER','EDITOR') on conflict do nothing;
 end if;
 return cid;
end $$;
create or replace function public.send_message(p_conversation uuid,p_body text,p_client uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.in_conversation(p_conversation) then raise exception 'Permission denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,9));
 select id into result from public.messages where sender_id=auth.uid() and client_id=p_client;
 if result is not null then return result; end if;
 if (select count(*) from public.messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'Too many messages'; end if;
 insert into public.messages(conversation_id,sender_id,body,client_id) values(p_conversation,auth.uid(),btrim(p_body),p_client) returning id into result;
 return result;
end $$;

create table public.cms_revisions(id uuid primary key default gen_random_uuid(),page_id uuid not null references public.cms_pages(id),document jsonb not null,actor_id uuid not null references public.profiles(id),created_at timestamptz not null default now());
create table public.platform_settings(key text primary key,value jsonb not null,updated_at timestamptz not null default now());
alter table public.cms_revisions enable row level security;
alter table public.platform_settings enable row level security;
create policy cms_admin_read on public.cms_pages for select to authenticated using(public.platform_admin());
create policy revisions_admin_read on public.cms_revisions for select to authenticated using(public.platform_admin());
create policy settings_read on public.platform_settings for select using(key in ('branding','navigation','locales'));
insert into public.platform_settings(key,value) values ('branding','{"name":"Cuelance","tagline":"Music. People. Possibilities."}'),('navigation','[]'),('locales','{"default":"en","enabled":["en","ar"]}') on conflict do nothing;
create or replace function public.admin_save_page(p_document jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid; block jsonb;
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 if length(coalesce(p_document->>'title','')) not between 1 and 160 or coalesce(p_document->>'slug','') !~ '^[a-z0-9][a-z0-9-]{0,79}$' then raise exception 'Title or slug invalid'; end if;
 if jsonb_typeof(p_document->'blocks') is distinct from 'array' or jsonb_array_length(p_document->'blocks')>50 or octet_length(p_document::text)>200000 then raise exception 'Invalid blocks'; end if;
 for block in select * from jsonb_array_elements(p_document->'blocks') loop
 if coalesce(block->>'type','') not in ('hero','text','image','cta','faq','feature-grid') or length(coalesce(block->>'body',''))>10000 then raise exception 'Invalid block'; end if;
 if coalesce(block->>'url','')<>'' and coalesce(block->>'url','') !~ '^(/[^/]|https://)' then raise exception 'Unsafe link'; end if;
 end loop;
 pid:=coalesce(nullif(p_document->>'id','')::uuid,gen_random_uuid());
 insert into public.cms_pages(id,slug,language,title,seo_title,seo_description,status,blocks,published_at) values(pid,p_document->>'slug',p_document->>'language',p_document->>'title',p_document->>'seo_title',p_document->>'seo_description',p_document->>'status',p_document->'blocks',case when p_document->>'status'='PUBLISHED' then now() end)
 on conflict(id) do update set slug=excluded.slug,language=excluded.language,title=excluded.title,seo_title=excluded.seo_title,seo_description=excluded.seo_description,status=excluded.status,blocks=excluded.blocks,published_at=excluded.published_at;
 insert into public.cms_revisions(page_id,document,actor_id) values(pid,p_document,auth.uid());
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'cms.save','cms_page',pid::text,jsonb_build_object('status',p_document->>'status'));
 return pid;
end $$;
create or replace function public.admin_save_setting(p_key text,p_value jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 if p_key not in ('branding','navigation','locales','email_templates','notification_templates','template_settings') or octet_length(p_value::text)>100000 then raise exception 'Invalid configuration'; end if;
 if p_key='branding' and (jsonb_typeof(p_value)<>'object' or length(coalesce(p_value->>'name','')) not between 1 and 80) then raise exception 'Brand name required'; end if;
 if p_key='navigation' and jsonb_typeof(p_value)<>'array' then raise exception 'Navigation must be an array'; end if;
 insert into public.platform_settings values(p_key,p_value,now()) on conflict(key) do update set value=excluded.value,updated_at=now();
 insert into public.audit_logs(actor_id,action,resource_type,resource_id) values(auth.uid(),'settings.update','platform_setting',p_key);
end $$;
create or replace function public.admin_list(p_entity text,p_page integer default 0,p_search text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; rows_json jsonb; total bigint;
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 if p_entity not in ('profiles','dj_profiles','organizations','events','communities','tickets','ticket_orders','opportunities','cms_pages','audit_logs','feature_flags','platform_settings','user_roles','ai_requests') then raise exception 'Invalid resource'; end if;
 if p_page<0 or p_page>10000 or length(p_search)>100 then raise exception 'Invalid page'; end if;
 execute format('select count(*) from public.%I t where to_jsonb(t)::text ilike $1',p_entity) into total using '%'||p_search||'%';
 -- Ticket credentials never appear in central admin exports.
 execute format('select coalesce(jsonb_agg(r),''[]'') from (select to_jsonb(t)-''credential_token'' as r from public.%I t where to_jsonb(t)::text ilike $1 order by to_jsonb(t)::text limit 25 offset $2) q',p_entity) into rows_json using '%'||p_search||'%',p_page*25;
 return jsonb_build_object('rows',rows_json,'total',total);
end $$;
create or replace function public.admin_action(p_action text,p_id text,p_value text) returns void language plpgsql security definer set search_path='' as $$
declare old_value jsonb;
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 if p_action='suspend' then
 if p_id::uuid=auth.uid() then raise exception 'Cannot suspend yourself'; end if;
 if exists(select 1 from public.user_roles where user_id=p_id::uuid and role_code='SUPER_ADMIN') then raise exception 'Super administrator protected'; end if;
 select jsonb_build_object('is_suspended',is_suspended) into old_value from public.profiles where id=p_id::uuid;
 update public.profiles set is_suspended=p_value::boolean where id=p_id::uuid;
 elsif p_action='verify_artist' then
 if p_value not in ('VERIFIED','UNVERIFIED') then raise exception 'Invalid verification'; end if;
 update public.dj_profiles set verification_status=p_value where id=p_id::uuid;
 elsif p_action='revoke_ticket' then
 update public.tickets set status='REVOKED' where id=p_id::uuid and status in ('ACTIVE','ISSUED');
 elsif p_action='feature' then
 if p_id not in ('ai_enabled','marketplace_enabled','communities_enabled','ticketing_enabled') then raise exception 'Invalid feature'; end if;
 insert into public.feature_flags(key,enabled) values(p_id,p_value::boolean) on conflict(key) do update set enabled=excluded.enabled,updated_at=now();
 elsif p_action in ('grant_role','revoke_role') then
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role_code='SUPER_ADMIN') or p_value='SUPER_ADMIN' or p_id::uuid=auth.uid() then raise exception 'Role change forbidden'; end if;
 if p_action='grant_role' then insert into public.user_roles(user_id,role_code) values(p_id::uuid,p_value) on conflict do nothing;
 else delete from public.user_roles where user_id=p_id::uuid and role_code=p_value; end if;
 else raise exception 'Unsupported action'; end if;
 if not found then raise exception 'Resource unavailable or state unchanged'; end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'admin.'||p_action,p_action,p_id,jsonb_build_object('before',old_value,'value',p_value));
end $$;

-- Suspension applies to authenticated operations across existing RLS-protected resources.
do $$ declare t text; begin
 foreach t in array array['dj_profiles','epks','epk_sections','opportunities','applications','organizations','organization_members','events','communities','community_members','ticket_types','ticket_orders','tickets','media_assets','booking_inquiries'] loop
 execute format('create policy active_account_guard on public.%I as restrictive for all to authenticated using (public.account_active()) with check (public.account_active())',t);
 end loop;
end $$;
update storage.buckets set file_size_limit=26214400,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/wav','audio/ogg','application/pdf','application/zip'] where id='media';
create policy media_active_account on storage.objects as restrictive for all to authenticated using(bucket_id<>'media' or public.account_active()) with check(bucket_id<>'media' or public.account_active());

-- No anonymous execution of new privileged routines.
revoke all on function public.begin_ai_request(text),public.finish_ai_request(uuid,text,integer,integer),public.in_conversation(uuid),public.message_contexts(),public.open_conversation(text,uuid),public.send_message(uuid,text,uuid),public.admin_save_page(jsonb),public.admin_save_setting(text,jsonb),public.admin_list(text,integer,text),public.admin_action(text,text,text) from public;
grant execute on function public.begin_ai_request(text),public.finish_ai_request(uuid,text,integer,integer),public.in_conversation(uuid),public.message_contexts(),public.open_conversation(text,uuid),public.send_message(uuid,text,uuid),public.admin_save_page(jsonb),public.admin_save_setting(text,jsonb),public.admin_list(text,integer,text),public.admin_action(text,text,text) to authenticated;
