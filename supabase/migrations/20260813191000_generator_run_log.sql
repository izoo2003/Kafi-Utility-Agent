-- Outage / generator run sessions (manual). Oil change due after 200h summed.

create table if not exists public.generator_run_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  run_date date not null,
  hours_run numeric not null check (hours_run > 0),
  started_at timestamptz,
  ended_at timestamptz,
  notes text
);

create trigger generator_run_log_set_updated_at
before update on public.generator_run_log
for each row execute function public.set_updated_at();

create index if not exists generator_run_log_run_date_idx
  on public.generator_run_log (run_date desc);

alter table public.generator_run_log enable row level security;

drop policy if exists "Authenticated full access on generator_run_log"
  on public.generator_run_log;
create policy "Authenticated full access on generator_run_log"
  on public.generator_run_log for all to authenticated
  using (true) with check (true);

comment on table public.generator_run_log is
  'Manual generator run sessions (e.g. during power outages). Oil change interval = sum(hours_run) since last oil change.';
