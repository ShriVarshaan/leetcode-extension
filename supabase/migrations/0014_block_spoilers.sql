-- Option to hide hints, topic tags and discussion on leetcode.com until the problem is accepted that day.

alter table public.user_settings
  add column block_spoilers_until_accepted boolean not null default false;
