create index if not exists messages_sender_date on public.messages(sender_id,created_at);
create index if not exists checkins_scanner_date on public.checkins(scanner_user_id,checked_in_at);
create or replace function public.feature_enabled(p_key text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select enabled from public.feature_flags where key=p_key),true)
$$;
revoke all on function public.feature_enabled(text) from public;
grant execute on function public.feature_enabled(text) to anon,authenticated;
create policy marketplace_feature on public.opportunities as restrictive for all to anon,authenticated using(public.feature_enabled('marketplace_enabled')) with check(public.feature_enabled('marketplace_enabled'));
create policy application_feature on public.applications as restrictive for all to authenticated using(public.feature_enabled('marketplace_enabled')) with check(public.feature_enabled('marketplace_enabled'));
create policy communities_feature on public.communities as restrictive for all to anon,authenticated using(public.feature_enabled('communities_enabled')) with check(public.feature_enabled('communities_enabled'));
create policy memberships_feature on public.community_members as restrictive for all to authenticated using(public.feature_enabled('communities_enabled')) with check(public.feature_enabled('communities_enabled'));
create or replace function private.guard_artist_verification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not public.platform_admin() and ((tg_op='INSERT' and new.verification_status<>'UNVERIFIED') or (tg_op='UPDATE' and new.verification_status is distinct from old.verification_status)) then raise exception 'Only platform administration can change verification'; end if;
 return new;
end $$;
create trigger artist_verification_guard before insert or update on public.dj_profiles for each row execute function private.guard_artist_verification();
