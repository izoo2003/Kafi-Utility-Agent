-- Filer-only Pakistan tax-on-rent bands for 2026-27 (yearly rent, progressive).
-- Replaces any previous monthly flat-rate slabs.

comment on table public.withholding_tax_slabs is
  'Filer WHT bands on yearly rent. Progressive: each band taxes only the slice inside it. Applied automatically to official tenants; unofficial tenants stay at 0.';

delete from public.withholding_tax_slabs;

insert into public.withholding_tax_slabs (
  label,
  min_amount,
  max_amount,
  rate_percent,
  notes
) values
  (
    'Up to Rs. 300,000',
    0,
    300000,
    0,
    'No tax. First Rs. 300,000 of yearly rent is tax-free.'
  ),
  (
    'Rs. 300,001 – 600,000',
    300000,
    600000,
    5,
    '5% of the yearly rent above Rs. 300,000.'
  ),
  (
    'Rs. 600,001 – 2,000,000',
    600000,
    2000000,
    10,
    'Rs. 15,000 + 10% of the yearly rent above Rs. 600,000.'
  ),
  (
    'Above Rs. 2,000,000',
    2000000,
    null,
    25,
    'Rs. 155,000 + 25% of the yearly rent above Rs. 2,000,000.'
  );

-- Recalculate stored monthly WHT + net due from the Filer yearly bands.
with official_rows as (
  select
    s.id,
    coalesce(s.gross_rent, 0) + coalesce((
      select sum(coalesce((item->>'amount')::numeric, 0))
      from jsonb_array_elements(coalesce(s.line_items, '[]'::jsonb)) as item
    ), 0) as monthly
  from public.tenant_rent_schedule s
  join public.tenants t on t.id = s.tenant_id
  where t.classification = 'official'
),
taxed as (
  select
    id,
    monthly,
    (
      greatest(0, least(monthly * 12, 600000) - 300000) * 0.05
      + greatest(0, least(monthly * 12, 2000000) - 600000) * 0.10
      + greatest(0, monthly * 12 - 2000000) * 0.25
    ) as yearly_tax
  from official_rows
)
update public.tenant_rent_schedule s
set
  withholding_tax = round((t.yearly_tax / 12)::numeric, 2),
  total_due = round(greatest(0, t.monthly - (t.yearly_tax / 12))::numeric, 2)
from taxed t
where s.id = t.id;

update public.tenant_rent_schedule s
set
  withholding_tax = 0,
  total_due = coalesce(s.gross_rent, 0) + coalesce((
    select sum(coalesce((item->>'amount')::numeric, 0))
    from jsonb_array_elements(coalesce(s.line_items, '[]'::jsonb)) as item
  ), 0)
from public.tenants t
where t.id = s.tenant_id
  and t.classification = 'unofficial';
