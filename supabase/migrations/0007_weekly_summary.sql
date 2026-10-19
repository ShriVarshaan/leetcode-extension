-- Weekly summary email: opt-in flag, a send log, and the hourly cron job that calls the
-- weekly-summary Edge Function. The function itself sends to users whose local time is
-- Sunday 18:00-18:59, at most once per week.
--
-- Needs two Vault secrets (created separately, never committed):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random>', 'weekly_summary_cron_secret');
-- and the same random value as the function's CRON_SECRET.

alter table public.user_settings
  add column weekly_email boolean not null default false;

-- Written only by the Edge Function (service role). Users can read their own rows.
create table public.weekly_email_log (
  user_id     uuid not null references auth.users (id) on delete cascade,
  week_start  date not null,   -- the Monday of the summarised week, in the user's time zone
  sent_at     timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.weekly_email_log enable row level security;

create policy "Users read their own weekly email log" on public.weekly_email_log
  for select to authenticated using (user_id = (select auth.uid()));

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'weekly-summary',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/weekly-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'weekly_summary_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
