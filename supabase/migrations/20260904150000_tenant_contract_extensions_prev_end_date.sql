-- Track the tenant's contract_end_date immediately before each extension so
-- an edit/delete can revert it precisely.

alter table public.tenant_contract_extensions
  add column if not exists previous_contract_end_date date;

comment on column public.tenant_contract_extensions.previous_contract_end_date is
  'tenant.contract_end_date as it was right before this extension was applied. Used to revert on edit/delete.';
