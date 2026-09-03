-- AI bill summary cache on each utility payment (latest bill vs previous).

alter table public.utility_payment_logs
  add column if not exists ai_summary text;

alter table public.utility_payment_logs
  add column if not exists ai_summary_model text;

alter table public.utility_payment_logs
  add column if not exists ai_summary_at timestamptz;

comment on column public.utility_payment_logs.ai_summary is
  'AI report: why this bill is this amount, vs previous bill, and the difference.';
comment on column public.utility_payment_logs.ai_summary_model is
  'Gemini model that wrote ai_summary.';
comment on column public.utility_payment_logs.ai_summary_at is
  'When ai_summary was generated.';
