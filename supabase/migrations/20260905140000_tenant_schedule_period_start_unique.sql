-- Ledger rows are rent-day cycles (and a leftover stub) keyed by period_start,
-- not by calendar month. Two rows can share a calendar month.
alter table public.tenant_rent_schedule
  drop constraint if exists tenant_rent_schedule_tenant_id_period_year_period_month_key;

drop index if exists tenant_rent_schedule_tenant_id_period_year_period_month_key;

create unique index if not exists tenant_rent_schedule_tenant_period_start_uidx
  on public.tenant_rent_schedule (tenant_id, period_start);
