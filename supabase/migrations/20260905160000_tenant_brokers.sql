create table if not exists public.tenant_brokers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  broker_name text not null,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sqft numeric,
  rate numeric,
  monthly_rent numeric not null default 0,
  stay_months integer not null default 0,
  stay_days integer not null default 0,
  stay_factor numeric not null default 0,
  commission_amount numeric not null default 0,
  notes text
);

create index if not exists tenant_brokers_tenant_idx
  on public.tenant_brokers (tenant_id);

create index if not exists tenant_brokers_name_idx
  on public.tenant_brokers (broker_name);

create trigger tenant_brokers_set_updated_at
before update on public.tenant_brokers
for each row execute function public.set_updated_at();

alter table public.tenant_brokers enable row level security;

drop policy if exists "Authenticated full access on tenant_brokers"
  on public.tenant_brokers;
create policy "Authenticated full access on tenant_brokers"
  on public.tenant_brokers for all to authenticated
  using (true) with check (true);

comment on table public.tenant_brokers is
  'Broker commission slips. Commission = (monthly rent / 12) × contract stay (full months + leftover days / 30).';
