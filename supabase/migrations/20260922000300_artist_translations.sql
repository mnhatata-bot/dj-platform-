alter table public.dj_profiles add column translations jsonb not null default '{}'::jsonb check(jsonb_typeof(translations)='object' and octet_length(translations::text)<=50000);
