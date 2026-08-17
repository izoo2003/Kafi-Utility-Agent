-- Seed K-Electric sites + SSGC/KWSB Clifton Office (safe to re-run).
-- Legacy single-provider rows are left untouched; new labels are distinct.

insert into public.utility_accounts (utility_type, provider, billing_cycle, notes)
select v.utility_type, v.provider, v.billing_cycle, v.notes
from (
  values
    ('electricity', 'K-Electric — SURWAY NO 239G Mill', 'monthly', 'Site K-Electric — SURWAY NO 239G Mill bill. Next due = last paid + 1 month.'),
    ('electricity', 'K-Electric — SURWAY NO 234G Mill', 'monthly', 'Site K-Electric — SURWAY NO 234G Mill bill. Next due = last paid + 1 month.'),
    ('electricity', 'K-Electric — Clifton Office', 'monthly', 'Site K-Electric — Clifton Office bill. Next due = last paid + 1 month.'),
    ('electricity', 'K-Electric — Personal House', 'monthly', 'Site K-Electric — Personal House bill. Next due = last paid + 1 month.'),
    ('gas', 'SSGC (Gas) — Clifton Office', 'monthly', 'Site SSGC (Gas) — Clifton Office bill. Next due = last paid + 1 month.'),
    ('gas', 'SSGC (Gas) — Personal House', 'monthly', 'Site SSGC (Gas) — Personal House bill. Next due = last paid + 1 month.'),
    ('water', 'KWSB (Water Board) — Clifton Office', 'monthly', 'Site KWSB (Water Board) — Clifton Office bill. Next due = last paid + 1 month.'),
    ('internet', 'Jazz monthly bill — Khalid Paracha', 'monthly', 'Site Jazz monthly bill — Khalid Paracha. Next due = last paid + 1 month.'),
    ('internet', 'Jazz monthly bill — Sadia Paracha', 'monthly', 'Site Jazz monthly bill — Sadia Paracha. Next due = last paid + 1 month.')
) as v(utility_type, provider, billing_cycle, notes)
where not exists (
  select 1
  from public.utility_accounts u
  where lower(trim(u.provider)) = lower(trim(v.provider))
);
