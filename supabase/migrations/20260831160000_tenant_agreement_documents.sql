-- Tenant agreement expiry + document attachments (agreement + payment receipts)

alter table public.tenants
  add column if not exists agreement_expiry date;

alter table public.tenants
  add column if not exists agreement_file_url text;

alter table public.tenants
  add column if not exists payment_file_url text;

alter table public.tenant_rent_logs
  add column if not exists payment_file_url text;

comment on column public.tenants.agreement_expiry is
  'Lease / tenancy agreement end date. Alert 1 month before expiry.';
comment on column public.tenants.agreement_file_url is
  'Supabase Storage path for the agreement PDF or photo.';
comment on column public.tenants.payment_file_url is
  'Current rent payment receipt (snapshot; kept in sync with the latest rent log).';
comment on column public.tenant_rent_logs.payment_file_url is
  'Supabase Storage path for this rent payment receipt (PDF or photo).';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-documents',
  'tenant-documents',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Authenticated read tenant-documents" on storage.objects;
create policy "Authenticated read tenant-documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'tenant-documents');

drop policy if exists "Authenticated insert tenant-documents" on storage.objects;
create policy "Authenticated insert tenant-documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-documents');

drop policy if exists "Authenticated update tenant-documents" on storage.objects;
create policy "Authenticated update tenant-documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'tenant-documents')
  with check (bucket_id = 'tenant-documents');

drop policy if exists "Authenticated delete tenant-documents" on storage.objects;
create policy "Authenticated delete tenant-documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-documents');
