-- Internal stock and fulfilment updates must not revalidate unchanged media
-- against the service role's empty auth.uid(). Media is still validated on
-- insert and whenever a media reference changes.

create or replace function public.validate_provider_media() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
 asset uuid;
 assets uuid[] := '{}'::uuid[];
begin
 if tg_table_name='provider_pages' then
  new.updated_at:=now();
  if tg_op='UPDATE' and (new.owner_user_id<>old.owner_user_id or new.role<>old.role) then
   raise exception 'Page ownership and role cannot change';
  end if;
  if new.status='PUBLISHED' and (length(btrim(new.bio))<20 or new.cover_asset_id is null) then
   raise exception 'Add a cover image and a biography of at least 20 characters before publishing';
  end if;
  if tg_op='INSERT' or new.cover_asset_id is distinct from old.cover_asset_id then
   assets:=array_append(assets,new.cover_asset_id);
  end if;
  if tg_op='INSERT' or new.avatar_asset_id is distinct from old.avatar_asset_id then
   assets:=array_append(assets,new.avatar_asset_id);
  end if;
 else
  if tg_op='UPDATE' and new.provider_id<>old.provider_id then
   raise exception 'Offering provider cannot change';
  end if;
  if tg_op='INSERT' or new.image_asset_id is distinct from old.image_asset_id then
   assets:=array_append(assets,new.image_asset_id);
  end if;
 end if;
 foreach asset in array assets loop
  if asset is not null and not exists(
   select 1 from public.media_assets m
   where m.id=asset and m.owner_user_id=(select auth.uid()) and m.visibility='PUBLIC' and m.kind='IMAGE'
  ) then raise exception 'Choose one of your public images'; end if;
 end loop;
 return new;
end $$;

revoke all on function public.validate_provider_media() from public,anon,authenticated;
