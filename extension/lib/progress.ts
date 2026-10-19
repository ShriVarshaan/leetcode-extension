import { loadTopics } from './daily';
import type { UserSettings } from './settings';
import { supabase } from './supabase';
import { addDays, localDay, streak } from './time';

export interface TopicSummary {
  topic: string;
  solved: number;
  dueAt: string;
  ease: number;
  intervalDays: number;
  reps: number;
  weight: number;
  baseWeight: number;
}

// Topics the user has solved problems in, with counts and schedule, soonest due first.
export async function loadTopicSummary(settings: UserSettings): Promise<TopicSummary[]> {
  const [solves, topics] = await Promise.all([supabase.from('user_solves').select('problems(topic)'), loadTopics(settings)]);
  if (solves.error) throw solves.error;

  const counts = new Map<string, number>();
  for (const row of solves.data as unknown as { problems: { topic: string } | null }[]) {
    const topic = row.problems?.topic;
    if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return topics
    .map((t) => ({
      topic: t.topic,
      solved: counts.get(t.topic) ?? 0,
      dueAt: t.state.dueAt,
      ease: t.state.ease,
      intervalDays: t.state.intervalDays,
      reps: t.state.reps,
      weight: t.weight,
      baseWeight: t.baseWeight,
    }))
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

// Days in a row on which at least one of that day's picks was completed. Other LeetCode
// activity doesn't count: the streak is about doing the revision.
export async function loadStreak(settings: UserSettings): Promise<number> {
  const today = localDay(new Date(), settings.timezone);
  const { data, error } = await supabase
    .from('daily_recs')
    .select('date, completed')
    .gte('date', addDays(today, -400));
  if (error) throw error;
  const days = new Set(data.filter((r) => r.completed.length > 0).map((r) => r.date as string));
  return streak(days, today);
}
