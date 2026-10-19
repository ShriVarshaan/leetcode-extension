import { pickDaily, type CatalogProblem, type DailyPick, type Difficulty, type TopicInput } from './candidates';
import { rateReview, recordAutoReviews } from './reviews';
import { loadSettings, type UserSettings } from './settings';
import type { NewSolve, Rating, TopicState } from './srs';
import { supabase } from './supabase';
import { addDays, localDay } from './time';
import { todayCache, type DailyRecs } from './today-cache';

export { remaining, todayCache, type DailyRecs } from './today-cache';

export interface TopicRow {
  topic: string;
  state: TopicState;
  weight: number;
  baseWeight: number;
}

export async function loadTopics(settings: UserSettings): Promise<TopicRow[]> {
  const [states, weights] = await Promise.all([
    supabase.from('user_topic_state').select('topic, ease, interval_days, reps, due_at, last_reviewed_at'),
    supabase.from('topic_weights').select('topic, weight'),
  ]);
  if (states.error) throw states.error;
  if (weights.error) throw weights.error;
  const base = new Map(weights.data.map((w) => [w.topic, w.weight as number]));
  return states.data.map((r) => {
    const baseWeight = base.get(r.topic) ?? 1;
    return {
      topic: r.topic,
      state: {
        ease: r.ease,
        intervalDays: r.interval_days,
        reps: r.reps,
        dueAt: r.due_at,
        lastReviewedAt: r.last_reviewed_at,
      },
      baseWeight,
      weight: settings.weight_overrides[r.topic] ?? baseWeight,
    };
  });
}

async function loadCatalog(): Promise<CatalogProblem[]> {
  const { data, error } = await supabase
    .from('problems')
    .select('slug, title, difficulty, topic, is_paid, list_problems(list_id, position)');
  if (error) throw error;
  return data.map((p) => {
    const lists = p.list_problems as { list_id: string; position: number }[];
    return {
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty as Difficulty,
      topic: p.topic,
      isPaid: p.is_paid,
      lists: lists.map((l) => l.list_id),
      position: Math.min(...lists.map((l) => l.position), Number.MAX_SAFE_INTEGER),
    };
  });
}

async function loadSolvedAt(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('user_solves').select('slug, last_solved_at');
  if (error) throw error;
  return new Map(data.map((s) => [s.slug, s.last_solved_at]));
}

