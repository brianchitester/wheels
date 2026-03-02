create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'staff');
create type public.vehicle_category as enum ('bike', 'car');
create type public.vehicle_status as enum ('available', 'maintenance');
create type public.duration_unit as enum ('hour', 'day', 'week');
create type public.reservation_status as enum ('pending', 'confirmed', 'cancelled');
create type public.rental_status as enum ('active', 'returned', 'voided');
create type public.payment_type as enum ('deposit', 'full', 'refund');
create type public.payment_method as enum ('stripe', 'cash');
create type public.payment_status as enum ('initiated', 'succeeded', 'failed', 'refunded');

create table public.locations (
  id text primary key default 'main',
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default now()
);

create table public.vehicle_types (
  id uuid primary key default gen_random_uuid(),
  location_id text not null default 'main' references public.locations (id),
  name text not null,
  category public.vehicle_category not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (location_id, name)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  location_id text not null default 'main' references public.locations (id),
  vehicle_type_id uuid not null references public.vehicle_types (id),
  asset_tag text not null,
  status public.vehicle_status not null default 'available',
  notes text,
  created_at timestamptz not null default now(),
  unique (location_id, asset_tag)
);

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  location_id text not null default 'main' references public.locations (id),
  vehicle_type_id uuid not null references public.vehicle_types (id),
  duration_unit public.duration_unit not null,
  duration_value int not null check (duration_value > 0),
  price_cents int not null check (price_cents >= 0),
  deposit_cents int not null default 0 check (deposit_cents >= 0),
  active boolean not null default true,
  season_key text,
  created_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  location_id text not null default 'main' references public.locations (id),
  status public.reservation_status not null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  delivery_required boolean not null default false,
  delivery_time timestamptz,
  delivery_address text,
  notes text,
  created_by_user_id uuid references auth.users (id) on delete set null,
  override_flag boolean not null default false,
  override_reason text,
  overridden_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  check ((not delivery_required) or (delivery_time is not null and delivery_address is not null)),
  check ((not override_flag and override_reason is null and overridden_by_user_id is null) or (override_flag and override_reason is not null and overridden_by_user_id is not null))
);

create table public.reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  vehicle_type_id uuid not null references public.vehicle_types (id),
  pricing_rule_id uuid not null references public.pricing_rules (id),
  quantity int not null check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  deposit_cents int not null default 0 check (deposit_cents >= 0),
  created_at timestamptz not null default now()
);

