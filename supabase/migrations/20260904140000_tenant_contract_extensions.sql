-- Tenant contract extension log: appends new ledger months under new terms
-- without ever touching previously generated (and possibly paid) months.

create table if not exists public.tenant_contract_extensions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  extension_from date not null,
  extension_till date not null,
  changes jsonb not null default '[]'::jsonb,
  notes text,
  check (extension_till >= extension_from)
);

create index if not exists tenant_contract_extensions_tenant_idx
  on public.tenant_contract_extensions (tenant_id, extension_from);

create trigger tenant_contract_extensions_set_updated_at
before update on public.tenant_contract_extensions
for each row execute function public.set_updated_at();

alter table public.tenant_contract_extensions enable row level security;

drop policy if exists "Authenticated full access on tenant_contract_extensions"
  on public.tenant_contract_extensions;
create policy "Authenticated full access on tenant_contract_extensions"
  on public.tenant_contract_extensions for all to authenticated
  using (true) with check (true);

comment on table public.tenant_contract_extensions is
  'Audit log of contract extensions. Each row records the new period appended to the ledger and which fields changed (old/new) for that extension; existing schedule rows are never modified by an extension.';
