-- Server-owned marketplace and community state machines.

drop policy if exists opportunities_write on public.opportunities;
create policy opportunities_write on public.opportunities for all to authenticated
using (public.account_active() and public.is_org_member(organization_id,array['OWNER','ADMIN','MANAGER','EDITOR']))
with check (public.account_active() and public.is_org_member(organization_id,array['OWNER','ADMIN','MANAGER','EDITOR']));

drop policy if exists applications_insert on public.applications;
drop policy if exists applications_read on public.applications;
drop policy if exists applications_update on public.applications;
create policy applications_insert on public.applications for insert to authenticated
with check (
 public.account_active() and status='SUBMITTED'
 and exists(select 1 from public.dj_profiles d where d.id=dj_profile_id and d.user_id=auth.uid())
 and exists(select 1 from public.opportunities o where o.id=opportunity_id and o.status='PUBLISHED')
);
create policy applications_read on public.applications for select to authenticated using (
 public.account_active() and (
  exists(select 1 from public.dj_profiles d where d.id=dj_profile_id and d.user_id=auth.uid())
  or exists(select 1 from public.opportunities o where o.id=opportunity_id and public.is_org_member(o.organization_id,array['OWNER','ADMIN','MANAGER','EDITOR']))
 )
);

create or replace function public.normalize_application_submission() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 new.status:='SUBMITTED';
 new.updated_at:=now();
 if not exists(select 1 from public.opportunities where id=new.opportunity_id and status='PUBLISHED') then raise exception 'Opportunity is not accepting applications'; end if;
 if exists(select 1 from public.applications where opportunity_id=new.opportunity_id and dj_profile_id=new.dj_profile_id) then raise exception 'Application already submitted'; end if;
 return new;
end $$;
revoke all on function public.normalize_application_submission() from public,anon,authenticated;
drop trigger if exists normalize_application_submission on public.applications;
create trigger normalize_application_submission before insert on public.applications for each row execute function public.normalize_application_submission();

create or replace function public.transition_application(p_application uuid,p_status text) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.applications%rowtype; artist_user uuid; org uuid; manager boolean; artist boolean;
begin
 if auth.uid() is null or not public.account_active() then raise exception 'Authentication required'; end if;
 select x.* into a from public.applications x where x.id=p_application for update;
 if a.id is null then raise exception 'Application not found'; end if;
 select d.user_id,o.organization_id into artist_user,org from public.dj_profiles d join public.opportunities o on o.id=a.opportunity_id where d.id=a.dj_profile_id;
 artist:=artist_user=auth.uid(); manager:=public.is_org_member(org,array['OWNER','ADMIN','MANAGER','EDITOR']);
 if artist then
  if p_status<>'WITHDRAWN' or a.status not in ('SUBMITTED','VIEWED','SHORTLISTED') then raise exception 'Invalid artist transition'; end if;
 elsif manager then
  if not ((a.status='SUBMITTED' and p_status in ('VIEWED','SHORTLISTED','DECLINED')) or (a.status='VIEWED' and p_status in ('SHORTLISTED','DECLINED')) or (a.status='SHORTLISTED' and p_status in ('SELECTED','DECLINED'))) then raise exception 'Invalid promoter transition'; end if;
 else raise exception 'Permission denied'; end if;
 update public.applications set status=p_status,updated_at=now() where id=p_application;
 if p_status='SELECTED' then
  update public.opportunities set status='FILLED',updated_at=now() where id=a.opportunity_id;
  update public.applications set status='DECLINED',updated_at=now() where opportunity_id=a.opportunity_id and id<>p_application and status not in ('WITHDRAWN','DECLINED');
 end if;
 return p_status;
end $$;
revoke all on function public.transition_application(uuid,text) from public,anon;
grant execute on function public.transition_application(uuid,text) to authenticated;

drop policy if exists communities_write on public.communities;
create policy communities_write on public.communities for all to authenticated
using (public.account_active() and public.is_org_member(organization_id,array['OWNER','ADMIN','MANAGER','EDITOR']))
with check (public.account_active() and public.is_org_member(organization_id,array['OWNER','ADMIN','MANAGER','EDITOR']));
drop policy if exists community_members_insert on public.community_members;
drop policy if exists community_members_read on public.community_members;
create policy community_members_insert on public.community_members for insert to authenticated
with check (public.account_active() and user_id=auth.uid());
create policy community_members_read on public.community_members for select to authenticated using (
 public.account_active() and (user_id=auth.uid() or exists(select 1 from public.communities c where c.id=community_id and public.is_org_member(c.organization_id,array['OWNER','ADMIN','MANAGER','EDITOR'])))
);

create or replace function public.normalize_membership_request() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare mode text; state text;
begin
 select membership_mode,status into mode,state from public.communities where id=new.community_id;
 if state<>'ACTIVE' or mode in ('INVITE_ONLY','CLOSED') then raise exception 'Community is not accepting requests'; end if;
 new.status:=case when mode='OPEN' then 'ACTIVE' else 'PENDING' end;
 new.joined_at:=case when mode='OPEN' then now() else null end;
 new.tier:=null; new.tags:='{}'::text[];
 return new;
end $$;
revoke all on function public.normalize_membership_request() from public,anon,authenticated;
drop trigger if exists normalize_membership_request on public.community_members;
create trigger normalize_membership_request before insert on public.community_members for each row execute function public.normalize_membership_request();

create or replace function public.transition_community_member(p_community uuid,p_user uuid,p_status text) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_status text; org uuid;
begin
 if auth.uid() is null or not public.account_active() then raise exception 'Authentication required'; end if;
 select m.status,c.organization_id into current_status,org from public.community_members m join public.communities c on c.id=m.community_id where m.community_id=p_community and m.user_id=p_user for update of m;
 if current_status is null then raise exception 'Membership not found'; end if;
 if not public.is_org_member(org,array['OWNER','ADMIN','MANAGER']) then raise exception 'Permission denied'; end if;
 if not ((current_status='PENDING' and p_status in ('ACTIVE','REJECTED')) or (current_status='ACTIVE' and p_status='SUSPENDED') or (current_status='SUSPENDED' and p_status='ACTIVE')) then raise exception 'Invalid membership transition'; end if;
 update public.community_members set status=p_status,joined_at=case when p_status='ACTIVE' then coalesce(joined_at,now()) else joined_at end where community_id=p_community and user_id=p_user;
 return p_status;
end $$;
revoke all on function public.transition_community_member(uuid,uuid,text) from public,anon;
grant execute on function public.transition_community_member(uuid,uuid,text) to authenticated;
