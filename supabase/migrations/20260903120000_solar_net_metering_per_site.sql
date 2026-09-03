-- Per-plant net metering ledgers (Good We Office, Sungrow Office, KMP Home Solar)

-- Historic rows were a single shared ledger (the original KE plant).
update public.solar_net_metering_logs
set solar_site_id = 'kafi-commodities'
where solar_site_id is null or btrim(solar_site_id) = '';

create index if not exists solar_net_metering_logs_site_idx
  on public.solar_net_metering_logs (solar_site_id, bill_month desc nulls last);

comment on table public.solar_net_metering_logs is
  'K-Electric net metering ledger rows per solar plant — credits, consumption, running balance, refund estimate.';

comment on column public.solar_net_metering_logs.solar_site_id is
  'Plant slug: kafi-commodities (Good We Office), sungrow-office (Sungrow Office), nizam-energy (KMP Home Solar). Each plant has its own running ledger.';
