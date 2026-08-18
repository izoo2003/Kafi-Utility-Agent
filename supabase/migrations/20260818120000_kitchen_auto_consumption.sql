-- Automated kitchen consumption tracking + audit log

alter table public.kitchen_inventory
  add column if not exists last_auto_decrement_on date;

comment on column public.kitchen_inventory.last_auto_decrement_on is
  'Last calendar date (site) when daily auto-consumption was applied.';

create table if not exists public.kitchen_consumption_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kitchen_item_id uuid not null references public.kitchen_inventory (id) on delete cascade,
  applied_on date not null,
  qty_before numeric not null,
  qty_after numeric not null,
  qty_delta numeric not null,
  reason text not null default 'auto_daily',
  notes text
);

create index if not exists kitchen_consumption_log_item_applied_idx
  on public.kitchen_consumption_log (kitchen_item_id, applied_on desc);

alter table public.kitchen_consumption_log enable row level security;

drop policy if exists "kitchen_consumption_log_authenticated_all"
  on public.kitchen_consumption_log;
create policy "kitchen_consumption_log_authenticated_all"
  on public.kitchen_consumption_log
  for all
  to authenticated
  using (true)
  with check (true);
