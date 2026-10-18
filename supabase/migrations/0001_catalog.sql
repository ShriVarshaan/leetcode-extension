-- Problem catalog: curated lists and the LeetCode problems in them.
-- Readable by everyone (anon + signed-in users). Only the service role (scripts/upload.ts) writes.

create table public.problems (
  slug        text primary key,                 -- e.g. 'two-sum'; matches LeetCode's titleSlug
  lc_id       integer not null unique,          -- LeetCode's frontend problem number, e.g. 1
  title       text not null,
  difficulty  text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  topic       text not null,                    -- canonical revision topic (one per problem)
  tags        text[] not null default '{}',     -- LeetCode topic tag slugs
  is_paid     boolean not null default false,
  url         text generated always as ('https://leetcode.com/problems/' || slug || '/') stored
);

create index problems_topic_idx on public.problems (topic);

create table public.lists (
  id    text primary key,                       -- 'blind75' | 'neetcode150' | 'striver_a2z'
  name  text not null
);

create table public.list_problems (
  list_id     text not null references public.lists (id) on delete cascade,
  slug        text not null references public.problems (slug) on delete cascade on update cascade,
  position    integer not null,
  section     text not null,
  subsection  text,
  primary key (list_id, slug)
);

create index list_problems_slug_idx on public.list_problems (slug);

alter table public.problems      enable row level security;
alter table public.lists         enable row level security;
alter table public.list_problems enable row level security;

create policy "Catalog is readable by everyone" on public.problems      for select to anon, authenticated using (true);
create policy "Catalog is readable by everyone" on public.lists         for select to anon, authenticated using (true);
create policy "Catalog is readable by everyone" on public.list_problems for select to anon, authenticated using (true);
