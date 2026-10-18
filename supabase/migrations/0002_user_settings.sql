-- Per-user settings that should follow the user across devices.
-- The LLM API key is deliberately NOT stored here; it stays in chrome.storage.local.

create table public.user_settings (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  lc_username   text,
  lists         text[] not null default '{blind75,neetcode150,striver_a2z}',
  include_paid  boolean not null default false,
  daily_time    time not null default '09:00',
  timezone      text not null default 'UTC',
  updated_at    timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users read their own settings" on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Users create their own settings" on public.user_settings
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "Users update their own settings" on public.user_settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Users delete their own settings" on public.user_settings
  for delete to authenticated using (user_id = (select auth.uid()));
