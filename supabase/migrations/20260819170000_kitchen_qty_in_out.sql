-- Kitchen stock ledger: cumulative In / Out; Stock = In - Out

alter table public.kitchen_inventory
  add column if not exists qty_in numeric not null default 0;

alter table public.kitchen_inventory
  add column if not exists qty_out numeric not null default 0;

comment on column public.kitchen_inventory.qty_in is
  'Cumulative stock received (In).';
comment on column public.kitchen_inventory.qty_out is
  'Cumulative stock finished/consumed (Out).';
comment on column public.kitchen_inventory.current_qty is
  'Current stock = qty_in - qty_out (maintained by app).';

-- Backfill from consumption log: Out = abs(negative deltas), In = stock + Out
with agg as (
  select
    kitchen_item_id,
    coalesce(sum(case when qty_delta < 0 then -qty_delta else 0 end), 0) as outs,
    coalesce(sum(case when qty_delta > 0 then qty_delta else 0 end), 0) as ins_from_log
  from public.kitchen_consumption_log
  group by kitchen_item_id
)
update public.kitchen_inventory k
set
  qty_out = round(coalesce(a.outs, 0)::numeric, 3),
  qty_in = round(
    (
      greatest(coalesce(k.current_qty, 0), 0)
      + coalesce(a.outs, 0)
    )::numeric,
    3
  )
from agg a
where a.kitchen_item_id = k.id;

-- Items with no log rows: treat current stock as opening In
update public.kitchen_inventory
set
  qty_in = round(greatest(coalesce(current_qty, 0), 0)::numeric, 3),
  qty_out = 0
where qty_in = 0
  and qty_out = 0
  and coalesce(current_qty, 0) > 0
  and not exists (
    select 1
    from public.kitchen_consumption_log l
    where l.kitchen_item_id = kitchen_inventory.id
  );

-- Keep stock aligned
update public.kitchen_inventory
set current_qty = round(greatest(qty_in - qty_out, 0)::numeric, 3);
