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

// The user's time zone setting, so the popup and banner agree with the background on what "today" is.
export const timeZoneCache = storage.defineItem<string | null>('local:timeZone', { fallback: null });

// Whether to hide a pick's topic until it's solved, for the same readers as above.
export const hideTopicsCache = storage.defineItem<boolean>('local:hideTopics', { fallback: true });

export function remaining(recs: DailyRecs | null): number {
  return recs ? recs.picks.filter((p) => !recs.completed.includes(p.slug)).length : 0;
}

// Whether to hide hints, topic tags and discussion on leetcode.com until a problem is accepted today.
export const blockSpoilersCache = storage.defineItem<boolean>('local:blockSpoilers', { fallback: false });

// Problems accepted on leetcode.com today (in the user's time zone), which unlocks them.
export interface SpoilerUnlocks {
  date: string;
  slugs: string[];
}
export const spoilerUnlocksCache = storage.defineItem<SpoilerUnlocks | null>('local:spoilerUnlocks', { fallback: null });
