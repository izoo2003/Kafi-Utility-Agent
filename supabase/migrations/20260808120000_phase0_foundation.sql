-- Phase 0 foundation: audit helpers, 5 domain table groups, RLS, solar storage bucket

-- Shared updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Kitchen inventory
-- ---------------------------------------------------------------------------
create table public.kitchen_inventory (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  item_name text not null,
  category text,
  unit text,
  current_qty numeric not null default 0,
  reorder_level numeric not null default 0,
  reorder_qty numeric,
  supplier text,
  cost_per_unit numeric,
  last_restocked_at date,
  notes text
);

create trigger kitchen_inventory_set_updated_at
before update on public.kitchen_inventory
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. IT equipment register
-- ---------------------------------------------------------------------------
create table public.it_equipment (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  asset_tag text not null unique,
  item_name text not null,
  category text,
  assigned_to text,
  serial_number text,
  purchase_date date,
  warranty_expiry date,
  status text not null default 'active'
    check (status in ('active', 'in_repair', 'retired')),
  location text,
  notes text
);

create trigger it_equipment_set_updated_at
before update on public.it_equipment
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Generator (maintenance + fuel log)
-- ---------------------------------------------------------------------------
create table public.generator_maintenance (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  service_date date not null,
  next_service_due date,
  service_type text,
  vendor text,
  cost numeric,
  notes text
);

create trigger generator_maintenance_set_updated_at
before update on public.generator_maintenance
for each row execute function public.set_updated_at();

create table public.generator_fuel_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  log_date date not null,
  liters_added numeric,
  running_hours numeric,
  fuel_level_pct numeric,
  cost numeric,
  notes text
);

create trigger generator_fuel_log_set_updated_at
before update on public.generator_fuel_log
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Solar system (specs + monitoring log)
-- ---------------------------------------------------------------------------
create table public.solar_specs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  panel_capacity_kw numeric,
  inverter_model text,
  battery_capacity_kwh numeric,
  install_date date,
  vendor text,
  warranty_expiry date,
  spec_file_url text
);

create trigger solar_specs_set_updated_at
before update on public.solar_specs
for each row execute function public.set_updated_at();

create table public.solar_monitoring_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  log_date date not null,
  generation_kwh numeric,
  consumption_kwh numeric,
  battery_soc_pct numeric,
  alert_flag boolean not null default false,
  notes text
);

create trigger solar_monitoring_log_set_updated_at
before update on public.solar_monitoring_log
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Internet & utility accounts
-- ---------------------------------------------------------------------------
create table public.utility_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  utility_type text not null
    check (utility_type in ('internet', 'electricity', 'gas', 'water')),
  provider text,
  account_number text,
  billing_cycle text,
  monthly_avg_cost numeric,
  due_date_day int check (due_date_day is null or (due_date_day >= 1 and due_date_day <= 31)),
  contact_person text,
  notes text
);

create trigger utility_accounts_set_updated_at
before update on public.utility_accounts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — single-site admin; authenticated users have full access
-- ---------------------------------------------------------------------------
alter table public.kitchen_inventory enable row level security;
alter table public.it_equipment enable row level security;
alter table public.generator_maintenance enable row level security;
alter table public.generator_fuel_log enable row level security;
alter table public.solar_specs enable row level security;
alter table public.solar_monitoring_log enable row level security;
alter table public.utility_accounts enable row level security;

create policy "Authenticated full access on kitchen_inventory"
  on public.kitchen_inventory for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access on it_equipment"
  on public.it_equipment for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access on generator_maintenance"
  on public.generator_maintenance for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access on generator_fuel_log"
  on public.generator_fuel_log for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access on solar_specs"
  on public.solar_specs for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access on solar_monitoring_log"
  on public.solar_monitoring_log for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access on utility_accounts"
  on public.utility_accounts for all to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Storage bucket for solar spec files (Word/PDF)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'solar-specs',
  'solar-specs',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create policy "Authenticated read solar-specs"
  on storage.objects for select to authenticated
  using (bucket_id = 'solar-specs');

create policy "Authenticated insert solar-specs"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'solar-specs');

create policy "Authenticated update solar-specs"
  on storage.objects for update to authenticated
  using (bucket_id = 'solar-specs')
  with check (bucket_id = 'solar-specs');

create policy "Authenticated delete solar-specs"
  on storage.objects for delete to authenticated
  using (bucket_id = 'solar-specs');
