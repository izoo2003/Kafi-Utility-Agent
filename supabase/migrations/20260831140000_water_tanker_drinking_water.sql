-- Water tanker (Home, Office, two mills) + drinking water (Clifton Office).

insert into public.utility_accounts (utility_type, provider, billing_cycle, notes)
select v.utility_type, v.provider, v.billing_cycle, v.notes
from (
  values
    ('water'::text, 'Water tanker — Home'::text, 'monthly'::text, 'Site Water tanker — Home bill. Next due = last paid + 1 month.'::text),
    ('water'::text, 'Water tanker — Office'::text, 'monthly'::text, 'Site Water tanker — Office bill. Next due = last paid + 1 month.'::text),
    ('water'::text, 'Water tanker — SURWAY NO 239G Mill'::text, 'monthly'::text, 'Site Water tanker — SURWAY NO 239G Mill bill. Next due = last paid + 1 month.'::text),
    ('water'::text, 'Water tanker — SURWAY NO 234G Mill'::text, 'monthly'::text, 'Site Water tanker — SURWAY NO 234G Mill bill. Next due = last paid + 1 month.'::text),
    ('water'::text, 'Drinking water — Clifton Office'::text, 'monthly'::text, 'Site Drinking water — Clifton Office bill. Next due = last paid + 1 month.'::text)
) as v(utility_type, provider, billing_cycle, notes)
where not exists (
  select 1
  from public.utility_accounts u
  where lower(trim(u.provider)) = lower(trim(v.provider))
);
