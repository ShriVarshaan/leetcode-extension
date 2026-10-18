-- What each user has solved (catalog problems only) and their per-topic review schedule.

create table public.user_solves (
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug             text not null references public.problems (slug) on update cascade on delete cascade,
  first_solved_at  timestamptz not null,
  last_solved_at   timestamptz not null,
  source           text not null check (source in ('import', 'sync')),
  primary key (user_id, slug)
);

-- One row per topic the user has solved at least one problem in. Fields are used by
-- the spaced-repetition engine (Phase 4); here they're only seeded.
create table public.user_topic_state (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic             text not null,
  ease              real not null default 2.5,
  interval_days     real not null default 0,
  reps              integer not null default 0,
  due_at            timestamptz not null,
  last_reviewed_at  timestamptz,
  primary key (user_id, topic)
);

alter table public.user_solves      enable row level security;
alter table public.user_topic_state enable row level security;

create policy "Users manage their own solves" on public.user_solves
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Users manage their own topic state" on public.user_topic_state
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Records a batch of solves for the signed-in user, then creates review schedules for any
-- topic seen for the first time. p_solves: [{"slug": "two-sum", "solved_at": "2026-01-01T00:00:00Z"}, ...]
-- Slugs that aren't in the catalog are ignored. Runs as the caller, so RLS still applies.
create function public.record_solves(p_solves jsonb, p_source text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_in_catalog integer;
  v_new integer;
  v_new_topics integer;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;

  with input as (
    select s->>'slug' as slug, (s->>'solved_at')::timestamptz as solved_at
    from jsonb_array_elements(p_solves) as s
  ), in_catalog as (
    select i.slug, min(i.solved_at) as first_at, max(i.solved_at) as last_at
    from input i
    join problems p on p.slug = i.slug
    group by i.slug
  ), upserted as (
    insert into user_solves (user_id, slug, first_solved_at, last_solved_at, source)
    select v_user, slug, first_at, last_at, p_source from in_catalog
    on conflict (user_id, slug) do update set
      first_solved_at = least(user_solves.first_solved_at, excluded.first_solved_at),
      last_solved_at  = greatest(user_solves.last_solved_at, excluded.last_solved_at)
    returning (xmax = 0) as inserted   -- xmax = 0 means the row was newly inserted
  )
  select count(*), count(*) filter (where inserted) into v_in_catalog, v_new from upserted;

  -- First reviews for new topics are spread over the next 14 days, so they don't all
  -- come due at once. Topics practised longest ago come due first.
  with new_topics as (
    select p.topic, max(s.last_solved_at) as last_at
    from user_solves s
    join problems p on p.slug = s.slug
    where s.user_id = v_user
      and not exists (
        select 1 from user_topic_state t where t.user_id = v_user and t.topic = p.topic
      )
    group by p.topic
  ), ranked as (
    select topic,
           row_number() over (order by last_at) - 1 as rn,
           count(*) over () as n
    from new_topics
  )
  insert into user_topic_state (user_id, topic, due_at)
  select v_user, topic, date_trunc('day', now()) + make_interval(days => 1 + floor(rn * 14.0 / n)::int)
  from ranked;
  get diagnostics v_new_topics = row_count;

  return jsonb_build_object(
    'received', jsonb_array_length(p_solves),
    'in_catalog', v_in_catalog,
    'new', v_new,
    'new_topics', v_new_topics
  );
end;
$$;

revoke execute on function public.record_solves(jsonb, text) from public, anon;
grant execute on function public.record_solves(jsonb, text) to authenticated;
