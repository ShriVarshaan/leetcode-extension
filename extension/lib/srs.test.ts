import { describe, expect, it } from 'vitest';
import { MAX_EASE, MAX_INTERVAL_DAYS, MIN_EASE, planAutoReviews, review, type TopicState } from './srs';
import { localDay } from './time';

const DAY_MS = 86_400_000;
const NOW = new Date('2026-10-19T12:00:00Z');

const fresh: TopicState = { ease: 2.5, intervalDays: 0, reps: 0, dueAt: NOW.toISOString(), lastReviewedAt: null };

function after(state: TopicState, days: number) {
  return new Date(Date.parse(state.lastReviewedAt ?? NOW.toISOString()) + days * DAY_MS);
}

describe('review', () => {
  it('schedules a first Good review 3 days out', () => {
    const s = review(fresh, 3, NOW);
    expect(s.intervalDays).toBe(3);
    expect(s.reps).toBe(1);
    expect(s.ease).toBe(2.5);
    expect(s.dueAt).toBe(new Date(NOW.getTime() + 3 * DAY_MS).toISOString());
    expect(s.lastReviewedAt).toBe(NOW.toISOString());
  });

  it('grows the interval by ease on repeated Good reviews', () => {
    let s = review(fresh, 3, NOW);
    s = review(s, 3, after(s, 3));
    expect(s.intervalDays).toBeCloseTo(7.5);
    s = review(s, 3, after(s, 7.5));
    expect(s.intervalDays).toBeCloseTo(18.75);
    expect(s.reps).toBe(3);
  });

  it('Hard grows the interval by 1.2 and lowers ease', () => {
    const s = review({ ...fresh, reps: 2, intervalDays: 10 }, 2, NOW);
    expect(s.intervalDays).toBeCloseTo(12);
    expect(s.ease).toBeCloseTo(2.35);
    expect(s.reps).toBe(3);
  });

  it('Easy multiplies by ease and 1.3 and raises ease', () => {
    const s = review({ ...fresh, reps: 2, intervalDays: 10 }, 4, NOW);
    expect(s.intervalDays).toBeCloseTo(32.5);
    expect(s.ease).toBeCloseTo(2.65);
  });

  it('gives first Hard and Easy reviews a usable interval', () => {
    expect(review(fresh, 2, NOW).intervalDays).toBe(1);
    expect(review(fresh, 4, NOW).intervalDays).toBeCloseTo(3.9);
  });

  it('Again resets reps and the interval and lowers ease', () => {
    const s = review({ ...fresh, reps: 4, intervalDays: 40 }, 1, NOW);
    expect(s.reps).toBe(0);
    expect(s.intervalDays).toBe(1);
    expect(s.ease).toBeCloseTo(2.3);
    // The next Good review starts over from 3 days.
    expect(review(s, 3, after(s, 1)).intervalDays).toBe(3);
  });

  it('clamps ease to [1.3, 3.0]', () => {
    let low = fresh;
    for (let i = 0; i < 20; i++) low = review(low, 1, NOW);
    expect(low.ease).toBe(MIN_EASE);

    let high = fresh;
    for (let i = 0; i < 20; i++) high = review(high, 4, NOW);
    expect(high.ease).toBe(MAX_EASE);
  });

  it('caps the interval', () => {
    const s = review({ ...fresh, reps: 5, intervalDays: 150, ease: 3 }, 4, NOW);
    expect(s.intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it('does not mutate the input state', () => {
    const input = { ...fresh };
    review(input, 1, NOW);
    expect(input).toEqual(fresh);
  });
});

describe('planAutoReviews', () => {
  const states = new Map<string, TopicState>([
    ['Trees', fresh],
    ['Graphs', { ...fresh, reps: 1, intervalDays: 3, lastReviewedAt: '2026-10-19T08:00:00Z' }],
  ]);

  it('creates one Good review per topic per day', () => {
    const plan = planAutoReviews(
      states,
      [
        { slug: 'invert-binary-tree', topic: 'Trees', solvedAt: '2026-10-20T09:00:00Z' },
        { slug: 'same-tree', topic: 'Trees', solvedAt: '2026-10-20T15:00:00Z' },
      ],
      'UTC',
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]!).toMatchObject({ topic: 'Trees', slug: 'invert-binary-tree', rating: 3, prevReviewedAt: null });
    expect(plan[0]!.reviewedAt).toBe('2026-10-20T09:00:00.000Z');
  });

  it('chains reviews of the same topic on different days', () => {
    const plan = planAutoReviews(
      states,
      [
        { slug: 'same-tree', topic: 'Trees', solvedAt: '2026-10-21T10:00:00Z' },
        { slug: 'invert-binary-tree', topic: 'Trees', solvedAt: '2026-10-20T10:00:00Z' },
      ],
      'UTC',
    );
    expect(plan.map((p) => p.slug)).toEqual(['invert-binary-tree', 'same-tree']);
    expect(plan[1]!.prevReviewedAt).toBe(plan[0]!.reviewedAt);
    expect(plan[1]!.next.reps).toBe(2);
    expect(plan[1]!.next.intervalDays).toBeCloseTo(7.5);
  });

  it('skips a solve on the same day as the last review', () => {
    const plan = planAutoReviews(
      states,
      [{ slug: 'clone-graph', topic: 'Graphs', solvedAt: '2026-10-19T20:00:00Z' }],
      'UTC',
    );
    expect(plan).toEqual([]);
  });

  it('skips a solve older than the last review', () => {
    const plan = planAutoReviews(
      states,
      [{ slug: 'clone-graph', topic: 'Graphs', solvedAt: '2026-10-17T20:00:00Z' }],
      'UTC',
    );
    expect(plan).toEqual([]);
  });

  it('uses the user\'s time zone to decide what "today" is', () => {
    // 08:00Z and 03:00Z the next day are different days in UTC, but the same day in New York.
    const solve = { slug: 'clone-graph', topic: 'Graphs', solvedAt: '2026-10-20T03:00:00Z' };
    expect(planAutoReviews(states, [solve], 'UTC')).toHaveLength(1);
    expect(planAutoReviews(states, [solve], 'America/New_York')).toHaveLength(0);
  });

  it('reviews different topics independently and ignores unknown topics', () => {
    const plan = planAutoReviews(
      states,
      [
        { slug: 'invert-binary-tree', topic: 'Trees', solvedAt: '2026-10-20T09:00:00Z' },
        { slug: 'clone-graph', topic: 'Graphs', solvedAt: '2026-10-20T09:30:00Z' },
        { slug: 'implement-trie-prefix-tree', topic: 'Tries', solvedAt: '2026-10-20T10:00:00Z' },
      ],
      'UTC',
    );
    expect(plan.map((p) => p.topic)).toEqual(['Trees', 'Graphs']);
  });
});

describe('localDay', () => {
  it('formats the local calendar date', () => {
    expect(localDay('2026-10-20T03:00:00Z', 'UTC')).toBe('2026-10-20');
    expect(localDay('2026-10-20T03:00:00Z', 'America/New_York')).toBe('2026-10-19');
    expect(localDay('2026-10-19T20:00:00Z', 'Asia/Kolkata')).toBe('2026-10-20');
  });
});
