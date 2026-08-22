-- Multi-site SEMS+: per-station monitoring logs

alter table public.solar_monitoring_log
  add column if not exists station_id text;

update public.solar_monitoring_log
set station_id = 'a8d23a64-bc87-4321-82f4-83b8f2881625'
where station_id is null;

alter table public.solar_monitoring_log
  alter column station_id set not null;

drop index if exists solar_monitoring_log_log_date_uidx;

create unique index if not exists solar_monitoring_log_station_log_date_uidx
  on public.solar_monitoring_log (station_id, log_date);

create index if not exists solar_monitoring_log_station_idx
  on public.solar_monitoring_log (station_id, log_date desc);

comment on column public.solar_monitoring_log.station_id is
  'SEMS+ station id — one monitoring row per calendar day per plant.';
