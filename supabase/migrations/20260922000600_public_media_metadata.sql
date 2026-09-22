-- Existing media_read is authenticated-only. Storage's public-asset predicate
-- must also be able to see deliberately public metadata when called as anon.
create policy media_public_metadata on public.media_assets for select to anon using(visibility='PUBLIC');
