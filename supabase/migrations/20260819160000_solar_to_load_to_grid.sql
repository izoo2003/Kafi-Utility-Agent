-- Solar monitoring: to-load / to-grid split + one row per day

alter table public.solar_monitoring_log
  add column if not exists to_load_kwh numeric;

alter table public.solar_monitoring_log
  add column if not exists to_grid_kwh numeric;

alter table public.solar_monitoring_log
  add column if not exists from_grid_kwh numeric;

alter table public.solar_monitoring_log
  add column if not exists from_pv_bat_kwh numeric;

comment on column public.solar_monitoring_log.to_load_kwh is
  'AC generation used by site load (kWh)';
comment on column public.solar_monitoring_log.to_grid_kwh is
  'AC generation exported to grid (kWh)';
comment on column public.solar_monitoring_log.from_grid_kwh is
  'Consumption imported from grid (kWh)';
comment on column public.solar_monitoring_log.from_pv_bat_kwh is
  'Consumption covered by PV and/or battery (kWh)';

-- Keep newest row per log_date, drop older duplicates
delete from public.solar_monitoring_log a
using public.solar_monitoring_log b
where a.log_date = b.log_date
  and a.updated_at < b.updated_at;

delete from public.solar_monitoring_log a
using public.solar_monitoring_log b
where a.log_date = b.log_date
  and a.updated_at = b.updated_at
  and a.id < b.id;

create unique index if not exists solar_monitoring_log_log_date_uidx
  on public.solar_monitoring_log (log_date);
