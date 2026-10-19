// Builds the weekly summary from raw rows. Pure: no I/O, so it can be tested with Vitest.
// The date helpers mirror extension/lib/time.ts (Edge Functions are bundled on their own).

const DAY_MS = 86_400_000;
const RATING_LABELS = ['', 'Again', 'Hard', 'Good', 'Easy'] as const;

export function localDay(at: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(at),
  );
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

function weekday(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
}

// Sunday between 18:00 and 18:59 local time, when the hourly cron should send.
export function isSendTime(now: Date, timeZone: string): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now));
  return weekday(localDay(now, timeZone)) === 0 && hour === 18;
}

// Monday of the local week containing `now` (weeks run Monday to Sunday).
export function weekStart(now: Date, timeZone: string): string {
  const today = localDay(now, timeZone);
  return addDays(today, -((weekday(today) + 6) % 7));
}

export interface SummaryInput {
  now: Date;
  timeZone: string;
  solves: { slug: string; topic: string; first_solved_at: string; last_solved_at: string }[];
  reviews: { topic: string; rating: number; reviewed_at: string }[];
  topics: { topic: string; ease: number; due_at: string }[];
  // Local dates ('YYYY-MM-DD') on which at least one daily pick was completed.
  completedDays: string[];
  lists: { name: string; total: number; solved: number }[];
}

export interface Summary {
  weekStart: string;
  newSolves: number;
  reSolves: number;
  reviewsByTopic: { topic: string; counts: Record<string, number> }[];
  streak: number;
  dueNextWeek: string[];
  mostOverdue: { topic: string; days: number }[];
  weakest: { topic: string; ease: number }[];
  lists: SummaryInput['lists'];
}

export function buildSummary(input: SummaryInput): Summary {
  const { now, timeZone } = input;
  const start = weekStart(now, timeZone);
  const inWeek = (iso: string) => localDay(iso, timeZone) >= start;

  const newSolves = input.solves.filter((s) => inWeek(s.first_solved_at)).length;
  const reSolves = input.solves.filter((s) => inWeek(s.last_solved_at) && !inWeek(s.first_solved_at)).length;

  const byTopic = new Map<string, Record<string, number>>();
  for (const r of input.reviews.filter((r) => inWeek(r.reviewed_at))) {
    const counts = byTopic.get(r.topic) ?? {};
    const label = RATING_LABELS[r.rating] ?? String(r.rating);
    counts[label] = (counts[label] ?? 0) + 1;
    byTopic.set(r.topic, counts);
  }

  const active = new Set(input.completedDays);
  const today = localDay(now, timeZone);
  let day = active.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (active.has(day)) {
    streak++;
    day = addDays(day, -1);
  }

  const t = now.getTime();
  const dueNextWeek = input.topics
    .filter((x) => Date.parse(x.due_at) > t && Date.parse(x.due_at) <= t + 7 * DAY_MS)
    .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at))
    .map((x) => x.topic);
  const mostOverdue = input.topics
    .filter((x) => Date.parse(x.due_at) <= t)
    .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at))
    .slice(0, 3)
    .map((x) => ({ topic: x.topic, days: Math.floor((t - Date.parse(x.due_at)) / DAY_MS) }));
  const weakest = [...input.topics]
    .sort((a, b) => a.ease - b.ease || a.topic.localeCompare(b.topic))
    .slice(0, 3)
    .map((x) => ({ topic: x.topic, ease: x.ease }));

  return {
    weekStart: start,
    newSolves,
    reSolves,
    reviewsByTopic: [...byTopic].map(([topic, counts]) => ({ topic, counts })).sort((a, b) => a.topic.localeCompare(b.topic)),
    streak,
    dueNextWeek,
    mostOverdue,
    weakest,
    lists: input.lists,
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function renderEmail(s: Summary): { subject: string; text: string; html: string } {
  const total = s.newSolves + s.reSolves;
  const subject = `Your LeetCode week: ${total} solved, ${s.streak}-day streak`;
  const reviews = s.reviewsByTopic.map(
    (r) => `${r.topic}: ${Object.entries(r.counts).map(([k, v]) => `${v} ${k}`).join(', ')}`,
  );
  const sections: [string, string[]][] = [
    ['This week', [`${s.newSolves} new problems, ${s.reSolves} re-solves`, `Streak: ${s.streak} days`]],
    ['Reviews by topic', reviews.length ? reviews : ['No reviews this week']],
    ['Due next week', s.dueNextWeek.length ? [s.dueNextWeek.join(', ')] : ['Nothing scheduled']],
    ['Most overdue', s.mostOverdue.length ? s.mostOverdue.map((o) => `${o.topic} (${o.days} days)`) : ['None, all caught up']],
    ['Weakest topics', s.weakest.map((w) => `${w.topic} (ease ${w.ease.toFixed(2)})`)],
    ['List progress', s.lists.map((l) => `${l.name}: ${l.solved}/${l.total}`)],
  ];

  const text = [
    `Week of ${s.weekStart}`,
    ...sections.map(([title, lines]) => `\n${title}\n${lines.map((l) => `- ${l}`).join('\n')}`),
    '\nTurn this email off in the extension\'s settings.',
  ].join('\n');

  const html = `<!doctype html><html><body style="font:15px/1.5 system-ui,sans-serif;color:#1e293b;max-width:560px">
<h2 style="margin:0 0 4px">Your LeetCode week</h2>
<p style="margin:0;color:#64748b">Week of ${esc(s.weekStart)}</p>
${sections
  .map(
    ([title, lines]) =>
      `<h3 style="margin:20px 0 4px;font-size:15px">${esc(title)}</h3><ul style="margin:0;padding-left:20px">${lines
        .map((l) => `<li>${esc(l)}</li>`)
        .join('')}</ul>`,
  )
  .join('\n')}
<p style="margin-top:24px;color:#64748b;font-size:13px">Turn this email off in the extension's settings.</p>
</body></html>`;

  return { subject, text, html };
}
