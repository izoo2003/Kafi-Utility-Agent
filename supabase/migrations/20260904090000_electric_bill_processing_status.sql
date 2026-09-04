-- Allow a manually-set "processing" payment status on the tenant electricity
-- bill ledger (Unpaid / Paid / Processing dropdown).
alter table public.tenant_electric_bills
  drop constraint if exists tenant_electric_bills_payment_status_check;

alter table public.tenant_electric_bills
  add constraint tenant_electric_bills_payment_status_check
  check (payment_status in ('paid', 'unpaid', 'partial', 'overdue', 'processing'));
