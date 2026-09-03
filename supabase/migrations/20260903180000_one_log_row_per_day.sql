-- One dated log row per key (plant/day or account/day). Merge extras, then unique.

-- Solar monitoring: one row per plant per calendar day
delete from public.solar_monitoring_log a
using public.solar_monitoring_log b
where a.station_id = b.station_id
  and a.log_date = b.log_date
  and a.id <> b.id
  and (
    a.updated_at < b.updated_at
    or (a.updated_at = b.updated_at and a.id < b.id)
  );

create unique index if not exists solar_monitoring_log_station_log_date_uidx
  on public.solar_monitoring_log (station_id, log_date);

-- Solar service: one row per plant per service date
delete from public.solar_maintenance a
using public.solar_maintenance b
where a.site_id = b.site_id
  and a.service_date = b.service_date
  and a.id <> b.id
  and (
    a.updated_at < b.updated_at
    or (a.updated_at = b.updated_at and a.id < b.id)
  );

create unique index if not exists solar_maintenance_site_service_date_uidx
  on public.solar_maintenance (site_id, service_date);

-- Generator fuel: one row per log date
delete from public.generator_fuel_log a
using public.generator_fuel_log b
where a.log_date = b.log_date
  and a.id <> b.id
  and (
    a.updated_at < b.updated_at
    or (a.updated_at = b.updated_at and a.id < b.id)
  );

create unique index if not exists generator_fuel_log_log_date_uidx
  on public.generator_fuel_log (log_date);

-- Generator outage runs: one row per run date
delete from public.generator_run_log a
using public.generator_run_log b
where a.run_date = b.run_date
  and a.id <> b.id
  and (
    a.updated_at < b.updated_at
    or (a.updated_at = b.updated_at and a.id < b.id)
  );

create unique index if not exists generator_run_log_run_date_uidx
  on public.generator_run_log (run_date);

-- Generator maintenance: one row per service date
delete from public.generator_maintenance a
using public.generator_maintenance b
where a.service_date = b.service_date
  and a.id <> b.id
  and (
    a.updated_at < b.updated_at
    or (a.updated_at = b.updated_at and a.id < b.id)
  );

create unique index if not exists generator_maintenance_service_date_uidx
  on public.generator_maintenance (service_date);

-- Utility bills: one row per account per paid-on date
delete from public.utility_payment_logs a
using public.utility_payment_logs b
where a.utility_account_id = b.utility_account_id
  and a.paid_on = b.paid_on
  and a.id <> b.id
  and (
    a.updated_at < b.updated_at
    or (a.updated_at = b.updated_at and a.id < b.id)
  );

create unique index if not exists utility_payment_logs_account_paid_on_uidx
  on public.utility_payment_logs (utility_account_id, paid_on);

-- Net metering: one row per plant per bill month (when both are set)
delete from public.solar_net_metering_logs a
using public.solar_net_metering_logs b
where a.solar_site_id is not null
  and b.solar_site_id is not null
  and a.bill_month is not null
  and b.bill_month is not null
  and a.solar_site_id = b.solar_site_id
  and a.bill_month = b.bill_month
  and a.id <> b.id
  and (
    a.updated_at < b.updated_at
    or (a.updated_at = b.updated_at and a.id < b.id)
  );

create unique index if not exists solar_net_metering_logs_site_month_uidx
  on public.solar_net_metering_logs (solar_site_id, bill_month)
  where solar_site_id is not null and bill_month is not null;
