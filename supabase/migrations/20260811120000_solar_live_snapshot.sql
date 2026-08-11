-- SEMS+ live telemetry snapshots (polled server-side)

create table public.solar_live_snapshot (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  station_id text not null unique,
  station_name text,
  fetched_at timestamptz not null default now(),
  pv_power_kw numeric,
  load_power_kw numeric,
  grid_power_kw numeric,
  battery_power_kw numeric,
  battery_soc_pct numeric,
  generation_today_kwh numeric,
  consumption_today_kwh numeric,
  raw jsonb,
  last_error text
);

create trigger solar_live_snapshot_set_updated_at
before update on public.solar_live_snapshot
for each row execute function public.set_updated_at();

create index solar_live_snapshot_fetched_at_idx
  on public.solar_live_snapshot (fetched_at desc);

alter table public.solar_live_snapshot enable row level security;

create policy "Authenticated read solar_live_snapshot"
  on public.solar_live_snapshot
  for select
  to authenticated
  using (true);

-- Writes go through service role (cron / sync API). Authenticated users only read.
