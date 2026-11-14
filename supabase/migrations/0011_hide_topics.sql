-- Option to hide a pick's topic until it's solved.

alter table public.user_settings
  add column hide_topics_until_solved boolean not null default false;
