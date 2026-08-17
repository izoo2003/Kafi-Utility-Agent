-- K-Electric bill payment fields: units, bill period, invoice, optional PDF path

alter table public.utility_payment_logs
  add column if not exists units_kwh numeric;

alter table public.utility_payment_logs
  add column if not exists bill_period text;

alter table public.utility_payment_logs
  add column if not exists invoice_number text;

alter table public.utility_payment_logs
  add column if not exists bill_file_url text;

comment on column public.utility_payment_logs.units_kwh is
  'kWh / units from the bill for this payment period';
comment on column public.utility_payment_logs.bill_period is
  'Billing month label from KE (e.g. Jul-26)';
comment on column public.utility_payment_logs.invoice_number is
  'Utility invoice / e-bill number';
comment on column public.utility_payment_logs.bill_file_url is
  'Supabase Storage path for the uploaded bill PDF';

-- Storage bucket for utility bill PDFs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'utility-bills',
  'utility-bills',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Authenticated read utility-bills" on storage.objects;
create policy "Authenticated read utility-bills"
  on storage.objects for select to authenticated
  using (bucket_id = 'utility-bills');

drop policy if exists "Authenticated insert utility-bills" on storage.objects;
create policy "Authenticated insert utility-bills"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'utility-bills');

drop policy if exists "Authenticated update utility-bills" on storage.objects;
create policy "Authenticated update utility-bills"
  on storage.objects for update to authenticated
  using (bucket_id = 'utility-bills')
  with check (bucket_id = 'utility-bills');

drop policy if exists "Authenticated delete utility-bills" on storage.objects;
create policy "Authenticated delete utility-bills"
  on storage.objects for delete to authenticated
  using (bucket_id = 'utility-bills');
