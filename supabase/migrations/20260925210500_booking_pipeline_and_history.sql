create table if not exists public.booking_status_history(
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.booking_inquiries(id) on delete cascade,
 from_status text, to_status text not null, changed_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
alter table public.booking_status_history enable row level security;
drop policy if exists booking_history_read on public.booking_status_history;
create policy booking_history_read on public.booking_status_history for select to authenticated using(
 public.account_active() and exists(select 1 from public.booking_inquiries b join public.dj_profiles d on d.id=b.dj_profile_id where b.id=booking_id and (d.user_id=auth.uid() or b.requester_user_id=auth.uid()))
);
revoke all on public.booking_status_history from anon,authenticated;
grant select on public.booking_status_history to authenticated;

drop policy if exists booking_insert on public.booking_inquiries;
drop policy if exists booking_update on public.booking_inquiries;
create policy booking_insert on public.booking_inquiries for insert to anon,authenticated with check(requester_user_id is null or requester_user_id=auth.uid());

create or replace function public.validate_booking_inquiry() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 new.requester_name:=left(trim(new.requester_name),120); new.requester_email:=left(lower(trim(new.requester_email)),254); new.message:=left(trim(new.message),3000);
 new.organization_name:=nullif(left(trim(coalesce(new.organization_name,'')),160),''); new.city:=nullif(left(trim(coalesce(new.city,'')),120),''); new.budget:=nullif(left(trim(coalesce(new.budget,'')),120),''); new.status:='NEW';
 if length(new.requester_name)<2 or new.requester_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(new.message)<10 then raise exception 'Complete name, email and a brief of at least 10 characters'; end if;
 if auth.uid() is not null then new.requester_user_id:=auth.uid(); else new.requester_user_id:=null; end if;
 if (select count(*) from public.booking_inquiries where requester_email=new.requester_email and created_at>now()-interval '1 hour')>=10 then raise exception 'Booking request limit reached'; end if;
 return new;
end $$;
revoke all on function public.validate_booking_inquiry() from public,anon,authenticated;
drop trigger if exists validate_booking_inquiry on public.booking_inquiries;
create trigger validate_booking_inquiry before insert on public.booking_inquiries for each row execute function public.validate_booking_inquiry();

create or replace function public.transition_booking(p_booking uuid,p_status text) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_status text; artist_user uuid;
begin
 if auth.uid() is null or not public.account_active() then raise exception 'Authentication required'; end if;
 select b.status,d.user_id into current_status,artist_user from public.booking_inquiries b join public.dj_profiles d on d.id=b.dj_profile_id where b.id=p_booking for update of b;
 if current_status is null then raise exception 'Booking not found'; end if;
 if artist_user<>auth.uid() then raise exception 'Permission denied'; end if;
 if not ((current_status='NEW' and p_status in ('CONTACTED','DECLINED')) or (current_status='CONTACTED' and p_status in ('NEGOTIATING','CONFIRMED','DECLINED')) or (current_status='NEGOTIATING' and p_status in ('CONFIRMED','DECLINED')) or (current_status='CONFIRMED' and p_status in ('COMPLETED','CANCELLED'))) then raise exception 'Invalid booking transition'; end if;
 update public.booking_inquiries set status=p_status where id=p_booking;
 insert into public.booking_status_history(booking_id,from_status,to_status,changed_by) values(p_booking,current_status,p_status,auth.uid());
 return p_status;
end $$;
revoke all on function public.transition_booking(uuid,text) from public,anon;
grant execute on function public.transition_booking(uuid,text) to authenticated;

