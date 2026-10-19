import { storage } from 'wxt/utils/storage';
import type { DailyPick } from './candidates';
import type { Rating } from './srs';

export interface DailyRecs {
  date: string;
  picks: DailyPick[];
  completed: string[];
  ratings: Record<string, Rating | 'auto'>;
}

// Copy of today's row for the badge and the leetcode.com banner, which shouldn't hit Supabase.
// Kept apart from daily.ts so the content script doesn't bundle the Supabase client.
export const todayCache = storage.defineItem<DailyRecs | null>('local:todayRecs', { fallback: null });

export function remaining(recs: DailyRecs | null): number {
  return recs ? recs.picks.filter((p) => !recs.completed.includes(p.slug)).length : 0;
}
