-- Private event details and ticket inventory must not be discoverable by unrelated accounts.
drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated using (
 (visibility='PUBLIC' and status in ('PUBLISHED','LIVE','ENDED')) or public.is_org_member(organization_id)
);
drop policy if exists events_write on public.events;
create policy events_write on public.events for all to authenticated using (
 public.is_org_member(organization_id,array['OWNER','ADMIN','MANAGER','EDITOR'])
) with check (public.is_org_member(organization_id,array['OWNER','ADMIN','MANAGER','EDITOR']));
drop policy if exists ticket_types_read on public.ticket_types;
create policy ticket_types_read on public.ticket_types for select to anon,authenticated using (
 status='ACTIVE' and exists(select 1 from public.events e where e.id=event_id and e.visibility='PUBLIC' and e.status in ('PUBLISHED','LIVE','ENDED'))
);
-- Staff can inspect their organization's ticket types but only managers may write.
create policy ticket_types_member_read on public.ticket_types for select to authenticated using (
 exists(select 1 from public.events e where e.id=event_id and public.is_org_member(e.organization_id))
);
-- Preserve the existing inventory transaction; add private-event and ticket-state checks.
create or replace function public.reserve_ticket(p_ticket_type uuid,p_buyer_email text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.account_active() then raise exception 'Account unavailable'; end if;
 if exists(select 1 from public.feature_flags where key='ticketing_enabled' and not enabled) then raise exception 'Ticketing disabled'; end if;
 if not exists(select 1 from public.ticket_types tt join public.events e on e.id=tt.event_id where tt.id=p_ticket_type and tt.status='ACTIVE' and e.status in ('PUBLISHED','LIVE') and (e.visibility='PUBLIC' or public.is_org_member(e.organization_id,array['OWNER','ADMIN','MANAGER'])) and (tt.sales_start is null or tt.sales_start<=now()) and (tt.sales_end is null or tt.sales_end>now()) and not tt.approval_required and not e.approval_required) then raise exception 'Ticket unavailable or approval required'; end if;
 return private.reserve_ticket_impl(p_ticket_type,p_buyer_email);
end $$;
revoke all on function public.reserve_ticket(uuid,text) from public;
grant execute on function public.reserve_ticket(uuid,text) to authenticated;
