-- Fixed site utilities: mobile type, payment logs, due alerts domain

alter table public.utility_accounts
  drop constraint if exists utility_accounts_utility_type_check;

alter table public.utility_accounts
  add constraint utility_accounts_utility_type_check
  check (utility_type in ('internet', 'electricity', 'gas', 'water', 'mobile'));

-- Seed the five site bills (idempotent by provider label)
insert into public.utility_accounts (utility_type, provider, billing_cycle, notes)
select v.utility_type, v.provider, v.billing_cycle, v.notes
from (
  values
    ('electricity', 'K-Electric', 'monthly', 'Site electricity bill. Next due = last paid + 1 month.'),
    ('internet', 'PTCL', 'monthly', 'Site PTCL bill. Next due = last paid + 1 month.'),
    ('gas', 'SSGC (Gas)', 'monthly', 'Site gas bill. Next due = last paid + 1 month.'),
    ('water', 'KWSB (Water Board)', 'monthly', 'Site water board bill. Next due = last paid + 1 month.'),
    ('mobile', 'Jazz monthly bill', 'monthly', 'Site Jazz monthly bill. Next due = last paid + 1 month.')
) as v(utility_type, provider, billing_cycle, notes)
where not exists (
  select 1
  from public.utility_accounts u
  where lower(trim(u.provider)) = lower(trim(v.provider))
);

create table public.utility_payment_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  utility_account_id uuid not null
    references public.utility_accounts (id) on delete cascade,
  paid_on date not null,
  amount numeric,
  notes text
);

create trigger utility_payment_logs_set_updated_at
before update on public.utility_payment_logs
for each row execute function public.set_updated_at();

create index utility_payment_logs_account_paid_on_idx
  on public.utility_payment_logs (utility_account_id, paid_on desc);

alter table public.utility_payment_logs enable row level security;

create policy "Authenticated full access on utility_payment_logs"
  on public.utility_payment_logs for all to authenticated
  using (true) with check (true);

comment on table public.utility_payment_logs is
  'Payment history per utility account; next due = latest paid_on + 1 month.';

-- Allow utilities domain in alert digest dedupe table
alter table public.alert_notifications
  drop constraint if exists alert_notifications_domain_check;

alter table public.alert_notifications
  add constraint alert_notifications_domain_check
  check (domain in ('kitchen', 'it', 'generator', 'solar', 'utilities'));
