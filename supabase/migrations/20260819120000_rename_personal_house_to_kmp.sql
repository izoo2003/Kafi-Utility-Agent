-- Rename utility site "Personal House" → "KMP House"

update public.utility_accounts
set
  provider = 'K-Electric — KMP House',
  notes = replace(coalesce(notes, ''), 'Personal House', 'KMP House'),
  updated_at = now()
where provider = 'K-Electric — Personal House';

update public.utility_accounts
set
  provider = 'SSGC (Gas) — KMP House',
  notes = replace(coalesce(notes, ''), 'Personal House', 'KMP House'),
  updated_at = now()
where provider = 'SSGC (Gas) — Personal House';
