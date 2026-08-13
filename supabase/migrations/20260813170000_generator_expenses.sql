-- Generator expense ledger (from fuel/expense sheets; debit amounts totaled)
create table public.generator_expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  expense_date date not null,
  account text,
  description text,
  debit numeric not null default 0,
  credit numeric,
  notes text
);

create trigger generator_expenses_set_updated_at
before update on public.generator_expenses
for each row execute function public.set_updated_at();

create index generator_expenses_expense_date_idx
  on public.generator_expenses (expense_date desc);

alter table public.generator_expenses enable row level security;

create policy "Authenticated full access on generator_expenses"
  on public.generator_expenses for all to authenticated
  using (true) with check (true);

comment on table public.generator_expenses is
  'Generator expense rows from ledgers/PDFs; total expense = sum(debit).';
