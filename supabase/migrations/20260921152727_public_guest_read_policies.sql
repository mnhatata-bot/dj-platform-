alter policy events_read on public.events to authenticated;
alter policy opportunities_read on public.opportunities to authenticated;
alter policy communities_read on public.communities to authenticated;
create policy events_guest_read on public.events for select to anon using (visibility = 'PUBLIC' and status in ('PUBLISHED','LIVE','ENDED'));
create policy opportunities_guest_read on public.opportunities for select to anon using (status = 'PUBLISHED');
create policy communities_guest_read on public.communities for select to anon using (visibility = 'PUBLIC' and status = 'ACTIVE');