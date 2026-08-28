-- Split appliances into Clifton Office and GondPass Mill registers

alter table public.appliances
  add column if not exists site text not null default 'clifton_office';

alter table public.appliances
  drop constraint if exists appliances_site_check;

alter table public.appliances
  add constraint appliances_site_check
  check (site in ('clifton_office', 'gondpass_mill'));

comment on column public.appliances.site is
  'Appliance register site: clifton_office | gondpass_mill';

alter table public.appliances
  drop constraint if exists appliances_asset_tag_key;

drop index if exists appliances_asset_tag_key;

create unique index if not exists appliances_site_asset_tag_key
  on public.appliances (site, asset_tag);