create table public.rentals (
  id uuid primary key default gen_random_uuid(),
  location_id text not null default 'main' references public.locations (id),
  status public.rental_status not null default 'active',
  reservation_id uuid references public.reservations (id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  actual_return_time timestamptz,
  created_by_user_id uuid not null references auth.users (id),
  override_flag boolean not null default false,
  override_reason text,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  check ((not override_flag and override_reason is null) or (override_flag and override_reason is not null))
);

create table public.rental_items (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  vehicle_type_id uuid not null references public.vehicle_types (id),
  pricing_rule_id uuid not null references public.pricing_rules (id),
  quantity int not null check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);

create table public.rental_assets (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id),
  created_at timestamptz not null default now(),
  unique (rental_id, vehicle_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  location_id text not null default 'main' references public.locations (id),
  reservation_id uuid references public.reservations (id) on delete set null,
  rental_id uuid references public.rentals (id) on delete set null,
  type public.payment_type not null,
  method public.payment_method not null,
  amount_cents int not null check (amount_cents >= 0),
  status public.payment_status not null,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((reservation_id is not null and rental_id is null) or (reservation_id is null and rental_id is not null))
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  location_id text not null default 'main' references public.locations (id),
  actor_user_id uuid references auth.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.stripe_events_processed (
  id text primary key,
  processed_at timestamptz not null default now()
);

create index reservations_idx on public.reservations (location_id, start_time, end_time, status);
create index rentals_idx on public.rentals (location_id, start_time, end_time, status);
create index vehicles_idx on public.vehicles (location_id, vehicle_type_id, status);
create index reservation_items_idx on public.reservation_items (reservation_id, vehicle_type_id);
create index rental_assets_idx on public.rental_assets (rental_id, vehicle_id);
create index payments_res_idx on public.payments (reservation_id);
create index payments_rent_idx on public.payments (rental_id);

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role in ('staff'::public.user_role, 'admin'::public.user_role)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'::public.user_role
  );
$$;

create or replace function public.has_location_access(p_location_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_location_id = 'main' and public.is_staff_or_admin();
$$;

create or replace function public.get_buffer_interval(p_category public.vehicle_category)
returns interval
language sql
immutable
as $$
  select case when p_category = 'car'::public.vehicle_category then interval '1 day' else interval '0' end;
$$;
create or replace function public.check_availability(
  p_location_id text,
  p_vehicle_type_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_quantity int
)
returns table (
  is_available boolean,
  available_count int,
  total_count int,
  blocked_count int,
  category public.vehicle_category,
  effective_start timestamptz,
  effective_end timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category public.vehicle_category;
  v_buffer interval;
  v_effective_start timestamptz;
  v_effective_end timestamptz;
  v_total int;
  v_rental_conflicts int;
  v_reservation_conflicts int;
  v_blocked int;
  v_available int;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be > 0';
  end if;
  if p_start_time is null or p_end_time is null or p_end_time <= p_start_time then
    raise exception 'invalid time window';
  end if;

  select vt.category into v_category
  from public.vehicle_types vt
  where vt.id = p_vehicle_type_id and vt.location_id = p_location_id and vt.active = true;

  if v_category is null then
    raise exception 'vehicle_type not active at this location';
  end if;

  v_buffer := public.get_buffer_interval(v_category);
  v_effective_start := p_start_time - v_buffer;
  v_effective_end := p_end_time + v_buffer;

  select count(*) into v_total
  from public.vehicles v
  where v.location_id = p_location_id
    and v.vehicle_type_id = p_vehicle_type_id
    and v.status != 'maintenance'::public.vehicle_status;

  select count(distinct ra.vehicle_id) into v_rental_conflicts
  from public.rental_assets ra
  join public.rentals r on r.id = ra.rental_id
  join public.vehicles v on v.id = ra.vehicle_id
  where v.location_id = p_location_id
    and v.vehicle_type_id = p_vehicle_type_id
    and r.status = 'active'::public.rental_status
    and tstzrange(r.start_time, r.end_time, '[)') && tstzrange(v_effective_start, v_effective_end, '[)');

  select coalesce(sum(ri.quantity), 0) into v_reservation_conflicts
  from public.reservation_items ri
  join public.reservations r on r.id = ri.reservation_id
  where r.location_id = p_location_id
    and ri.vehicle_type_id = p_vehicle_type_id
    and r.status in ('pending'::public.reservation_status, 'confirmed'::public.reservation_status)
    and tstzrange(r.start_time, r.end_time, '[)') && tstzrange(v_effective_start, v_effective_end, '[)');

  v_blocked := greatest(coalesce(v_rental_conflicts, 0), coalesce(v_reservation_conflicts, 0));
  v_available := greatest(v_total - v_blocked, 0);

  return query
  select
    (v_available >= p_quantity),
    v_available,
    v_total,
    v_blocked,
    v_category,
    v_effective_start,
    v_effective_end;
end;
$$;

create or replace function public.create_reservation(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_id text := coalesce(nullif(p_payload->>'location_id', ''), 'main');
  v_start_time timestamptz := (p_payload->>'start_time')::timestamptz;
  v_end_time timestamptz := v_start_time;
  v_customer_name text := nullif(p_payload->>'customer_name', '');
  v_customer_email text := nullif(p_payload->>'customer_email', '');
  v_customer_phone text := nullif(p_payload->>'customer_phone', '');
  v_delivery_required boolean := coalesce((p_payload->>'delivery_required')::boolean, false);
  v_delivery_time timestamptz := (p_payload->>'delivery_time')::timestamptz;
  v_delivery_address text := nullif(p_payload->>'delivery_address', '');
  v_notes text := nullif(p_payload->>'notes', '');
  v_override_flag boolean := coalesce((p_payload->>'override_flag')::boolean, false);
  v_override_reason text := nullif(p_payload->>'override_reason', '');
  v_status public.reservation_status := 'confirmed'::public.reservation_status;
  v_total_deposit int := 0;
  v_reservation_id uuid;
  v_item jsonb;
  v_rule record;
  v_item_end_time timestamptz;
  v_availability record;
  v_items jsonb := p_payload->'items';
  v_normalized jsonb := '[]'::jsonb;
begin
  if v_start_time is null then raise exception 'start_time is required'; end if;
  if v_customer_name is null then raise exception 'customer_name is required'; end if;
  if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'items must be a non-empty array';
  end if;
  if v_delivery_required and (v_delivery_time is null or v_delivery_address is null) then
    raise exception 'delivery_time and delivery_address are required when delivery_required=true';
  end if;
  if v_override_flag and (not public.is_staff_or_admin() or v_override_reason is null) then
    raise exception 'staff/admin override requires override_reason';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    select pr.id, pr.vehicle_type_id, pr.duration_unit, pr.duration_value, pr.price_cents, pr.deposit_cents
    into v_rule
    from public.pricing_rules pr
    where pr.id = (v_item->>'pricing_rule_id')::uuid
      and pr.vehicle_type_id = (v_item->>'vehicle_type_id')::uuid
      and pr.location_id = v_location_id
      and pr.active = true;

    if not found then
      raise exception 'invalid pricing rule or vehicle type';
    end if;

    v_item_end_time := v_start_time + case v_rule.duration_unit
      when 'hour'::public.duration_unit then make_interval(hours => v_rule.duration_value)
      when 'day'::public.duration_unit then make_interval(days => v_rule.duration_value)
      when 'week'::public.duration_unit then make_interval(days => 7 * v_rule.duration_value)
    end;

    select * into v_availability from public.check_availability(
      v_location_id,
      v_rule.vehicle_type_id,
      v_start_time,
      v_item_end_time,
      (v_item->>'quantity')::int
    );

    if not v_availability.is_available and not v_override_flag then
      raise exception 'insufficient availability for requested quantity';
    end if;

    if v_item_end_time > v_end_time then v_end_time := v_item_end_time; end if;
    v_total_deposit := v_total_deposit + (v_rule.deposit_cents * (v_item->>'quantity')::int);

    v_normalized := v_normalized || jsonb_build_array(jsonb_build_object(
      'vehicle_type_id', v_rule.vehicle_type_id,
      'pricing_rule_id', v_rule.id,
      'quantity', (v_item->>'quantity')::int,
      'unit_price_cents', v_rule.price_cents,
      'deposit_cents', v_rule.deposit_cents
    ));
  end loop;

  if v_total_deposit > 0 then
    v_status := 'pending'::public.reservation_status;
  end if;

  insert into public.reservations (
    location_id, status, customer_name, customer_email, customer_phone,
    start_time, end_time, delivery_required, delivery_time, delivery_address,
    notes, created_by_user_id, override_flag, override_reason, overridden_by_user_id
  ) values (
    v_location_id, v_status, v_customer_name, v_customer_email, v_customer_phone,
    v_start_time, v_end_time, v_delivery_required, v_delivery_time, v_delivery_address,
    v_notes, auth.uid(), v_override_flag, v_override_reason,
    case when v_override_flag then auth.uid() else null end
  ) returning id into v_reservation_id;

  insert into public.reservation_items (
    reservation_id, vehicle_type_id, pricing_rule_id, quantity, unit_price_cents, deposit_cents
  )
  select
    v_reservation_id,
    (i->>'vehicle_type_id')::uuid,
    (i->>'pricing_rule_id')::uuid,
    (i->>'quantity')::int,
    (i->>'unit_price_cents')::int,
    (i->>'deposit_cents')::int
  from jsonb_array_elements(v_normalized) i;

  insert into public.activity_log (location_id, actor_user_id, entity_type, entity_id, action, metadata)
  values (
    v_location_id,
    auth.uid(),
    'reservation',
    v_reservation_id,
    case when v_override_flag then 'created_with_override' else 'created' end,
    jsonb_build_object('status', v_status, 'total_deposit_cents', v_total_deposit)
  );

  return v_reservation_id;
end;
$$;
create or replace function public.convert_reservation_to_rental(
  p_reservation_id uuid,
  p_assigned_vehicle_ids uuid[],
  p_override_flag boolean default false,
  p_override_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations%rowtype;
  v_expected_qty int;
  v_assigned_qty int := coalesce(array_length(p_assigned_vehicle_ids, 1), 0);
  v_conflicting_count int;
  v_rental_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authenticated user required';
  end if;

  if p_override_flag and nullif(p_override_reason, '') is null then
    raise exception 'override_reason is required';
  end if;

  select * into v_reservation
  from public.reservations
  where id = p_reservation_id
    and status in ('pending'::public.reservation_status, 'confirmed'::public.reservation_status);

  if not found then
    raise exception 'reservation not found or ineligible';
  end if;

  select coalesce(sum(quantity), 0) into v_expected_qty
  from public.reservation_items
  where reservation_id = p_reservation_id;

  if v_assigned_qty <> v_expected_qty and not p_override_flag then
    raise exception 'assigned vehicle count must match reservation quantity';
  end if;

  if v_assigned_qty > 0 then
    if exists (
      select 1
      from unnest(p_assigned_vehicle_ids) as x(vehicle_id)
      left join public.vehicles v on v.id = x.vehicle_id
      where v.id is null or v.location_id <> v_reservation.location_id
    ) then
      raise exception 'assigned vehicles must exist and belong to reservation location';
    end if;

    if exists (
      with required_by_type as (
        select vehicle_type_id, sum(quantity)::int as qty
        from public.reservation_items
        where reservation_id = p_reservation_id
        group by vehicle_type_id
      ),
      assigned_by_type as (
        select v.vehicle_type_id, count(*)::int as qty
        from unnest(p_assigned_vehicle_ids) as x(vehicle_id)
        join public.vehicles v on v.id = x.vehicle_id
        group by v.vehicle_type_id
      )
      select 1
      from required_by_type r
      left join assigned_by_type a on a.vehicle_type_id = r.vehicle_type_id
      where coalesce(a.qty, 0) <> r.qty
    ) and not p_override_flag then
      raise exception 'assigned vehicles do not match reservation item types/quantities';
    end if;

    select count(*)
    into v_conflicting_count
    from public.rental_assets ra
    join public.rentals r on r.id = ra.rental_id
    where ra.vehicle_id = any(p_assigned_vehicle_ids)
      and r.status = 'active'::public.rental_status
      and tstzrange(r.start_time, r.end_time, '[)') && tstzrange(v_reservation.start_time, v_reservation.end_time, '[)');

    if v_conflicting_count > 0 and not p_override_flag then
      raise exception 'assigned vehicles have overlapping active rentals';
    end if;
  end if;

  insert into public.rentals (
    location_id, status, reservation_id, customer_name, customer_email, customer_phone,
    start_time, end_time, created_by_user_id, override_flag, override_reason
  ) values (
    v_reservation.location_id,
    'active'::public.rental_status,
    v_reservation.id,
    v_reservation.customer_name,
    v_reservation.customer_email,
    v_reservation.customer_phone,
    v_reservation.start_time,
    v_reservation.end_time,
    auth.uid(),
    p_override_flag,
    nullif(p_override_reason, '')
  ) returning id into v_rental_id;

  insert into public.rental_items (
    rental_id, vehicle_type_id, pricing_rule_id, quantity, unit_price_cents
  )
  select
    v_rental_id, vehicle_type_id, pricing_rule_id, quantity, unit_price_cents
  from public.reservation_items
  where reservation_id = p_reservation_id;

  if v_assigned_qty > 0 then
    insert into public.rental_assets (rental_id, vehicle_id)
    select v_rental_id, x.vehicle_id
    from unnest(p_assigned_vehicle_ids) as x(vehicle_id);
  end if;

  insert into public.activity_log (location_id, actor_user_id, entity_type, entity_id, action, metadata)
  values (
    v_reservation.location_id,
    auth.uid(),
    'reservation',
    v_reservation.id,
    case when p_override_flag then 'converted_to_rental_with_override' else 'converted_to_rental' end,
    jsonb_build_object('rental_id', v_rental_id, 'assigned_vehicle_count', v_assigned_qty)
  );

  return v_rental_id;
end;
$$;

create or replace function public.return_rental(
  p_rental_id uuid,
  p_actual_return_time timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_id text;
begin
  select location_id into v_location_id
  from public.rentals
  where id = p_rental_id and status = 'active'::public.rental_status;

  if v_location_id is null then
    raise exception 'active rental not found';
  end if;

  update public.rentals
  set status = 'returned'::public.rental_status,
      actual_return_time = coalesce(p_actual_return_time, now())
  where id = p_rental_id;

  insert into public.activity_log (location_id, actor_user_id, entity_type, entity_id, action, metadata)
  values (
    v_location_id,
    auth.uid(),
    'rental',
    p_rental_id,
    'returned',
    jsonb_build_object('actual_return_time', coalesce(p_actual_return_time, now()))
  );
end;
$$;

alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.vehicle_types enable row level security;
alter table public.vehicles enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;
alter table public.rentals enable row level security;
alter table public.rental_items enable row level security;
alter table public.rental_assets enable row level security;
alter table public.payments enable row level security;
alter table public.activity_log enable row level security;
alter table public.stripe_events_processed enable row level security;

create policy locations_select_staff_admin on public.locations for select to authenticated using (public.is_staff_or_admin());
create policy locations_write_admin on public.locations for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profiles_select_self_or_admin on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_write_admin on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy vehicle_types_select_staff_admin on public.vehicle_types for select to authenticated using (public.has_location_access(location_id));
create policy vehicle_types_write_admin on public.vehicle_types for all to authenticated using (public.is_admin() and location_id = 'main') with check (public.is_admin() and location_id = 'main');

create policy vehicles_select_staff_admin on public.vehicles for select to authenticated using (public.has_location_access(location_id));
create policy vehicles_write_admin on public.vehicles for all to authenticated using (public.is_admin() and location_id = 'main') with check (public.is_admin() and location_id = 'main');

create policy pricing_rules_select_staff_admin on public.pricing_rules for select to authenticated using (public.has_location_access(location_id));
create policy pricing_rules_write_admin on public.pricing_rules for all to authenticated using (public.is_admin() and location_id = 'main') with check (public.is_admin() and location_id = 'main');

create policy reservations_select_staff_admin on public.reservations for select to authenticated using (public.has_location_access(location_id));
create policy reservations_write_staff_admin on public.reservations for all to authenticated using (public.has_location_access(location_id)) with check (public.has_location_access(location_id));

create policy reservation_items_staff_admin on public.reservation_items for all to authenticated
using (exists (select 1 from public.reservations r where r.id = reservation_id and public.has_location_access(r.location_id)))
with check (exists (select 1 from public.reservations r where r.id = reservation_id and public.has_location_access(r.location_id)));

create policy rentals_staff_admin on public.rentals for all to authenticated
using (public.has_location_access(location_id))
with check (public.has_location_access(location_id));

create policy rental_items_staff_admin on public.rental_items for all to authenticated
using (exists (select 1 from public.rentals r where r.id = rental_id and public.has_location_access(r.location_id)))
with check (exists (select 1 from public.rentals r where r.id = rental_id and public.has_location_access(r.location_id)));

create policy rental_assets_staff_admin on public.rental_assets for all to authenticated
using (exists (select 1 from public.rentals r where r.id = rental_id and public.has_location_access(r.location_id)))
with check (exists (select 1 from public.rentals r where r.id = rental_id and public.has_location_access(r.location_id)));

create policy payments_staff_admin on public.payments for all to authenticated
using (public.has_location_access(location_id))
with check (public.has_location_access(location_id));

create policy activity_log_select_staff_admin on public.activity_log for select to authenticated using (public.has_location_access(location_id));
create policy activity_log_insert_staff_admin on public.activity_log for insert to authenticated with check (public.has_location_access(location_id));

create policy stripe_events_admin_only on public.stripe_events_processed for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to authenticated, service_role;
grant execute on function public.get_buffer_interval(public.vehicle_category) to authenticated, service_role;
grant execute on function public.check_availability(text, uuid, timestamptz, timestamptz, int) to authenticated, service_role;
grant execute on function public.create_reservation(jsonb) to authenticated, service_role;
grant execute on function public.convert_reservation_to_rental(uuid, uuid[], boolean, text) to authenticated, service_role;
grant execute on function public.return_rental(uuid, timestamptz) to authenticated, service_role;
