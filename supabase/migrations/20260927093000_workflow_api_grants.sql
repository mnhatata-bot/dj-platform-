-- Supabase no longer guarantees implicit Data API grants for public tables.
-- Keep these existing RLS-protected workflows explicitly reachable with the
-- minimum table privileges their client operations require.

grant select on public.ai_requests to authenticated;
grant select on public.conversations,public.conversation_members,public.messages to authenticated;
grant select on public.cms_pages,public.platform_settings to anon,authenticated;
grant select on public.cms_revisions to authenticated;

grant select on public.vendor_profiles,public.vendor_products to anon,authenticated;
grant insert,update,delete on public.vendor_products to authenticated;
grant select,insert,update on public.vendor_quote_requests,public.vendor_quotes to authenticated;
grant select,insert,update,delete on public.my_cuelance_items to authenticated;

grant select on public.opportunities to anon,authenticated;
grant insert,update,delete on public.opportunities to authenticated;

grant select,insert on public.applications to authenticated;

grant select on public.communities to anon,authenticated;
grant insert,update,delete on public.communities to authenticated;
grant select,insert on public.community_members to authenticated;

drop policy if exists booking_participant_read on public.booking_inquiries;
create policy booking_participant_read on public.booking_inquiries
for select to authenticated using(
 public.account_active() and (
  requester_user_id=(select auth.uid())
  or exists(
   select 1 from public.dj_profiles d
   where d.id=booking_inquiries.dj_profile_id and d.user_id=(select auth.uid())
  )
 )
);
grant insert on public.booking_inquiries to anon,authenticated;
grant select on public.booking_inquiries to authenticated;
