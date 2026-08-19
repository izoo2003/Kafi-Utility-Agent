-- PTCL split into Office + KMP House sections (empty accounts; bills via chat)

insert into public.utility_accounts (utility_type, provider, billing_cycle, notes)
select v.utility_type, v.provider, v.billing_cycle, v.notes
from (
  values
    ('internet'::text, 'PTCL — Office'::text, 'monthly'::text, 'Site PTCL — Office bill. Next due = last paid + 1 month.'::text),
    ('internet'::text, 'PTCL — KMP House'::text, 'monthly'::text, 'Site PTCL — KMP House bill. Next due = last paid + 1 month.'::text)
) as v(utility_type, provider, billing_cycle, notes)
where not exists (
  select 1 from public.utility_accounts ua where ua.provider = v.provider
);

-- Hide legacy single "PTCL" row from active use (keep history if any payments)
update public.utility_accounts
set
  notes = coalesce(notes, '') || ' [legacy single PTCL — use PTCL — Office or PTCL — KMP House]',
  updated_at = now()
where provider = 'PTCL';
