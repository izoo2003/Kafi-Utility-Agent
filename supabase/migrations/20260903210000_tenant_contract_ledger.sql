-- Tenant contract ledger: survey/deposit fields, line items, monthly schedule, payments

alter table public.tenants
  add column if not exists survey_no text,
  add column if not exists contract_start_date date,
  add column if not exists contract_end_date date,
  add column if not exists security_deposit_amount numeric,
  add column if not exists security_deposit_bank_account text,
  add column if not exists security_deposit_bank_name text,
  add column if not exists security_deposit_cheque_no text,
  add column if not exists sqft numeric,
  add column if not exists rate numeric,
  add column if not exists rate_type text not null default 'per_sqft',
  add column if not exists gross_rent numeric,
  add column if not exists contract_detail text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenants_rate_type_check'
  ) then
    alter table public.tenants
      add constraint tenants_rate_type_check
      check (rate_type in ('per_sqft', 'lum_sum'));
  end if;
end $$;

comment on column public.tenants.survey_no is 'Survey / plot number for the leased space.';
comment on column public.tenants.contract_start_date is 'Lease start date; monthly schedule is generated from this.';
comment on column public.tenants.contract_end_date is 'Lease end date. Agreement expiry alerts use this date.';
comment on column public.tenants.rate_type is 'per_sqft (gross_rent = sqft * rate) or lum_sum (flat monthly rent).';

create table if not exists public.tenant_rent_line_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  tenant_id uuid not null
    references public.tenants (id) on delete cascade,
  label text not null,
  amount numeric not null default 0,
  sort_order int not null default 0
);

create index if not exists tenant_rent_line_items_tenant_idx
  on public.tenant_rent_line_items (tenant_id, sort_order);

create trigger tenant_rent_line_items_set_updated_at
before update on public.tenant_rent_line_items
for each row execute function public.set_updated_at();

create table if not exists public.tenant_rent_schedule (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  tenant_id uuid not null
    references public.tenants (id) on delete cascade,
  serial_no int not null,
  period_year int not null,
  period_month int not null,
  period_start date not null,
  period_end date not null,
  survey_no text,
  sqft numeric,
  rate numeric,
  rate_type text not null default 'per_sqft',
  gross_rent numeric,
  line_items jsonb not null default '[]'::jsonb,
  total_due numeric not null default 0,
  unique (tenant_id, period_year, period_month)
);

create index if not exists tenant_rent_schedule_tenant_idx
  on public.tenant_rent_schedule (tenant_id, serial_no);

create trigger tenant_rent_schedule_set_updated_at
before update on public.tenant_rent_schedule
for each row execute function public.set_updated_at();

create table if not exists public.tenant_rent_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  schedule_id uuid not null
    references public.tenant_rent_schedule (id) on delete cascade,
  amount_received numeric not null default 0,
  payer_bank_account text,
  payer_bank_name text,
  payee_bank_account text,
  payee_bank_name text,
  cheque_no text,
  payment_reference text,
  payment_file_url text
);

create index if not exists tenant_rent_payments_schedule_idx
  on public.tenant_rent_payments (schedule_id, created_at);

create trigger tenant_rent_payments_set_updated_at
before update on public.tenant_rent_payments
for each row execute function public.set_updated_at();

alter table public.tenant_rent_line_items enable row level security;
alter table public.tenant_rent_schedule enable row level security;
alter table public.tenant_rent_payments enable row level security;

drop policy if exists "Authenticated full access on tenant_rent_line_items"
  on public.tenant_rent_line_items;
create policy "Authenticated full access on tenant_rent_line_items"
  on public.tenant_rent_line_items for all to authenticated
  using (true) with check (true);

drop policy if exists "Authenticated full access on tenant_rent_schedule"
  on public.tenant_rent_schedule;
create policy "Authenticated full access on tenant_rent_schedule"
  on public.tenant_rent_schedule for all to authenticated
  using (true) with check (true);

drop policy if exists "Authenticated full access on tenant_rent_payments"
  on public.tenant_rent_payments;
create policy "Authenticated full access on tenant_rent_payments"
  on public.tenant_rent_payments for all to authenticated
  using (true) with check (true);

-- Migrate snapshot fields into the new contract columns
update public.tenants
set
  contract_end_date = coalesce(contract_end_date, agreement_expiry),
  gross_rent = coalesce(gross_rent, rent_amount),
  rate_type = case
    when rate is not null and sqft is not null then rate_type
    else 'lum_sum'
  end
where contract_end_date is null
   or gross_rent is null;

update public.tenants t
set contract_start_date = s.earliest
from (
  select tenant_id, min(rent_due_date) as earliest
  from public.tenant_rent_logs
  where rent_due_date is not null
  group by tenant_id
) s
where t.id = s.tenant_id
  and t.contract_start_date is null;

