create or replace function private.reserve_ticket_impl(p_ticket_type uuid, p_buyer_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_type public.ticket_types%rowtype;
  v_order uuid;
  v_ticket uuid;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select * into v_type from public.ticket_types where id = p_ticket_type for update;
  if not found or v_type.status <> 'ACTIVE' then raise exception 'ticket_type_unavailable'; end if;
  if v_type.price > 0 then raise exception 'payment_provider_not_configured'; end if;
  if v_type.quantity_sold >= v_type.capacity then raise exception 'sold_out'; end if;
  update public.ticket_types set quantity_sold = quantity_sold + 1 where id = p_ticket_type;
  insert into public.ticket_orders(event_id, user_id, buyer_email, amount, currency, status)
  values(v_type.event_id, v_uid, p_buyer_email, v_type.price, v_type.currency, 'PAID') returning id into v_order;
  insert into public.tickets(order_id, ticket_type_id, event_id, attendee_email, status)
  values(v_order, v_type.id, v_type.event_id, p_buyer_email, 'ACTIVE') returning id into v_ticket;
  update public.ticket_orders set status = 'COMPLETED' where id = v_order;
  return v_ticket;
end;
$$;

create or replace function public.reserve_ticket(p_ticket_type uuid, p_buyer_email text)
returns uuid language sql security definer set search_path = ''
as $$ select private.reserve_ticket_impl(p_ticket_type, p_buyer_email); $$;

create or replace function public.validate_ticket_checkin(p_token uuid, p_event uuid, p_device text default null)
returns text language sql security definer set search_path = ''
as $$ select private.validate_ticket_checkin_impl(p_token, p_event, p_device); $$;

revoke all on function public.reserve_ticket(uuid, text) from public;
revoke all on function public.validate_ticket_checkin(uuid, uuid, text) from public;
grant execute on function public.reserve_ticket(uuid, text) to authenticated;
grant execute on function public.validate_ticket_checkin(uuid, uuid, text) to authenticated;
