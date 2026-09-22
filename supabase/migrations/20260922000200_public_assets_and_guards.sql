alter table public.media_assets add constraint media_path_owned check(storage_key is null or (split_part(storage_key,'/',1)=owner_user_id::text and storage_key not like '%..%')) not valid;
create unique index if not exists media_storage_key_unique on public.media_assets(storage_key) where storage_key is not null;
create policy published_media_read on storage.objects for select to anon,authenticated using(bucket_id='media' and exists(select 1 from public.media_assets a where a.storage_key=name and a.visibility='PUBLIC'));

-- Resolve current resource permissions, including removal from an organization.
create or replace function public.in_conversation(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.account_active() and exists(
 select 1 from public.conversations c where c.id=p_id and (
 (c.resource_type='application' and exists(select 1 from public.applications a join public.dj_profiles d on d.id=a.dj_profile_id join public.opportunities o on o.id=a.opportunity_id where a.id=c.resource_id and (d.user_id=auth.uid() or exists(select 1 from public.organization_members m where m.organization_id=o.organization_id and m.user_id=auth.uid() and m.role in ('OWNER','ADMIN','MANAGER','EDITOR')))))
 or (c.resource_type='booking' and exists(select 1 from public.booking_inquiries b join public.dj_profiles d on d.id=b.dj_profile_id where b.id=c.resource_id and (d.user_id=auth.uid() or b.requester_user_id=auth.uid())))
 ))
$$;
create or replace function public.reserve_ticket(p_ticket_type uuid,p_buyer_email text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not public.account_active() then raise exception 'Account unavailable'; end if;
 if exists(select 1 from public.feature_flags where key='ticketing_enabled' and not enabled) then raise exception 'Ticketing disabled'; end if;
 if not exists(select 1 from public.ticket_types tt join public.events e on e.id=tt.event_id where tt.id=p_ticket_type and e.status in ('PUBLISHED','LIVE') and (tt.sales_start is null or tt.sales_start<=now()) and (tt.sales_end is null or tt.sales_end>now()) and not tt.approval_required and not e.approval_required) then raise exception 'Ticket unavailable or approval required'; end if;
 return private.reserve_ticket_impl(p_ticket_type,p_buyer_email);
end $$;
create or replace function public.validate_ticket_checkin(p_token uuid,p_event uuid,p_device text default null) returns text language plpgsql security definer set search_path='' as $$
begin
 if not public.account_active() then raise exception 'Account unavailable'; end if;
 if length(p_device)>120 then raise exception 'Invalid device'; end if;
 if (select count(*) from public.checkins where scanner_user_id=auth.uid() and checked_in_at>now()-interval '1 minute')>120 then raise exception 'Scan rate exceeded'; end if;
 if not exists(select 1 from public.events where id=p_event and status in ('PUBLISHED','LIVE')) then raise exception 'Event is not accepting entry'; end if;
 return private.validate_ticket_checkin_impl(p_token,p_event,p_device);
end $$;
create or replace function public.publish_epk(p_epk uuid) returns integer language plpgsql security definer set search_path='' as $$
begin
 if not public.account_active() then raise exception 'Account unavailable'; end if;
 perform 1 from public.epks where id=p_epk for update;
 return private.publish_epk_impl(p_epk);
end $$;
-- Public readers receive a sanitized immutable snapshot, never draft/private sections.
drop policy epk_publications_read on public.epk_publications;
create policy epk_publications_owner on public.epk_publications for select to authenticated using(exists(select 1 from public.epks e join public.dj_profiles d on d.id=e.dj_profile_id where e.id=epk_publications.epk_id and d.user_id=auth.uid()));
create or replace function public.get_public_epk(p_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('epk',p.document->'epk','dj',(p.document->'dj')-'user_id','version',p.version,'published_at',p.published_at,'sections',coalesce((select jsonb_agg(s) from jsonb_array_elements(p.document->'sections') s where s->>'visibility'='PUBLIC' and (s->>'enabled')::boolean),'[]'::jsonb))
 from public.epks e join public.epk_publications p on p.epk_id=e.id
 where e.slug=p_slug and e.status='PUBLISHED'
 order by p.version desc limit 1
$$;
revoke all on function public.get_public_epk(text) from public;
grant execute on function public.get_public_epk(text) to anon,authenticated;
