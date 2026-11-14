-- Hide topics until solved by default for new users.

alter table public.user_settings
  alter column hide_topics_until_solved set default true;
