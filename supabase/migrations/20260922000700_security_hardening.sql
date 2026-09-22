-- Restrict privileged RPCs to signed-in users. Supabase's default function
-- grants include anon, so revoking PUBLIC alone is insufficient.
revoke execute on function public.account_active() from anon;
revoke execute on function public.platform_admin() from anon;
revoke execute on function public.admin_action(text,text,text) from anon;
revoke execute on function public.admin_list(text,integer,text) from anon;
revoke execute on function public.admin_save_page(jsonb) from anon;
revoke execute on function public.admin_save_setting(text,jsonb) from anon;
revoke execute on function public.admin_update_entity(text,uuid,jsonb) from anon;
revoke execute on function public.begin_ai_request(text) from anon;
revoke execute on function public.finish_ai_request(uuid,text,integer,integer) from anon;
revoke execute on function public.in_conversation(uuid) from anon;
revoke execute on function public.message_contexts() from anon;
revoke execute on function public.open_conversation(text,uuid) from anon;
revoke execute on function public.send_message(uuid,text,uuid) from anon;

-- These two functions intentionally remain public: feature flags expose only a
-- boolean and public EPK rendering exposes an already-published snapshot.

create index if not exists cms_revisions_actor_id_idx
  on public.cms_revisions(actor_id);
create index if not exists cms_revisions_page_id_idx
  on public.cms_revisions(page_id);
create index if not exists conversation_members_user_id_idx
  on public.conversation_members(user_id);

drop policy if exists ai_own_read on public.ai_requests;
create policy ai_own_read on public.ai_requests
for select to authenticated
using (
  user_id = (select auth.uid())
  and (select public.account_active())
);

drop policy if exists epk_publications_owner on public.epk_publications;
create policy epk_publications_owner on public.epk_publications
for select to authenticated
using (
  exists (
    select 1
    from public.epks e
    join public.dj_profiles d on d.id = e.dj_profile_id
    where e.id = epk_publications.epk_id
      and d.user_id = (select auth.uid())
  )
);
