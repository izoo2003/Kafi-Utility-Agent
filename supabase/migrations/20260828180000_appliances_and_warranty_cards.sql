-- Appliances register (mirrors it_equipment) + warranty card photos for both domains

alter table public.it_equipment
  add column if not exists warranty_card_url text;

comment on column public.it_equipment.warranty_card_url is
  'Supabase Storage path for the warranty card photo/PDF';

create table public.appliances (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  asset_tag text not null unique,
  item_name text not null,
  category text,
  assigned_to text,
  serial_number text,
  purchase_date date,
  warranty_expiry date,
  status text not null default 'active'
    check (status in ('active', 'in_repair', 'retired')),
  location text,
  notes text,
  warranty_card_url text
);

comment on column public.appliances.warranty_card_url is
  'Supabase Storage path for the warranty card photo/PDF';

create trigger appliances_set_updated_at
before update on public.appliances
for each row execute function public.set_updated_at();

alter table public.appliances enable row level security;

create policy "Authenticated full access on appliances"
  on public.appliances for all to authenticated
  using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'warranty-cards',
  'warranty-cards',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Authenticated read warranty-cards" on storage.objects;
create policy "Authenticated read warranty-cards"
  on storage.objects for select to authenticated
  using (bucket_id = 'warranty-cards');

drop policy if exists "Authenticated insert warranty-cards" on storage.objects;
create policy "Authenticated insert warranty-cards"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'warranty-cards');

drop policy if exists "Authenticated update warranty-cards" on storage.objects;
create policy "Authenticated update warranty-cards"
  on storage.objects for update to authenticated
  using (bucket_id = 'warranty-cards')
  with check (bucket_id = 'warranty-cards');

drop policy if exists "Authenticated delete warranty-cards" on storage.objects;
create policy "Authenticated delete warranty-cards"
  on storage.objects for delete to authenticated
  using (bucket_id = 'warranty-cards');
