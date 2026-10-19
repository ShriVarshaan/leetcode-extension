import { describe, expect, it } from 'vitest';
import { addDays, localDay, nextOccurrence, streak, zonedTime } from './time';

describe('zonedTime', () => {
  it('converts a local wall-clock time to an instant', () => {
    expect(zonedTime('2026-10-19', '09:00', 'Europe/London').toISOString()).toBe('2026-10-19T08:00:00.000Z'); // BST
    expect(zonedTime('2026-11-02', '09:00', 'Europe/London').toISOString()).toBe('2026-11-02T09:00:00.000Z'); // GMT
    expect(zonedTime('2026-10-19', '09:00:00', 'Asia/Kolkata').toISOString()).toBe('2026-10-19T03:30:00.000Z');
    expect(zonedTime('2026-10-19', '21:30', 'America/Los_Angeles').toISOString()).toBe('2026-10-20T04:30:00.000Z');
  });
});

describe('nextOccurrence', () => {
  it('returns today when the time is still ahead, otherwise tomorrow', () => {
    expect(nextOccurrence(new Date('2026-10-19T07:00:00Z'), '09:00', 'Europe/London').toISOString()).toBe(
      '2026-10-19T08:00:00.000Z',
    );
    expect(nextOccurrence(new Date('2026-10-19T08:00:00Z'), '09:00', 'Europe/London').toISOString()).toBe(
      '2026-10-20T08:00:00.000Z',
    );
  });

  it('handles the day DST ends', () => {
    // Clocks go back on 2026-10-25 in the UK.
    expect(nextOccurrence(new Date('2026-10-24T12:00:00Z'), '09:00', 'Europe/London').toISOString()).toBe(
      '2026-10-25T09:00:00.000Z',
    );
  });
});

describe('localDay / addDays', () => {
  it('works across month ends', () => {
    expect(localDay('2026-10-31T23:30:00Z', 'Europe/Berlin')).toBe('2026-11-01');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('streak', () => {
  it('counts consecutive days ending today or yesterday', () => {
    const days = new Set(['2026-10-17', '2026-10-18', '2026-10-19']);
    expect(streak(days, '2026-10-19')).toBe(3);
    expect(streak(days, '2026-10-20')).toBe(3); // today not done yet
    expect(streak(days, '2026-10-21')).toBe(0);
    expect(streak(new Set(), '2026-10-19')).toBe(0);
  });
});
