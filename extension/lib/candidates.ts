// Deterministic daily picks. Pure functions: every input, including the time, is passed in.
import type { Rating, TopicState } from './srs';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type PickKind = 'overdue' | 'top' | 'topup';

export interface TopicInput {
  topic: string;
  state: TopicState;
  weight: number;
  lastRating: Rating | null;
  // Difficulty of the problem behind the topic's last review, used to step difficulty up or down.
  lastDifficulty: Difficulty | null;
}

export interface CatalogProblem {
  slug: string;
  title: string;
  difficulty: Difficulty;
  topic: string;
  isPaid: boolean;
  lists: string[];
  position: number; // lowest position across its lists
}

export interface PickInput {
  now: Date;
  topics: TopicInput[];
  problems: CatalogProblem[];
  lists: string[];
  includePaid: boolean;
  solvedAt: ReadonlyMap<string, string>; // slug -> last solved (ISO)
  recentlyRecommended: ReadonlySet<string>; // slugs picked in the last 7 days
  exclude?: ReadonlySet<string>; // slugs that must not be picked (e.g. "pick again")
  excludeTopics?: ReadonlySet<string>;
  count?: number;
}

export interface DailyPick {
  slug: string;
  topic: string;
  title: string;
  difficulty: Difficulty;
  kind: PickKind;
  reason: string;
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const LEVELS: Difficulty[] = ['Easy', 'Medium', 'Hard'];

export function isDue(state: TopicState, now: Date): boolean {
  return Date.parse(state.dueAt) <= now.getTime();
}

export function daysOverdue(state: TopicState, now: Date): number {
  return Math.max(0, (now.getTime() - Date.parse(state.dueAt)) / DAY_MS);
}

export function scoreTopic(t: TopicInput, solvesThisWeek: number, now: Date): number {
  const aging = 1 + daysOverdue(t.state, now) / Math.max(1, t.state.intervalDays);
  const practised = Math.max(0.3, 0.7 ** solvesThisWeek);
  const struggling = t.lastRating !== null && t.lastRating <= 2 ? 1.5 : 1;
  return t.weight * aging * practised * struggling;
}

export function solvesThisWeekByTopic(input: Pick<PickInput, 'now' | 'problems' | 'solvedAt'>): Map<string, number> {
  const topicOf = new Map(input.problems.map((p) => [p.slug, p.topic]));
  const counts = new Map<string, number>();
  for (const [slug, at] of input.solvedAt) {
    const topic = topicOf.get(slug);
    if (topic && input.now.getTime() - Date.parse(at) < WEEK_MS) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return counts;
}

// One slot goes to the most overdue due topic, the rest to the highest-scoring due topics,
// one problem per topic. With too few due topics, the lowest-ease topics fill the gap.
export function pickDaily(input: PickInput): DailyPick[] {
  const count = input.count ?? 3;
  const weekly = solvesThisWeekByTopic(input);
  const topics = input.topics.filter((t) => !input.excludeTopics?.has(t.topic));

  const due = topics
    .filter((t) => isDue(t.state, input.now))
    .map((t) => ({ t, score: scoreTopic(t, weekly.get(t.topic) ?? 0, input.now), overdue: daysOverdue(t.state, input.now) }))
    .sort((a, b) => b.score - a.score || a.t.topic.localeCompare(b.t.topic));
  const reserved = [...due].sort((a, b) => b.overdue - a.overdue || b.score - a.score)[0];
  const notDue = topics
    .filter((t) => !isDue(t.state, input.now))
    .sort((a, b) => a.state.ease - b.state.ease || Date.parse(a.state.dueAt) - Date.parse(b.state.dueAt) || a.topic.localeCompare(b.topic));

  const order: { t: TopicInput; kind: PickKind }[] = [
    ...(reserved ? [{ t: reserved.t, kind: 'overdue' as const }] : []),
    ...due.filter((d) => d !== reserved).map((d) => ({ t: d.t, kind: 'top' as const })),
    ...notDue.map((t) => ({ t, kind: 'topup' as const })),
  ];

  const picks: DailyPick[] = [];
  for (const { t, kind } of order) {
    if (picks.length >= count) break;
    const problem = chooseProblem(t, input);
    if (!problem) continue;
    picks.push({
      slug: problem.slug,
      topic: t.topic,
      title: problem.title,
      difficulty: problem.difficulty,
      kind,
      reason: reasonFor(t, kind, problem, input),
    });
  }
  return picks;
}

export function targetDifficulty(t: TopicInput): Difficulty {
  const base = LEVELS.indexOf(t.lastDifficulty ?? 'Medium');
  const step = t.lastRating === null ? 0 : t.lastRating >= 3 ? 1 : -1;
  return LEVELS[Math.min(2, Math.max(0, base + step))]!;
}

// Prefers an unsolved problem near the target difficulty, otherwise the problem solved longest ago.
export function chooseProblem(t: TopicInput, input: PickInput): CatalogProblem | null {
  const now = input.now.getTime();
  const pool = input.problems.filter((p) => {
    if (p.topic !== t.topic) return false;
    if (!p.lists.some((l) => input.lists.includes(l))) return false;
    if (p.isPaid && !input.includePaid) return false;
    if (input.recentlyRecommended.has(p.slug) || input.exclude?.has(p.slug)) return false;
    const solved = input.solvedAt.get(p.slug);
    return !solved || now - Date.parse(solved) >= WEEK_MS;
  });

  const target = LEVELS.indexOf(targetDifficulty(t));
  const unsolved = pool
    .filter((p) => !input.solvedAt.has(p.slug))
    .sort(
      (a, b) =>
        Math.abs(LEVELS.indexOf(a.difficulty) - target) - Math.abs(LEVELS.indexOf(b.difficulty) - target) ||
        a.position - b.position ||
        a.slug.localeCompare(b.slug),
    );
  if (unsolved[0]) return unsolved[0];

  const solved = pool
    .filter((p) => input.solvedAt.has(p.slug))
    .sort((a, b) => Date.parse(input.solvedAt.get(a.slug)!) - Date.parse(input.solvedAt.get(b.slug)!) || a.slug.localeCompare(b.slug));
  return solved[0] ?? null;
}

export function reasonFor(t: TopicInput, kind: PickKind, problem: CatalogProblem, input: PickInput): string {
  const parts = [t.topic];
  if (kind === 'topup') {
    parts.push(`extra practice (ease ${t.state.ease.toFixed(1)})`);
  } else {
    const overdue = Math.floor(daysOverdue(t.state, input.now));
    parts.push(overdue < 1 ? 'due today' : `${overdue} ${overdue === 1 ? 'day' : 'days'} overdue`);
  }
  if (t.lastRating !== null && t.lastRating <= 2) parts.push('tough last time');
  const solved = input.solvedAt.get(problem.slug);
  if (solved) {
    const days = Math.floor((input.now.getTime() - Date.parse(solved)) / DAY_MS);
    parts.push(`last solved ${days} days ago`);
  } else {
    parts.push('new problem');
  }
  return parts.join(' · ');
}
