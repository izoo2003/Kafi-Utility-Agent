alter table public.tenant_rent_schedule
  add column if not exists withholding_tax_received numeric not null default 0;

comment on column public.tenant_rent_schedule.withholding_tax_received is
  'WHT remitted for this month. Unpaid WHT (withholding_tax − this) is added to balance.';

comment on column public.tenant_rent_schedule.total_due is
  'Gross rent + extra charges for the period. Not net of withholding tax.';

-- Existing official rows stored net-of-WHT; restore charges = gross + extras.
update public.tenant_rent_schedule s
set total_due = round((
  coalesce(s.gross_rent, 0)
  + coalesce((
      select sum(coalesce((item->>'amount')::numeric, 0))
      from jsonb_array_elements(coalesce(s.line_items, '[]'::jsonb)) as item
    ), 0)
)::numeric, 2);
