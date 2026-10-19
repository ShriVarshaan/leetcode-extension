import { planAutoReviews, review, type NewSolve, type PlannedReview, type Rating, type TopicState } from './srs';
import { supabase } from './supabase';

async function loadTopicStates(topics: string[]): Promise<Map<string, TopicState>> {
  const { data, error } = await supabase
    .from('user_topic_state')
    .select('topic, ease, interval_days, reps, due_at, last_reviewed_at')
    .in('topic', topics);
  if (error) throw error;
  return new Map(
    data.map((r) => [
      r.topic,
      {
        ease: r.ease,
        intervalDays: r.interval_days,
        reps: r.reps,
        dueAt: r.due_at,
        lastReviewedAt: r.last_reviewed_at,
      },
    ]),
  );
}

async function applyReview(r: PlannedReview, source: 'rated' | 'auto'): Promise<void> {
  const { error } = await supabase.rpc('apply_review', {
    p_topic: r.topic,
    p_slug: r.slug,
    p_rating: r.rating,
    p_source: source,
    p_reviewed_at: r.reviewedAt,
    p_prev_reviewed_at: r.prevReviewedAt,
    p_ease: r.next.ease,
    p_interval_days: r.next.intervalDays,
    p_reps: r.next.reps,
    p_due_at: r.next.dueAt,
  });
  if (error) throw error;
}

// The user rated how a review of `slug` went.
export async function rateReview(slug: string, rating: Rating): Promise<TopicState> {
  const { data: problem, error } = await supabase.from('problems').select('topic').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!problem) throw new Error(`Unknown problem: ${slug}`);

  const state = (await loadTopicStates([problem.topic])).get(problem.topic);
  if (!state) throw new Error(`No review schedule for ${problem.topic}. Solve a problem in it first.`);

  const next = review(state, rating, new Date());
  await applyReview(
    { topic: problem.topic, slug, rating, reviewedAt: next.lastReviewedAt!, prevReviewedAt: state.lastReviewedAt, next },
    'rated',
  );
  return next;
}

// Solves made outside recommendations count as automatic Good reviews. Returns how many were applied.
export async function recordAutoReviews(solves: NewSolve[], timeZone: string): Promise<number> {
  if (solves.length === 0) return 0;
  const states = await loadTopicStates([...new Set(solves.map((s) => s.topic))]);
  const planned = planAutoReviews(states, solves, timeZone);
  // In order: each review's prevReviewedAt is the one before it.
  for (const r of planned) await applyReview(r, 'auto');
  return planned.length;
}
