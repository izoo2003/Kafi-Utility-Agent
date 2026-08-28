-- Chart of Accounts: subsidiary ledgers (Solar Panel Clifton, E.O.B.I,
-- K-Electric Gondpass, KWSB Clifton). Running balance is computed in the app.

create table public.chart_of_accounts_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  ledger text not null check (
    ledger in (
      'solar_panel_clifton',
      'eobi',
      'k_electric_gondpass',
      'kwsb_clifton'
    )
  ),
  entry_date date not null,
  ref_no text,
  account_description text,
  document_no text,
  debit numeric not null default 0,
  credit numeric not null default 0,
  notes text
);

create trigger chart_of_accounts_entries_set_updated_at
before update on public.chart_of_accounts_entries
for each row execute function public.set_updated_at();

create index chart_of_accounts_entries_ledger_date_idx
  on public.chart_of_accounts_entries (ledger, entry_date desc);

alter table public.chart_of_accounts_entries enable row level security;

create policy "Authenticated full access on chart_of_accounts_entries"
  on public.chart_of_accounts_entries for all to authenticated
  using (true) with check (true);

comment on table public.chart_of_accounts_entries is
  'Chart of Accounts ledger lines for Solar Panel Clifton, E.O.B.I, K-Electric Gondpass, and KWSB Clifton. Balance = running debit − credit.';