async function loadLastReviews(): Promise<Map<string, { rating: Rating; slug: string }>> {
  const { data, error } = await supabase
    .from('user_review_log')
    .select('topic, slug, rating')
    .order('reviewed_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  const last = new Map<string, { rating: Rating; slug: string }>();
  for (const r of data) if (!last.has(r.topic)) last.set(r.topic, { rating: r.rating as Rating, slug: r.slug });
  return last;
}

async function loadRecs(from: string, to: string): Promise<DailyRecs[]> {
  const { data, error } = await supabase
    .from('daily_recs')
    .select('date, picks, completed, ratings')
    .gte('date', from)
    .lte('date', to)
    .order('date');
  if (error) throw error;
  return data as DailyRecs[];
}

async function generate(
  settings: UserSettings,
  today: string,
  opts: { exclude?: Set<string>; excludeTopics?: Set<string>; count?: number } = {},
): Promise<DailyPick[]> {
  const [topics, problems, solvedAt, lastReviews, recent] = await Promise.all([
    loadTopics(settings),
    loadCatalog(),
    loadSolvedAt(),
    loadLastReviews(),
    loadRecs(addDays(today, -6), today),
  ]);
  const difficultyOf = new Map(problems.map((p) => [p.slug, p.difficulty]));
  const inputs: TopicInput[] = topics.map((t) => {
    const last = lastReviews.get(t.topic);
    return {
      topic: t.topic,
      state: t.state,
      weight: t.weight,
      lastRating: last?.rating ?? null,
      lastDifficulty: (last && difficultyOf.get(last.slug)) || null,
    };
  });
  return pickDaily({
    now: new Date(),
    topics: inputs,
    problems,
    lists: settings.lists,
    includePaid: settings.include_paid,
    solvedAt,
    recentlyRecommended: new Set(recent.flatMap((r) => r.picks.map((p) => p.slug))),
    ...opts,
  });
}

// Picks completed on earlier days but never rated count as automatic Good reviews, so the
// topic's schedule still moves forward.
async function settleUnrated(settings: UserSettings, today: string) {
  const rows = (await loadRecs(addDays(today, -14), addDays(today, -1))).filter((r) =>
    r.completed.some((slug) => !(slug in r.ratings)),
  );
  if (rows.length === 0) return;
  const solvedAt = await loadSolvedAt();
  const solves: NewSolve[] = rows.flatMap((r) =>
    r.picks
      .filter((p) => r.completed.includes(p.slug) && !(p.slug in r.ratings))
      .map((p) => ({ slug: p.slug, topic: p.topic, solvedAt: solvedAt.get(p.slug) ?? `${r.date}T12:00:00Z` })),
  );
  await recordAutoReviews(solves, settings.timezone);
  for (const r of rows) {
    const ratings = { ...r.ratings };
    for (const slug of r.completed) ratings[slug] ??= 'auto';
    const { error } = await supabase.from('daily_recs').update({ ratings }).eq('date', r.date);
    if (error) throw error;
  }
}

async function loadToday(today: string): Promise<DailyRecs | null> {
  const { data, error } = await supabase
    .from('daily_recs')
    .select('date, picks, completed, ratings')
    .eq('date', today)
    .maybeSingle();
  if (error) throw error;
  return data as DailyRecs | null;
}

async function cache(recs: DailyRecs | null): Promise<DailyRecs | null> {
  await todayCache.setValue(recs);
  return recs;
}

export function todayFor(settings: UserSettings): string {
  return localDay(new Date(), settings.timezone);
}

// Today's picks, building them if they don't exist yet. Safe to call from several places at
// once: only the first insert wins, and everyone then reads the same row.
export async function ensureToday(settings?: UserSettings): Promise<DailyRecs> {
  settings ??= await loadSettings();
  const today = todayFor(settings);
  const existing = await loadToday(today);
  if (existing) return (await cache(existing))!;

  await settleUnrated(settings, today);
  const picks = await generate(settings, today);
  const { error } = await supabase
    .from('daily_recs')
    .upsert({ date: today, picks }, { onConflict: 'user_id,date', ignoreDuplicates: true });
  if (error) throw error;
  return (await cache(await loadToday(today)))!;
}

// Today's row if it already exists (doesn't build one).
export async function peekToday(settings?: UserSettings): Promise<DailyRecs | null> {
  settings ??= await loadSettings();
  return cache(await loadToday(todayFor(settings)));
}

// Replaces today's unfinished picks with different problems, keeping completed ones.
export async function pickAgain(): Promise<DailyRecs> {
  const settings = await loadSettings();
  const recs = await ensureToday(settings);
  const kept = recs.picks.filter((p) => recs.completed.includes(p.slug));
  if (kept.length >= 3) return recs;
  const fresh = await generate(settings, recs.date, {
    exclude: new Set(recs.picks.map((p) => p.slug)),
    excludeTopics: new Set(kept.map((p) => p.topic)),
    count: 3 - kept.length,
  });
  if (fresh.length === 0) return recs;
  const picks = [...kept, ...fresh];
  const { error } = await supabase.from('daily_recs').update({ picks }).eq('date', recs.date);
  if (error) throw error;
  return (await cache({ ...recs, picks }))!;
}

// Splits newly synced solves into today's picks (marked completed, waiting for a rating) and
// everything else (returned, to become automatic reviews).
export async function markCompleted(solves: NewSolve[], settings: UserSettings): Promise<NewSolve[]> {
  if (solves.length === 0) return solves;
  const recs = await loadToday(todayFor(settings));
  if (!recs) return solves;
  const picked = new Set(recs.picks.map((p) => p.slug));
  const done = solves.filter((s) => picked.has(s.slug)).map((s) => s.slug);
  const completed = [...new Set([...recs.completed, ...done])];
  if (completed.length !== recs.completed.length) {
    const { error } = await supabase.from('daily_recs').update({ completed }).eq('date', recs.date);
    if (error) throw error;
    await cache({ ...recs, completed });
  }
  return solves.filter((s) => !picked.has(s.slug));
}

// The user rated a completed pick.
export async function ratePick(slug: string, rating: Rating): Promise<DailyRecs> {
  const settings = await loadSettings();
  const recs = await loadToday(todayFor(settings));
  if (!recs?.picks.some((p) => p.slug === slug)) throw new Error('That problem isn\'t one of today\'s picks.');
  if (recs.ratings[slug]) throw new Error('Already rated.');
  await rateReview(slug, rating);
  const ratings = { ...recs.ratings, [slug]: rating };
  const { error } = await supabase.from('daily_recs').update({ ratings }).eq('date', recs.date);
  if (error) throw error;
  return (await cache({ ...recs, ratings }))!;
}
