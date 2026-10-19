// Time-zone helpers built on Intl, so no date library is needed. Pure functions.

const DAY_MS = 86_400_000;

// 'YYYY-MM-DD' of an instant in the given IANA time zone.
export function localDay(at: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(at),
  );
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

// How far ahead of UTC the zone's wall clock is at `at`, in ms.
function offsetMs(at: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(new Date(at))
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!);
  return asUtc - Math.floor(at / 1000) * 1000;
}

// The instant when the wall clock in `timeZone` reads `time` ('HH:MM' or 'HH:MM:SS') on `day`.
export function zonedTime(day: string, time: string, timeZone: string): Date {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const wall = Date.parse(`${day}T00:00:00Z`) + (h * 60 + m) * 60_000;
  // Two passes, because the offset at the guessed instant can differ across a DST change.
  let utc = wall - offsetMs(wall, timeZone);
  utc = wall - offsetMs(utc, timeZone);
  return new Date(utc);
}

// The next instant strictly after `now` when the local clock reads `time`.
export function nextOccurrence(now: Date, time: string, timeZone: string): Date {
  const today = localDay(now, timeZone);
  for (let i = 0; i < 3; i++) {
    const at = zonedTime(addDays(today, i), time, timeZone);
    if (at.getTime() > now.getTime()) return at;
  }
  throw new Error('unreachable');
}

// Consecutive days with activity, ending today (or yesterday, if today has none yet).
export function streak(activeDays: ReadonlySet<string>, today: string): number {
  let day = activeDays.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (activeDays.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}
