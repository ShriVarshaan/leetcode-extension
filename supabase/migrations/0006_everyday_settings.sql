-- Per-user topic weight overrides and the optional daily notification.

alter table public.user_settings
  add column weight_overrides    jsonb not null default '{}',   -- {topic: weight}
  add column daily_notification  boolean not null default false;

alter table public.user_settings
  add constraint weight_overrides_is_object check (jsonb_typeof(weight_overrides) = 'object');
