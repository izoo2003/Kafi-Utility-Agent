-- Generator maintenance vendors (people responsible for generator service).

create table public.generator_vendors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  name text not null,
  phone text,
  notes text
);

create unique index generator_vendors_name_unique
  on public.generator_vendors (lower(trim(name)));

create trigger generator_vendors_set_updated_at
before update on public.generator_vendors
for each row execute function public.set_updated_at();

alter table public.generator_vendors enable row level security;

create policy "Authenticated full access on generator_vendors"
  on public.generator_vendors for all to authenticated
  using (true) with check (true);

comment on table public.generator_vendors is
  'People responsible for generator maintenance. Name is unique case-insensitively.';

insert into public.generator_vendors (name, phone)
select 'Abdullah', '03442440046'
where not exists (
  select 1 from public.generator_vendors
  where lower(trim(name)) = 'abdullah'
);
