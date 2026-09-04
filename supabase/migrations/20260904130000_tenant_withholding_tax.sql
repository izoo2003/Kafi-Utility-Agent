-- Tenant official/unofficial classification + withholding tax slabs

alter table public.tenants
  add column if not exists classification text not null default 'unofficial'
    check (classification in ('official', 'unofficial'));

comment on column public.tenants.classification is
  'official = withholding tax slabs apply; unofficial = no WHT.';

alter table public.tenant_rent_schedule
  add column if not exists withholding_tax numeric not null default 0;

comment on column public.tenant_rent_schedule.withholding_tax is
  'Withholding tax for the month (0 for unofficial tenants). total_due is rent net of this amount.';

create table if not exists public.withholding_tax_slabs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  label text,
  min_amount numeric not null default 0,
  max_amount numeric,
  rate_percent numeric not null,
  notes text,
  check (min_amount >= 0),
  check (max_amount is null or max_amount >= min_amount),
  check (rate_percent >= 0)
);

create index if not exists withholding_tax_slabs_min_idx
  on public.withholding_tax_slabs (min_amount asc);

create trigger withholding_tax_slabs_set_updated_at
before update on public.withholding_tax_slabs
for each row execute function public.set_updated_at();

alter table public.withholding_tax_slabs enable row level security;

drop policy if exists "Authenticated full access on withholding_tax_slabs"
  on public.withholding_tax_slabs;
create policy "Authenticated full access on withholding_tax_slabs"
  on public.withholding_tax_slabs for all to authenticated
  using (true) with check (true);

comment on table public.withholding_tax_slabs is
  'User-maintained WHT rate bands matched against monthly rent (gross + extras). Applied to all official tenants.';
