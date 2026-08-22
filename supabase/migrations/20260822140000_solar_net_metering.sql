-- Solar net metering ledger (K-Electric bill credits vs consumption)

create table public.solar_net_metering_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  solar_site_id text,
  ke_account_number text,
  consumer_name text,
  bill_period_label text,
  bill_month text,
  previous_balance_rs numeric not null default 0,
  net_metering_rs numeric,
  consumed_rs numeric,
  gross_balance_rs numeric,
  refund_rs numeric not null default 0,
  net_balance_rs numeric,
  estimated_refund_rs numeric,
  units_import_kwh numeric,
  units_export_kwh numeric,
  payable_rs numeric,
  bill_file_path text,
  ai_extraction jsonb,
  ai_narrative text,
  sems_export_kwh numeric,
  notes text
);

create trigger solar_net_metering_logs_set_updated_at
before update on public.solar_net_metering_logs
for each row execute function public.set_updated_at();

create index solar_net_metering_logs_month_idx
  on public.solar_net_metering_logs (bill_month desc nulls last, created_at desc);

create index solar_net_metering_logs_account_idx
  on public.solar_net_metering_logs (ke_account_number, bill_month desc);

alter table public.solar_net_metering_logs enable row level security;

create policy "Authenticated full access on solar_net_metering_logs"
  on public.solar_net_metering_logs for all to authenticated
  using (true) with check (true);

comment on table public.solar_net_metering_logs is
  'K-Electric net metering ledger rows — credits, consumption, running balance, refund estimate.';
