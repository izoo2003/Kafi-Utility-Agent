-- Tenants domain: accounts, rent payment history, tenant electricity (KE) bills

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  tenant_name text not null,
  rent_amount numeric,
  rent_due_date date,
  payment_status text not null default 'unpaid'
    check (payment_status in ('paid', 'unpaid', 'partial', 'overdue')),
  payment_date date,
  outstanding_amount numeric,
  notes text
);

create unique index tenants_name_unique
  on public.tenants (lower(trim(tenant_name)));

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

create table public.tenant_rent_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  tenant_id uuid not null
    references public.tenants (id) on delete cascade,
  rent_amount numeric,
  rent_due_date date,
  payment_status text not null default 'unpaid'
    check (payment_status in ('paid', 'unpaid', 'partial', 'overdue')),
  payment_date date,
  outstanding_amount numeric,
  notes text
);

create index tenant_rent_logs_tenant_due_idx
  on public.tenant_rent_logs (tenant_id, rent_due_date desc nulls last, created_at desc);

create trigger tenant_rent_logs_set_updated_at
before update on public.tenant_rent_logs
for each row execute function public.set_updated_at();

create table public.tenant_electric_bills (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  tenant_id uuid not null
    references public.tenants (id) on delete cascade,
  ke_charges_amount numeric,
  due_date date,
  payment_status text not null default 'unpaid'
    check (payment_status in ('paid', 'unpaid', 'partial', 'overdue')),
  payment_date date,
  outstanding_amount numeric,
  notes text
);

create index tenant_electric_bills_tenant_due_idx
  on public.tenant_electric_bills (tenant_id, due_date desc nulls last, created_at desc);

create trigger tenant_electric_bills_set_updated_at
before update on public.tenant_electric_bills
for each row execute function public.set_updated_at();

alter table public.tenants enable row level security;
alter table public.tenant_rent_logs enable row level security;
alter table public.tenant_electric_bills enable row level security;

create policy "Authenticated full access on tenants"
  on public.tenants for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access on tenant_rent_logs"
  on public.tenant_rent_logs for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access on tenant_electric_bills"
  on public.tenant_electric_bills for all to authenticated
  using (true) with check (true);

comment on table public.tenants is
  'Tenant accounts with current rent snapshot (name, amount, due, payment status/date, outstanding).';
comment on table public.tenant_rent_logs is
  'Rent payment history per tenant; current snapshot on tenants is kept in sync with the latest log.';
comment on table public.tenant_electric_bills is
  'K-Electric (or other) electricity charges billed to each tenant.';

-- Allow tenants domain in alert digest dedupe table
do $$
declare
  cname text;
begin
  for cname in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'alert_notifications'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%domain%'
  loop
    execute format('alter table public.alert_notifications drop constraint %I', cname);
  end loop;
end $$;

alter table public.alert_notifications
  add constraint alert_notifications_domain_check
  check (domain in ('kitchen', 'it', 'generator', 'solar', 'utilities', 'tenants'));
