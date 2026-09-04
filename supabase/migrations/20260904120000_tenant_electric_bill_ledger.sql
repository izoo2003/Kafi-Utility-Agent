-- Tenant electricity bills: meter ledger fields (period, readings, rate) + bill attachment

alter table public.tenant_electric_bills
  add column if not exists period_from date,
  add column if not exists period_to date,
  add column if not exists months numeric,
  add column if not exists last_reading numeric,
  add column if not exists current_reading numeric,
  add column if not exists consumed_units numeric,
  add column if not exists rate_inclusive_govt numeric,
  add column if not exists amount_received numeric,
  add column if not exists bill_file_url text;

-- Backfill period_to from legacy due_date so alerts/order still work
update public.tenant_electric_bills
set period_to = due_date
where period_to is null
  and due_date is not null;

create index if not exists tenant_electric_bills_tenant_period_idx
  on public.tenant_electric_bills (tenant_id, period_to desc nulls last, created_at desc);

comment on column public.tenant_electric_bills.period_from is
  'Billing period start date (From).';
comment on column public.tenant_electric_bills.period_to is
  'Billing period end date (To); also synced to due_date for back-compat.';
comment on column public.tenant_electric_bills.months is
  'Calendar-month span of the billing period (derived from period_from/period_to).';
comment on column public.tenant_electric_bills.last_reading is
  'Meter reading at period start.';
comment on column public.tenant_electric_bills.current_reading is
  'Meter reading at period end.';
comment on column public.tenant_electric_bills.consumed_units is
  'current_reading - last_reading (derived).';
comment on column public.tenant_electric_bills.rate_inclusive_govt is
  'Rate per unit inclusive of government charges.';
comment on column public.tenant_electric_bills.ke_charges_amount is
  'Bill amount = consumed_units × rate_inclusive_govt (derived).';
comment on column public.tenant_electric_bills.amount_received is
  'Amount received from the tenant for this bill.';
comment on column public.tenant_electric_bills.bill_file_url is
  'Storage path for the electricity bill PDF/photo in tenant-documents.';
