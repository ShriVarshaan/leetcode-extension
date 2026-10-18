import { supabase } from './supabase';

export interface TopicSummary {
  topic: string;
  solved: number;
  dueAt: string;
}

// Topics the user has solved problems in, with counts and next review date, soonest first.
export async function loadTopicSummary(): Promise<TopicSummary[]> {
  const [solves, states] = await Promise.all([
    supabase.from('user_solves').select('problems(topic)'),
    supabase.from('user_topic_state').select('topic, due_at').order('due_at'),
  ]);
  if (solves.error) throw solves.error;
  if (states.error) throw states.error;

  const counts = new Map<string, number>();
  for (const row of solves.data as unknown as { problems: { topic: string } | null }[]) {
    const topic = row.problems?.topic;
    if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return states.data.map((s) => ({ topic: s.topic, solved: counts.get(s.topic) ?? 0, dueAt: s.due_at }));
}
