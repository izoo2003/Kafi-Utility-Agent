-- Fix utility_type check if an earlier migration left the old 4-value constraint.
-- Safe to re-run. Also ensures Jazz can be seeded as internet.

do $$
declare
  cname text;
begin
  for cname in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'utility_accounts'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%utility_type%'
  loop
    execute format('alter table public.utility_accounts drop constraint %I', cname);
  end loop;
end $$;

alter table public.utility_accounts
  add constraint utility_accounts_utility_type_check
  check (utility_type in ('internet', 'electricity', 'gas', 'water', 'mobile'));

insert into public.utility_accounts (utility_type, provider, billing_cycle, notes)
select v.utility_type, v.provider, v.billing_cycle, v.notes
from (
  values
    ('electricity', 'K-Electric', 'monthly', 'Site electricity bill. Next due = last paid + 1 month.'),
    ('internet', 'PTCL', 'monthly', 'Site PTCL bill. Next due = last paid + 1 month.'),
    ('gas', 'SSGC (Gas)', 'monthly', 'Site gas bill. Next due = last paid + 1 month.'),
    ('water', 'KWSB (Water Board)', 'monthly', 'Site water board bill. Next due = last paid + 1 month.'),
    ('internet', 'Jazz monthly bill', 'monthly', 'Site Jazz monthly bill. Next due = last paid + 1 month.')
) as v(utility_type, provider, billing_cycle, notes)
where not exists (
  select 1
  from public.utility_accounts u
  where lower(trim(u.provider)) = lower(trim(v.provider))
);
