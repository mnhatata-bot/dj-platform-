create or replace function public.admin_list(p_entity text,p_page integer default 0,p_search text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; rows_json jsonb; total bigint;
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 if p_entity not in ('profiles','dj_profiles','organizations','events','communities','tickets','ticket_orders','opportunities','cms_pages','audit_logs','feature_flags','platform_settings','user_roles','ai_requests','vendor_profiles','vendor_products','vendor_quote_requests','vendor_quotes','my_cuelance_items','operational_logs','provider_pages','provider_offerings','provider_inquiries') then raise exception 'Invalid resource'; end if;
 if p_page<0 or p_page>10000 or length(p_search)>100 then raise exception 'Invalid page'; end if;
 execute format('select count(*) from public.%I t where to_jsonb(t)::text ilike $1',p_entity) into total using '%'||p_search||'%';
 execute format('select coalesce(jsonb_agg(r),''[]'') from (select to_jsonb(t)-''credential_token'' as r from public.%I t where to_jsonb(t)::text ilike $1 order by to_jsonb(t)::text limit 25 offset $2) q',p_entity) into rows_json using '%'||p_search||'%',p_page*25;
 return jsonb_build_object('rows',rows_json,'total',total);
end $$;

-- These APIs require an authenticated account; Supabase default grants may
-- survive a revoke from PUBLIC, so revoke the concrete anonymous role too.
revoke execute on function public.create_vendor_rfq(uuid,text,text,timestamptz,uuid),public.is_org_member(uuid,text[]),public.record_operational_log(text,text,text,jsonb,text,text),public.resolve_operational_log(uuid,text),public.upsert_vendor_profile(uuid,text[],text[],text[]) from anon;
revoke execute on function public.admin_list(text,integer,text) from public,anon;
grant execute on function public.admin_list(text,integer,text) to authenticated;
