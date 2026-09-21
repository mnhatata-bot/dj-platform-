-- The public RPC is intentionally the only callable entry point. The private
-- implementation keeps its explicit auth.uid() ownership check.
create or replace function public.publish_epk(p_epk uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.publish_epk_impl(p_epk);
$$;

revoke all on function public.publish_epk(uuid) from public;
grant execute on function public.publish_epk(uuid) to authenticated;
