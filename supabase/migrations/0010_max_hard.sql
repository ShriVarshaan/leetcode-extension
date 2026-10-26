-- Cap on Hard problems in a day's picks.

alter table public.user_settings
  add column max_hard smallint not null default 3 check (max_hard between 0 and 3);
