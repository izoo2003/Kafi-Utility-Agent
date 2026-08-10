-- Phase 6: dedupe log for scheduled alert notifications

create table public.alert_notifications (
  alert_id text primary key,
  domain text not null
    check (domain in ('kitchen', 'it', 'generator', 'solar')),
  severity text not null
    check (severity in ('critical', 'warning', 'info')),
  title text not null,
  detail text not null,
  channel text not null
    check (channel in ('email', 'console')),
  last_sent_at timestamptz not null default now(),
  send_count integer not null default 1,
  created_at timestamptz not null default now()
);

create index alert_notifications_last_sent_at_idx
  on public.alert_notifications (last_sent_at desc);

alter table public.alert_notifications enable row level security;

-- Dashboard can view notification history; cron uses service role (bypasses RLS)
create policy "Authenticated read alert_notifications"
  on public.alert_notifications
  for select
  to authenticated
  using (true);