update public.tenants t
set
  contract_start_date = s.earliest,
  contract_end_date = coalesce(t.contract_end_date, s.latest)
from (
  select tenant_id, min(rent_due_date) as earliest, max(rent_due_date) as latest
  from public.tenant_rent_logs
  where rent_due_date is not null
  group by tenant_id
) s
where t.id = s.tenant_id
  and t.contract_end_date is null;

-- Generate calendar-month schedule rows for tenants with a date range
do $$
declare
  rec record;
  y int;
  m int;
  serial int;
  month_start date;
  month_end date;
  p_start date;
  p_end date;
  due numeric;
begin
  for rec in
    select *
    from public.tenants
    where contract_start_date is not null
      and contract_end_date is not null
      and contract_end_date >= contract_start_date
  loop
    y := extract(year from rec.contract_start_date)::int;
    m := extract(month from rec.contract_start_date)::int;
    serial := 1;
    due := coalesce(rec.gross_rent, rec.rent_amount, 0);
    while make_date(y, m, 1) <= date_trunc('month', rec.contract_end_date)::date loop
      month_start := make_date(y, m, 1);
      month_end := (month_start + interval '1 month' - interval '1 day')::date;
      p_start := greatest(month_start, rec.contract_start_date);
      p_end := least(month_end, rec.contract_end_date);
      insert into public.tenant_rent_schedule (
        tenant_id, serial_no, period_year, period_month,
        period_start, period_end, survey_no, sqft, rate, rate_type,
        gross_rent, line_items, total_due
      )
      values (
        rec.id, serial, y, m, p_start, p_end,
        rec.survey_no, rec.sqft, rec.rate, rec.rate_type,
        coalesce(rec.gross_rent, rec.rent_amount),
        '[]'::jsonb,
        due
      )
      on conflict (tenant_id, period_year, period_month) do nothing;
      serial := serial + 1;
      m := m + 1;
      if m > 12 then
        m := 1;
        y := y + 1;
      end if;
    end loop;
  end loop;
end $$;

-- Schedule rows from rent logs whose month is not already generated
insert into public.tenant_rent_schedule (
  tenant_id, serial_no, period_year, period_month,
  period_start, period_end, survey_no, sqft, rate, rate_type,
  gross_rent, line_items, total_due
)
select
  l.tenant_id,
  1,
  extract(year from l.rent_due_date)::int,
  extract(month from l.rent_due_date)::int,
  date_trunc('month', l.rent_due_date)::date,
  (date_trunc('month', l.rent_due_date) + interval '1 month' - interval '1 day')::date,
  t.survey_no,
  t.sqft,
  t.rate,
  t.rate_type,
  coalesce(l.rent_amount, t.gross_rent, t.rent_amount),
  '[]'::jsonb,
  coalesce(l.rent_amount, t.gross_rent, t.rent_amount, 0)
from public.tenant_rent_logs l
join public.tenants t on t.id = l.tenant_id
where l.rent_due_date is not null
on conflict (tenant_id, period_year, period_month) do nothing;

-- Renumber serials per tenant after mixed inserts
update public.tenant_rent_schedule s
set serial_no = n.rn
from (
  select
    id,
    row_number() over (
      partition by tenant_id
      order by period_year, period_month
    ) as rn
  from public.tenant_rent_schedule
) n
where s.id = n.id
  and s.serial_no is distinct from n.rn;

-- Payments from historical rent logs
insert into public.tenant_rent_payments (
  schedule_id,
  amount_received,
  payment_reference,
  payment_file_url,
  updated_by
)
select
  s.id,
  case
    when l.payment_status = 'paid' then coalesce(l.rent_amount, s.total_due, 0)
    when l.payment_status = 'partial' then
      greatest(
        coalesce(l.rent_amount, s.total_due, 0) - coalesce(l.outstanding_amount, 0),
        0
      )
    when l.payment_date is not null then coalesce(l.rent_amount, 0)
    else 0
  end,
  null,
  l.payment_file_url,
  l.updated_by
from public.tenant_rent_logs l
join public.tenant_rent_schedule s
  on s.tenant_id = l.tenant_id
 and extract(year from l.rent_due_date)::int = s.period_year
 and extract(month from l.rent_due_date)::int = s.period_month
where l.rent_due_date is not null
  and (
    l.payment_status in ('paid', 'partial')
    or l.payment_date is not null
    or coalesce(l.outstanding_amount, 0) > 0
  )
  and case
    when l.payment_status = 'paid' then coalesce(l.rent_amount, s.total_due, 0)
    when l.payment_status = 'partial' then
      greatest(
        coalesce(l.rent_amount, s.total_due, 0) - coalesce(l.outstanding_amount, 0),
        0
      )
    when l.payment_date is not null then coalesce(l.rent_amount, 0)
    else 0
  end > 0;
