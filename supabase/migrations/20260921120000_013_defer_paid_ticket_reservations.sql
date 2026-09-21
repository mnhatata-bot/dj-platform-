-- A paid ticket must never consume inventory until a configured payment provider
-- confirms the payment through its authenticated webhook flow. Until the payment
-- adapter is selected, only free / complimentary tickets can be issued.

create or replace function private.reserve_ticket_impl(p_ticket_type uuid, p_buyer_email text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_type public.ticket_types%rowtype;
  v_order uuid;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  select *
    into v_type
    from public.ticket_types
   where id = p_ticket_type
   for update;

  if not found or v_type.status <> 'ACTIVE' then
    raise exception 'ticket_type_unavailable';
  end if;

  if v_type.price > 0 then
    raise exception 'payment_provider_not_configured';
  end if;

  if v_type.quantity_sold >= v_type.capacity then
    raise exception 'sold_out';
  end if;

  update public.ticket_types
     set quantity_sold = quantity_sold + 1
   where id = p_ticket_type;

  insert into public.ticket_orders(event_id, user_id, buyer_email, amount, currency, status)
  values(v_type.event_id, v_uid, p_buyer_email, v_type.price, v_type.currency, 'PAID')
  returning id into v_order;

  insert into public.tickets(order_id, ticket_type_id, event_id, attendee_email, status)
  values(v_order, v_type.id, v_type.event_id, p_buyer_email, 'ACTIVE');

  update public.ticket_orders
     set status = 'COMPLETED'
   where id = v_order;

  return v_order;
end;
$function$;
