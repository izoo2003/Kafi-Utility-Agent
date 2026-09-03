-- Solar service / maintenance log (one history per plant).

create table public.solar_maintenance (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  site_id text not null,
  service_date date not null,
  next_service_due date,
  service_type text,
  vendor text,
  cost numeric,
  notes text,
  checkup_status text not null default 'done'
    check (checkup_status in ('done', 'not_done'))
);

create trigger solar_maintenance_set_updated_at
before update on public.solar_maintenance
for each row execute function public.set_updated_at();

create index solar_maintenance_site_date_idx
  on public.solar_maintenance (site_id, service_date desc);

alter table public.solar_maintenance enable row level security;

create policy "Authenticated full access on solar_maintenance"
  on public.solar_maintenance for all to authenticated
  using (true) with check (true);

comment on table public.solar_maintenance is
  'Service and maintenance records per solar plant (site_id matches SEMS_SITES id).';

comment on column public.solar_maintenance.site_id is
  'Plant slug: kafi-commodities (Good We Office), sungrow-office (Sungrow Office), nizam-energy (KMP Home Solar).';
