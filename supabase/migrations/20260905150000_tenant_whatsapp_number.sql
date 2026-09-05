alter table public.tenants
  add column if not exists whatsapp_number text;

comment on column public.tenants.whatsapp_number is
  'Tenant WhatsApp in international digits (e.g. 923001234567). Used for click-to-chat rent due reminders.';
