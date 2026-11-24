import { describe, expect, it } from 'vitest';
import { addUnlock, isLocked } from './spoilers';
import type { DailyRecs } from './today-cache';

const today = '2026-11-24';
const base = { enabled: true, slug: 'two-sum', today, unlocks: null, recs: null };

describe('isLocked', () => {
  it('locks only when enabled and on a problem page', () => {
    expect(isLocked(base)).toBe(true);
    expect(isLocked({ ...base, enabled: false })).toBe(false);
    expect(isLocked({ ...base, slug: null })).toBe(false);
  });

  it('unlocks a problem accepted today, but not one accepted yesterday', () => {
    expect(isLocked({ ...base, unlocks: { date: today, slugs: ['two-sum'] } })).toBe(false);
    expect(isLocked({ ...base, unlocks: { date: '2026-11-23', slugs: ['two-sum'] } })).toBe(true);
    expect(isLocked({ ...base, unlocks: { date: today, slugs: ['3sum'] } })).toBe(true);
  });

  it("unlocks today's picks that are already completed", () => {
    const recs: DailyRecs = { date: today, picks: [], completed: ['two-sum'], ratings: {} };
    expect(isLocked({ ...base, recs })).toBe(false);
    expect(isLocked({ ...base, recs: { ...recs, date: '2026-11-23' } })).toBe(true);
  });
});

describe('addUnlock', () => {
  it('adds to today and drops older days', () => {
    expect(addUnlock(null, 'a', today)).toEqual({ date: today, slugs: ['a'] });
    expect(addUnlock({ date: today, slugs: ['a'] }, 'b', today)).toEqual({ date: today, slugs: ['a', 'b'] });
    expect(addUnlock({ date: today, slugs: ['a'] }, 'a', today)).toEqual({ date: today, slugs: ['a'] });
    expect(addUnlock({ date: '2026-11-23', slugs: ['a'] }, 'b', today)).toEqual({ date: today, slugs: ['b'] });
  });
});
