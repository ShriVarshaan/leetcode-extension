// Topic-level spaced repetition (SM-2 variant). Pure functions: no I/O, no clock reads.
import { localDay } from './time';

export type Rating = 1 | 2 | 3 | 4;

export const RATING_LABELS: Record<Rating, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };

export interface TopicState {
  ease: number;
  intervalDays: number;
  reps: number;
  dueAt: string;
  lastReviewedAt: string | null;
}

export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const MAX_INTERVAL_DAYS = 180;

const DAY_MS = 86_400_000;

export function review(state: TopicState, rating: Rating, now: Date): TopicState {
  let { ease, intervalDays: interval, reps } = state;
  // reps is 0 for a topic that has never been reviewed or was just failed, and its interval
  // can be 0, so the first successful review uses fixed starting intervals.
  const first = reps === 0;

  switch (rating) {
    case 1:
      interval = 1;
      reps = 0;
      ease -= 0.2;
      break;
    case 2:
      interval = first ? 1 : interval * 1.2;
      reps += 1;
      ease -= 0.15;
      break;
    case 3:
      interval = first ? 3 : interval * ease;
      reps += 1;
      break;
    case 4:
      interval = (first ? 3 : interval * ease) * 1.3;
      reps += 1;
      ease += 0.15;
      break;
  }

  ease = clamp(ease, MIN_EASE, MAX_EASE);
  interval = clamp(interval, 1, MAX_INTERVAL_DAYS);
  return {
    ease,
    intervalDays: interval,
    reps,
    dueAt: new Date(now.getTime() + interval * DAY_MS).toISOString(),
    lastReviewedAt: now.toISOString(),
  };
}

export interface NewSolve {
  slug: string;
  topic: string;
  solvedAt: string;
}

export interface PlannedReview {
  topic: string;
  slug: string;
  rating: Rating;
  reviewedAt: string;
  prevReviewedAt: string | null;
  next: TopicState;
}

// Turns solves made outside recommendations into automatic "Good" reviews: at most one per
// topic per local day, and never for a solve older than the topic's latest review.
// Reviews for the same topic are chained, so each one builds on the state left by the last.
export function planAutoReviews(
  states: ReadonlyMap<string, TopicState>,
  solves: NewSolve[],
  timeZone: string,
): PlannedReview[] {
  const current = new Map(states);
  const planned: PlannedReview[] = [];
  const sorted = [...solves].sort((a, b) => Date.parse(a.solvedAt) - Date.parse(b.solvedAt));

  for (const solve of sorted) {
    const state = current.get(solve.topic);
    if (!state) continue;
    const last = state.lastReviewedAt;
    if (last) {
      if (Date.parse(solve.solvedAt) <= Date.parse(last)) continue;
      if (localDay(solve.solvedAt, timeZone) === localDay(last, timeZone)) continue;
    }
    const next = review(state, 3, new Date(solve.solvedAt));
    planned.push({
      topic: solve.topic,
      slug: solve.slug,
      rating: 3,
      reviewedAt: next.lastReviewedAt!,
      prevReviewedAt: last,
      next,
    });
    current.set(solve.topic, next);
  }
  return planned;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
