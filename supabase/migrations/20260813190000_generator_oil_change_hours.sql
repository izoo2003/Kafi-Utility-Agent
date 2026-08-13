-- Track hour-meter reading on maintenance (used for 200h oil-change interval)

alter table public.generator_maintenance
  add column if not exists hour_meter numeric;

comment on column public.generator_maintenance.hour_meter is
  'Generator hour-meter reading at this service (required for oil-change interval tracking).';
