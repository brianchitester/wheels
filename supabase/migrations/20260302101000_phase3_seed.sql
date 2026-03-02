insert into public.locations (id, name)
values ('main', 'Young''s Bicycle Shop - Nantucket')
on conflict (id) do update set name = excluded.name;

insert into public.vehicle_types (location_id, name, category)
values
  ('main', 'Regular Bike', 'bike'::public.vehicle_category),
  ('main', 'E-bike', 'bike'::public.vehicle_category),
  ('main', 'Jeep', 'car'::public.vehicle_category)
on conflict (location_id, name) do nothing;

with vt as (
  select id, name from public.vehicle_types where location_id = 'main'
)
insert into public.pricing_rules (location_id, vehicle_type_id, duration_unit, duration_value, price_cents, deposit_cents, active)
select 'main', vt.id, x.duration_unit, x.duration_value, x.price_cents, x.deposit_cents, true
from vt
join (
  values
    ('Regular Bike', 'hour'::public.duration_unit, 4, 3500, 0),
    ('Regular Bike', 'hour'::public.duration_unit, 8, 5000, 0),
    ('Regular Bike', 'day'::public.duration_unit, 1, 6500, 0),
    ('E-bike', 'hour'::public.duration_unit, 4, 6500, 0),
    ('E-bike', 'hour'::public.duration_unit, 8, 9000, 0),
    ('E-bike', 'day'::public.duration_unit, 1, 12000, 0),
    ('Jeep', 'day'::public.duration_unit, 1, 25000, 5000),
    ('Jeep', 'week'::public.duration_unit, 1, 150000, 5000)
) as x(type_name, duration_unit, duration_value, price_cents, deposit_cents)
  on vt.name = x.type_name
where not exists (
  select 1
  from public.pricing_rules pr
  where pr.location_id = 'main'
    and pr.vehicle_type_id = vt.id
    and pr.duration_unit = x.duration_unit
    and pr.duration_value = x.duration_value
    and pr.price_cents = x.price_cents
);
