-- Bounded administrative editing; ownership, billing and credentials are never editable here.
create or replace function public.admin_update_entity(p_entity text,p_id uuid,p_changes jsonb) returns void language plpgsql security definer set search_path='' as $$
declare before_data jsonb; after_data jsonb; allowed text[]; item text; assignments text='';
begin
 if not public.platform_admin() then raise exception 'Permission denied'; end if;
 case p_entity
 when 'organizations' then allowed:=array['name','kind'];
 when 'events' then allowed:=array['title','description','venue','address','city','country','status','visibility'];
 when 'communities' then allowed:=array['name','description','visibility','membership_mode','status'];
 when 'opportunities' then allowed:=array['title','description','city','country','status'];
 when 'dj_profiles' then allowed:=array['stage_name','short_bio','long_bio','primary_city','country'];
 else raise exception 'Unsupported resource'; end case;
 if jsonb_typeof(p_changes)<>'object' or p_changes='{}' or octet_length(p_changes::text)>50000 then raise exception 'Invalid changes'; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1 for update',p_entity) into before_data using p_id;
 if before_data is null then raise exception 'Not found'; end if;
 for item in select jsonb_object_keys(p_changes) loop
  if not item=any(allowed) or jsonb_typeof(p_changes->item)<>'string' then raise exception 'Field not editable'; end if;
  if item in ('name','title','stage_name') and length(btrim(p_changes->>item)) not between 1 and 160 then raise exception 'Name or title invalid'; end if;
  if length(p_changes->>item)>10000 then raise exception 'Field too long'; end if;
  if item='status' and p_entity='events' and p_changes->>item<>before_data->>item then
   if not ((before_data->>'status'='DRAFT' and p_changes->>item in ('PUBLISHED','CANCELLED')) or (before_data->>'status'='PUBLISHED' and p_changes->>item in ('LIVE','CANCELLED')) or (before_data->>'status'='LIVE' and p_changes->>item in ('ENDED','CANCELLED'))) then raise exception 'Invalid event transition'; end if;
   if p_changes->>item='PUBLISHED' and (coalesce(before_data->>'venue','')='' or before_data->>'starts_at' is null) then raise exception 'Venue and start time required'; end if;
  end if;
  if item='status' and p_entity='opportunities' and p_changes->>item<>before_data->>item then
   if not ((before_data->>'status'='DRAFT' and p_changes->>item='PUBLISHED') or (before_data->>'status'='PUBLISHED' and p_changes->>item in ('CLOSED','CANCELLED')) or (before_data->>'status'='CLOSED' and p_changes->>item='FILLED')) then raise exception 'Invalid opportunity transition'; end if;
  end if;
  assignments:=assignments||case when assignments='' then '' else ',' end||format('%I=$1->>%L',item,item);
 end loop;
 execute format('update public.%I set %s where id=$2 returning to_jsonb(%I.*)',p_entity,assignments,p_entity) into after_data using p_changes,p_id;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'admin.resource.updated',p_entity,p_id::text,jsonb_build_object('before',before_data,'after',after_data));
end $$;
revoke all on function public.admin_update_entity(text,uuid,jsonb) from public;
grant execute on function public.admin_update_entity(text,uuid,jsonb) to authenticated;

-- Enforce structural settings schemas even when the RPC is called directly.
create or replace function private.validate_platform_setting() returns trigger language plpgsql set search_path='' as $$
declare item jsonb;
begin
 if new.key='navigation' then
  if jsonb_typeof(new.value)<>'array' or jsonb_array_length(new.value)>30 then raise exception 'Navigation requires up to 30 links'; end if;
  for item in select * from jsonb_array_elements(new.value) loop
   if jsonb_typeof(item->'label')<>'string' or length(item->>'label') not between 1 and 80 or coalesce(item->>'url','') !~ '^(/[^/]|https://)' then raise exception 'Invalid navigation link'; end if;
  end loop;
 elsif new.key in ('email_templates','notification_templates','template_settings','locales','branding') and jsonb_typeof(new.value)<>'object' then raise exception 'Configuration must be an object'; end if;
 return new;
end $$;
create trigger validate_platform_setting before insert or update on public.platform_settings for each row execute function private.validate_platform_setting();
