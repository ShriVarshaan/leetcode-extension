import { remaining, type DailyRecs } from './today-cache';

// Number of today's picks left on the toolbar icon; a tick when they're all done.
export async function updateBadge(recs: DailyRecs | null, today: string | null) {
  const current = recs && recs.date === today ? recs : null;
  const left = remaining(current);
  const text = !current ? '' : left > 0 ? String(left) : '✓';
  await browser.action.setBadgeText({ text });
  await browser.action.setBadgeBackgroundColor({ color: left > 0 ? '#f59e0b' : '#16a34a' });
}
