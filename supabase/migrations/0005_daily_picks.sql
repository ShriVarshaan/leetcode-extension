-- Topic weights and each user's stored daily picks.

create table public.topic_weights (
  topic   text primary key,
  weight  real not null check (weight > 0),
  source  text not null
);

alter table public.topic_weights enable row level security;

create policy "Topic weights are readable by everyone" on public.topic_weights
  for select to anon, authenticated using (true);

-- Problem count in Blind 75 + NeetCode 150 relative to the average, clamped to [0.5, 2.0].
-- Hand-editable: update a row and set source = 'manual'.
insert into public.topic_weights (topic, weight, source) values
  ('Trees', 1.80, 'list-count-2026-10-18'),
  ('Graphs', 1.56, 'list-count-2026-10-18'),
  ('1-D Dynamic Programming', 1.44, 'list-count-2026-10-18'),
  ('2-D Dynamic Programming', 1.32, 'list-count-2026-10-18'),
  ('Linked List', 1.32, 'list-count-2026-10-18'),
  ('Backtracking', 1.08, 'list-count-2026-10-18'),
  ('Arrays & Hashing', 1.08, 'list-count-2026-10-18'),
  ('Math & Geometry', 0.96, 'list-count-2026-10-18'),
  ('Greedy', 0.96, 'list-count-2026-10-18'),
  ('Heap / Priority Queue', 0.84, 'list-count-2026-10-18'),
  ('Binary Search', 0.84, 'list-count-2026-10-18'),
  ('Bit Manipulation', 0.84, 'list-count-2026-10-18'),
  ('Stack', 0.84, 'list-count-2026-10-18'),
  ('Sliding Window', 0.72, 'list-count-2026-10-18'),
  ('Advanced Graphs', 0.72, 'list-count-2026-10-18'),
  ('Intervals', 0.72, 'list-count-2026-10-18'),
  ('Two Pointers', 0.60, 'list-count-2026-10-18'),
  ('Tries', 0.50, 'list-count-2026-10-18');

-- One row per user per local day, so the set of picks stays stable all day.
-- picks: [{slug, topic, title, difficulty, kind, reason}]
-- ratings: {slug: 1..4 | "auto"} for completed picks that have been rated (or auto-reviewed).
create table public.daily_recs (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  picks       jsonb not null,
  completed   text[] not null default '{}',
  ratings     jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.daily_recs enable row level security;

create policy "Users manage their own daily picks" on public.daily_recs
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
