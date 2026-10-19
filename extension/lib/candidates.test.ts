import { describe, expect, it } from 'vitest';
import {
  chooseProblem,
  isDue,
  pickDaily,
  scoreTopic,
  targetDifficulty,
  type CatalogProblem,
  type Difficulty,
  type PickInput,
  type TopicInput,
} from './candidates';
import { review, type Rating, type TopicState } from './srs';

const DAY_MS = 86_400_000;
const NOW = new Date('2026-10-19T09:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS).toISOString();

function state(dueDaysAgo: number, patch: Partial<TopicState> = {}): TopicState {
  return { ease: 2.5, intervalDays: 3, reps: 1, dueAt: daysAgo(dueDaysAgo), lastReviewedAt: null, ...patch };
}

function topic(name: string, weight: number, dueDaysAgo: number, patch: Partial<TopicInput> = {}): TopicInput {
  return { topic: name, state: state(dueDaysAgo), weight, lastRating: null, lastDifficulty: null, ...patch };
}

let position = 0;
function problem(slug: string, topicName: string, difficulty: Difficulty = 'Medium', patch: Partial<CatalogProblem> = {}): CatalogProblem {
  return { slug, title: slug, difficulty, topic: topicName, isPaid: false, lists: ['blind75'], position: position++, ...patch };
}

function input(patch: Partial<PickInput>): PickInput {
  return {
    now: NOW,
    topics: [],
    problems: [],
    lists: ['blind75', 'neetcode150'],
    includePaid: false,
    solvedAt: new Map(),
    recentlyRecommended: new Set(),
    ...patch,
  };
}

// Three problems of each difficulty per topic.
function catalogFor(names: string[]): CatalogProblem[] {
  return names.flatMap((n) =>
    (['Easy', 'Medium', 'Hard'] as const).flatMap((d) => [1, 2, 3].map((i) => problem(`${n}-${d}-${i}`, n, d))),
  );
}

describe('scoreTopic', () => {
  it('multiplies weight by aging, weekly practice and struggling factors', () => {
    const t = topic('Trees', 1.8, 3); // 3 days overdue on a 3-day interval -> aging 2
    expect(scoreTopic(t, 0, NOW)).toBeCloseTo(3.6);
    expect(scoreTopic(t, 1, NOW)).toBeCloseTo(3.6 * 0.7);
    expect(scoreTopic(t, 10, NOW)).toBeCloseTo(3.6 * 0.3); // floor at 0.3
    expect(scoreTopic({ ...t, lastRating: 2 }, 0, NOW)).toBeCloseTo(5.4);
    expect(scoreTopic({ ...t, lastRating: 3 }, 0, NOW)).toBeCloseTo(3.6);
  });

  it('treats a zero interval as one day', () => {
    const t = topic('Trees', 1, 2, { state: state(2, { intervalDays: 0 }) });
    expect(scoreTopic(t, 0, NOW)).toBeCloseTo(3);
  });
});

describe('pickDaily', () => {
  it('only scores due topics and reserves one slot for the most overdue', () => {
    const topics = [
      topic('Trees', 1.8, 1),
      topic('Graphs', 1.56, 1),
      topic('Linked List', 1.32, 1),
      topic('Tries', 0.5, 6), // low weight, but the most overdue
      topic('Stack', 2, -2), // not due
    ];
    const picks = pickDaily(input({ topics, problems: catalogFor(topics.map((t) => t.topic)) }));
    expect(picks.map((p) => [p.topic, p.kind])).toEqual([
      ['Tries', 'overdue'],
      ['Trees', 'top'],
      ['Graphs', 'top'],
    ]);
  });

  it('lowers a topic practised this week', () => {
    const topics = [topic('Trees', 1.8, 1), topic('Graphs', 1.56, 1), topic('Stack', 1.0, 1), topic('Tries', 0.5, 5)];
    const problems = catalogFor(topics.map((t) => t.topic));
    const solvedAt = new Map([
      ['Trees-Easy-1', daysAgo(1)],
      ['Trees-Easy-2', daysAgo(2)],
      ['Trees-Easy-3', daysAgo(3)],
    ]);
    const picks = pickDaily(input({ topics, problems, solvedAt }));
    expect(picks.map((p) => p.topic)).toEqual(['Tries', 'Graphs', 'Stack']);
  });

  it('tops up with the lowest-ease topics when fewer than 3 are due', () => {
    const topics = [
      topic('Trees', 1.8, 1),
      topic('Graphs', 1.56, -3, { state: state(-3, { ease: 2.5 }) }),
      topic('Stack', 1, -3, { state: state(-3, { ease: 1.6 }) }),
      topic('Tries', 0.5, -1, { state: state(-1, { ease: 2.0 }) }),
    ];
    const picks = pickDaily(input({ topics, problems: catalogFor(topics.map((t) => t.topic)) }));
    expect(picks.map((p) => [p.topic, p.kind])).toEqual([
      ['Trees', 'overdue'],
      ['Stack', 'topup'],
      ['Tries', 'topup'],
    ]);
  });

  it('skips a topic with no eligible problem', () => {
    const topics = [topic('Trees', 1.8, 2), topic('Graphs', 1.56, 1), topic('Stack', 1, 1), topic('Tries', 0.5, 1)];
    const problems = catalogFor(['Graphs', 'Stack', 'Tries']);
    expect(pickDaily(input({ topics, problems })).map((p) => p.topic)).toEqual(['Graphs', 'Stack', 'Tries']);
  });

  it('respects excluded slugs and topics and a custom count', () => {
    const topics = [topic('Trees', 1.8, 2), topic('Graphs', 1.56, 1), topic('Stack', 1, 1)];
    const problems = catalogFor(topics.map((t) => t.topic));
    const picks = pickDaily(
      input({ topics, problems, excludeTopics: new Set(['Trees']), exclude: new Set(['Graphs-Medium-1']), count: 1 }),
    );
    expect(picks).toHaveLength(1);
    expect(picks[0]!.slug).toBe('Graphs-Medium-2');
  });

  it('is deterministic', () => {
    const topics = [topic('Trees', 1.8, 2), topic('Graphs', 1.56, 2), topic('Stack', 1, 2), topic('Tries', 0.5, 2)];
    const i = input({ topics, problems: catalogFor(topics.map((t) => t.topic)) });
    expect(pickDaily(i)).toEqual(pickDaily(i));
  });

  it('writes a template reason', () => {
    const topics = [topic('Trees', 1.8, 3, { lastRating: 2 })];
    const problems = [problem('invert-binary-tree', 'Trees', 'Easy')];
    const picks = pickDaily(input({ topics, problems, solvedAt: new Map([['invert-binary-tree', daysAgo(41)]]) }));
    expect(picks[0]!.reason).toBe('Trees · 3 days overdue · tough last time · last solved 41 days ago');
  });
});

describe('chooseProblem', () => {
  const t = topic('Trees', 1.8, 1);

  it('prefers unsolved problems near the target difficulty', () => {
    const problems = [problem('a', 'Trees', 'Easy'), problem('b', 'Trees', 'Medium'), problem('c', 'Trees', 'Hard')];
    expect(chooseProblem(t, input({ problems }))!.slug).toBe('b');
    expect(chooseProblem({ ...t, lastRating: 4, lastDifficulty: 'Medium' }, input({ problems }))!.slug).toBe('c');
    expect(chooseProblem({ ...t, lastRating: 1, lastDifficulty: 'Medium' }, input({ problems }))!.slug).toBe('a');
  });

  it('steps difficulty within bounds', () => {
    expect(targetDifficulty({ ...t, lastRating: 4, lastDifficulty: 'Hard' })).toBe('Hard');
    expect(targetDifficulty({ ...t, lastRating: 2, lastDifficulty: 'Easy' })).toBe('Easy');
    expect(targetDifficulty({ ...t, lastRating: 3, lastDifficulty: 'Easy' })).toBe('Medium');
  });

  it('falls back to the problem solved longest ago', () => {
    const problems = [problem('a', 'Trees'), problem('b', 'Trees'), problem('c', 'Trees')];
    const solvedAt = new Map([
      ['a', daysAgo(20)],
      ['b', daysAgo(60)],
      ['c', daysAgo(30)],
    ]);
    expect(chooseProblem(t, input({ problems, solvedAt }))!.slug).toBe('b');
  });

  it('skips problems solved this week, recently recommended, premium, other lists and other topics', () => {
    const problems = [
      problem('solved-recently', 'Trees'),
      problem('recommended', 'Trees'),
      problem('premium', 'Trees', 'Medium', { isPaid: true }),
      problem('other-list', 'Trees', 'Medium', { lists: ['striver_a2z'] }),
      problem('other-topic', 'Graphs'),
      problem('ok', 'Trees', 'Hard'),
    ];
    const i = input({
      problems,
      solvedAt: new Map([['solved-recently', daysAgo(2)]]),
      recentlyRecommended: new Set(['recommended']),
    });
    expect(chooseProblem(t, i)!.slug).toBe('ok');
    expect(chooseProblem(t, { ...i, problems: problems.slice(0, 5) })).toBeNull();
    expect(chooseProblem(t, { ...i, problems: problems.slice(0, 5), includePaid: true })!.slug).toBe('premium');
  });
});

// Real weights from the seed; every topic falls due on day 0 (the worst case), then the
// simulated user does all 3 picks every day.
const WEIGHTS: Record<string, number> = {
  Trees: 1.8,
  Graphs: 1.56,
  '1-D Dynamic Programming': 1.44,
  '2-D Dynamic Programming': 1.32,
  'Linked List': 1.32,
  Backtracking: 1.08,
  'Arrays & Hashing': 1.08,
  'Math & Geometry': 0.96,
  Greedy: 0.96,
  'Heap / Priority Queue': 0.84,
  'Binary Search': 0.84,
  'Bit Manipulation': 0.84,
  Stack: 0.84,
  'Sliding Window': 0.72,
  'Advanced Graphs': 0.72,
  Intervals: 0.72,
  'Two Pointers': 0.6,
  Tries: 0.5,
};

function simulate(days: number, rate: (topic: string) => Rating) {
  const start = NOW.getTime();
  const names = Object.keys(WEIGHTS);
  const states = new Map(names.map((n) => [n, state(0)]));
  const lastRating = new Map<string, Rating>();
  const problems = catalogFor(names);
  const solvedAt = new Map<string, string>();
  const history: { day: number; slugs: string[] }[] = [];
  const dueSince = new Map<string, number>(); // topic -> day it became due and hasn't been picked since
  const maxWait = new Map<string, number>(names.map((n) => [n, 0]));
  const pickedCount = new Map<string, number>(names.map((n) => [n, 0]));

  for (let day = 0; day < days; day++) {
    const now = new Date(start + day * DAY_MS);
    for (const [n, s] of states) if (isDue(s, now) && !dueSince.has(n)) dueSince.set(n, day);

    const picks = pickDaily({
      now,
      topics: names.map((n) => ({
        topic: n,
        state: states.get(n)!,
        weight: WEIGHTS[n]!,
        lastRating: lastRating.get(n) ?? null,
        lastDifficulty: null,
      })),
      problems,
      lists: ['blind75'],
      includePaid: false,
      solvedAt,
      recentlyRecommended: new Set(history.filter((h) => day - h.day < 7).flatMap((h) => h.slugs)),
    });
    history.push({ day, slugs: picks.map((p) => p.slug) });

    for (const p of picks) {
      const since = dueSince.get(p.topic);
      if (since !== undefined) maxWait.set(p.topic, Math.max(maxWait.get(p.topic)!, day - since));
      dueSince.delete(p.topic);
      pickedCount.set(p.topic, pickedCount.get(p.topic)! + 1);
      const rating = rate(p.topic);
      states.set(p.topic, review(states.get(p.topic)!, rating, now));
      lastRating.set(p.topic, rating);
      solvedAt.set(p.slug, now.toISOString());
    }
  }
  // Topics still waiting at the end count too.
  for (const [n, since] of dueSince) maxWait.set(n, Math.max(maxWait.get(n)!, days - since));
  return { maxWait, pickedCount };
}

describe('starvation simulation (90 days)', () => {
  const BOUND_DAYS = 7;

  it('picks every topic within a bounded wait when every review is Good', () => {
    const { maxWait, pickedCount } = simulate(90, () => 3);
    for (const [topicName, wait] of maxWait) {
      expect(wait, `${topicName} waited ${wait} days`).toBeLessThanOrEqual(BOUND_DAYS);
      expect(pickedCount.get(topicName), topicName).toBeGreaterThan(0);
    }
    expect(maxWait.get('Tries')).toBeLessThanOrEqual(BOUND_DAYS);
  });

  it('still reaches every topic when heavy topics keep failing', () => {
    // Trees and Graphs are rated Again every time, so they are due daily and score high.
    const { maxWait } = simulate(90, (t) => (t === 'Trees' || t === 'Graphs' ? 1 : 3));
    for (const [topicName, wait] of maxWait) {
      expect(wait, `${topicName} waited ${wait} days`).toBeLessThanOrEqual(BOUND_DAYS);
    }
  });
});
