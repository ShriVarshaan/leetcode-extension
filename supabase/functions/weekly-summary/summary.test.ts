import { describe, expect, it } from 'vitest';
import { buildSummary, isSendTime, renderEmail, weekStart } from './summary';

// Sunday 2026-10-25, 18:30 in London (GMT after the clocks go back that morning).
const NOW = new Date('2026-10-25T18:30:00Z');
const TZ = 'Europe/London';

describe('schedule', () => {
  it('sends only on Sunday between 18:00 and 18:59 local time', () => {
    expect(isSendTime(NOW, TZ)).toBe(true);
    expect(isSendTime(new Date('2026-10-25T19:05:00Z'), TZ)).toBe(false);
    expect(isSendTime(new Date('2026-10-24T18:30:00Z'), TZ)).toBe(false);
    // 18:30 UTC Sunday is 00:00 Monday in Kolkata.
    expect(isSendTime(NOW, 'Asia/Kolkata')).toBe(false);
  });

  it('starts the week on Monday', () => {
    expect(weekStart(NOW, TZ)).toBe('2026-10-19');
    expect(weekStart(new Date('2026-10-19T08:00:00Z'), TZ)).toBe('2026-10-19');
  });
});

describe('buildSummary', () => {
  const summary = buildSummary({
    now: NOW,
    timeZone: TZ,
    solves: [
      { slug: 'a', topic: 'Trees', first_solved_at: '2026-10-20T10:00:00Z', last_solved_at: '2026-10-20T10:00:00Z' },
      { slug: 'b', topic: 'Trees', first_solved_at: '2026-01-01T10:00:00Z', last_solved_at: '2026-10-24T10:00:00Z' },
      { slug: 'c', topic: 'Graphs', first_solved_at: '2026-01-01T10:00:00Z', last_solved_at: '2026-10-18T10:00:00Z' },
    ],
    reviews: [
      { topic: 'Trees', rating: 3, reviewed_at: '2026-10-24T10:00:00Z' },
      { topic: 'Trees', rating: 1, reviewed_at: '2026-10-25T10:00:00Z' },
      { topic: 'Graphs', rating: 3, reviewed_at: '2026-10-23T10:00:00Z' },
      { topic: 'Graphs', rating: 4, reviewed_at: '2026-10-10T10:00:00Z' }, // last week
    ],
    topics: [
      { topic: 'Trees', ease: 2.3, due_at: '2026-10-26T18:30:00Z' },
      { topic: 'Graphs', ease: 2.5, due_at: '2026-10-20T00:00:00Z' },
      { topic: 'Stack', ease: 1.9, due_at: '2026-11-20T00:00:00Z' },
    ],
    completedDays: ['2026-10-20', '2026-10-23', '2026-10-24', '2026-10-25'],
    lists: [{ name: 'Blind 75', total: 75, solved: 54 }],
  });

  it('separates new solves from re-solves this week', () => {
    expect(summary.newSolves).toBe(1);
    expect(summary.reSolves).toBe(1);
  });

  it('counts this week\'s reviews by topic and rating', () => {
    expect(summary.reviewsByTopic).toEqual([
      { topic: 'Graphs', counts: { Good: 1 } },
      { topic: 'Trees', counts: { Good: 1, Again: 1 } },
    ]);
  });

  it('computes the streak, due, overdue and weakest topics', () => {
    expect(summary.streak).toBe(3); // 23rd, 24th, 25th: days with a completed pick, not just solves
    expect(summary.dueNextWeek).toEqual(['Trees']);
    expect(summary.mostOverdue).toEqual([{ topic: 'Graphs', days: 5 }]);
    expect(summary.weakest.map((w) => w.topic)).toEqual(['Stack', 'Trees', 'Graphs']);
  });

  it('ignores LeetCode activity that is not a completed pick when counting the streak', () => {
    const s = buildSummary({
      now: NOW,
      timeZone: TZ,
      solves: [
        { slug: 'a', topic: 'Trees', first_solved_at: '2026-10-23T10:00:00Z', last_solved_at: '2026-10-23T10:00:00Z' },
        { slug: 'b', topic: 'Trees', first_solved_at: '2026-10-24T10:00:00Z', last_solved_at: '2026-10-24T10:00:00Z' },
        { slug: 'c', topic: 'Trees', first_solved_at: '2026-10-25T10:00:00Z', last_solved_at: '2026-10-25T10:00:00Z' },
      ],
      reviews: [{ topic: 'Trees', rating: 3, reviewed_at: '2026-10-25T10:00:00Z' }],
      topics: [],
      completedDays: [],
      lists: [],
    });
    expect(s.streak).toBe(0);
  });

  it('renders text and escaped HTML', () => {
    const email = renderEmail({ ...summary, dueNextWeek: ['Heap <b>'] });
    expect(email.subject).toBe('Your LeetCode week: 2 solved, 3-day streak');
    expect(email.text).toContain('Blind 75: 54/75');
    expect(email.html).toContain('Heap &#60;b&#62;');
    expect(email.html).not.toContain('Heap <b>');
  });
});
