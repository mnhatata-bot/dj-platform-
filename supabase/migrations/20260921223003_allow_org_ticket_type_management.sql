create policy "ticket_types_write" on public.ticket_types
for all to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = ticket_types.event_id
      and exists (
        select 1 from public.organization_members m
        where m.organization_id = e.organization_id
          and m.user_id = (select auth.uid())
          and m.role in ('OWNER', 'ADMIN', 'MANAGER')
      )
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = ticket_types.event_id
      and exists (
        select 1 from public.organization_members m
        where m.organization_id = e.organization_id
          and m.user_id = (select auth.uid())
          and m.role in ('OWNER', 'ADMIN', 'MANAGER')
      )
  )
);
