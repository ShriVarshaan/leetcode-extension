-- Review history and the RPC that applies a review to a topic's schedule.

create table public.user_review_log (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic        text not null,
  slug         text not null references public.problems (slug) on update cascade on delete cascade,
  rating       smallint not null check (rating between 1 and 4),
  source       text not null check (source in ('rated', 'auto')),
  reviewed_at  timestamptz not null
);

create index user_review_log_user_topic_idx on public.user_review_log (user_id, topic, reviewed_at desc);

alter table public.user_review_log enable row level security;

create policy "Users manage their own review log" on public.user_review_log
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Logs a review and stores the new schedule in one transaction. The schedule itself is
-- computed by the extension (lib/srs.ts). p_prev_reviewed_at must match the topic's current
-- last_reviewed_at, so a review computed from stale state is rejected instead of overwriting.
create function public.apply_review(
  p_topic            text,
  p_slug             text,
  p_rating           smallint,
  p_source           text,
  p_reviewed_at      timestamptz,
  p_prev_reviewed_at timestamptz,
  p_ease             real,
  p_interval_days    real,
  p_reps             integer,
  p_due_at           timestamptz
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from problems where slug = p_slug and topic = p_topic) then
    raise exception 'Problem % is not in topic %', p_slug, p_topic;
  end if;

  update user_topic_state set
    ease = p_ease,
    interval_days = p_interval_days,
    reps = p_reps,
    due_at = p_due_at,
    last_reviewed_at = p_reviewed_at
  where user_id = v_user
    and topic = p_topic
    and last_reviewed_at is not distinct from p_prev_reviewed_at;
  if not found then
    raise exception 'Topic % changed since it was loaded (or has no schedule). Reload and try again.', p_topic;
  end if;

  insert into user_review_log (user_id, topic, slug, rating, source, reviewed_at)
  values (v_user, p_topic, p_slug, p_rating, p_source, p_reviewed_at);
end;
$$;

revoke execute on function public.apply_review(text, text, smallint, text, timestamptz, timestamptz, real, real, integer, timestamptz) from public, anon;
grant execute on function public.apply_review(text, text, smallint, text, timestamptz, timestamptz, real, real, integer, timestamptz) to authenticated;

-- Same as 0003, but also returns `advanced`: the solves that are new or newer than what was
-- stored, so the extension can turn them into automatic reviews.
create or replace function public.record_solves(p_solves jsonb, p_source text)
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
  v_advanced jsonb;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;

  -- Every part of this statement sees user_solves as it was before the upsert, so the
  -- `advanced` comparison is against the previously stored last_solved_at.
  with input as (
    select s->>'slug' as slug, (s->>'solved_at')::timestamptz as solved_at
    from jsonb_array_elements(p_solves) as s
  ), in_catalog as (
    select i.slug, p.topic, min(i.solved_at) as first_at, max(i.solved_at) as last_at
    from input i
    join problems p on p.slug = i.slug
    group by i.slug, p.topic
  ), advanced as (
    select c.slug, c.topic, c.last_at
    from in_catalog c
    left join user_solves u on u.user_id = v_user and u.slug = c.slug
    where u.slug is null or c.last_at > u.last_solved_at
  ), upserted as (
    insert into user_solves (user_id, slug, first_solved_at, last_solved_at, source)
    select v_user, slug, first_at, last_at, p_source from in_catalog
    on conflict (user_id, slug) do update set
      first_solved_at = least(user_solves.first_solved_at, excluded.first_solved_at),
      last_solved_at  = greatest(user_solves.last_solved_at, excluded.last_solved_at)
    returning (xmax = 0) as inserted   -- xmax = 0 means the row was newly inserted
  )
  select
    (select count(*) from upserted),
    (select count(*) from upserted where inserted),
    coalesce(
      (select jsonb_agg(jsonb_build_object('slug', slug, 'topic', topic, 'solved_at', last_at) order by last_at)
       from advanced),
      '[]'::jsonb
    )
  into v_in_catalog, v_new, v_advanced;

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
    'new_topics', v_new_topics,
    'advanced', v_advanced
  );
end;
$$;
