-- Monthly generator checkup status: done | not_done
alter table public.generator_maintenance
  add column if not exists checkup_status text not null default 'done';

alter table public.generator_maintenance
  drop constraint if exists generator_maintenance_checkup_status_check;

alter table public.generator_maintenance
  add constraint generator_maintenance_checkup_status_check
  check (checkup_status in ('done', 'not_done'));

comment on column public.generator_maintenance.checkup_status is
  'Whether this monthly checkup was completed (done) or is still pending (not_done).';

-- Backfill empty next_service_due to +1 month from service_date (monthly cadence)
update public.generator_maintenance
set next_service_due = (service_date + interval '1 month')::date
where next_service_due is null;

-- Seed baseline only when the table is empty:
-- last checkup = day before yesterday, next due = one month after that.
insert into public.generator_maintenance (
  service_date,
  next_service_due,
  service_type,
  checkup_status,
  notes
)
select
  (current_date - 2),
  ((current_date - 2) + interval '1 month')::date,
  'Monthly checkup',
  'done',
  'Baseline: last completed checkup (day before yesterday); next due in one month.'
where not exists (
  select 1 from public.generator_maintenance limit 1
);
