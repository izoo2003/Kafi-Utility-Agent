-- Solar specs: inverter and battery warranty expiry dates

alter table public.solar_specs
  add column if not exists inverter_expiry date;

alter table public.solar_specs
  add column if not exists battery_expiry date;

comment on column public.solar_specs.inverter_expiry is
  'Inverter warranty / expiry date';
comment on column public.solar_specs.battery_expiry is
  'Battery warranty / expiry date';
