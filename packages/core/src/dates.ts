/**
 * NBA calendar-date helpers. The NBA game date is the America/New_York
 * calendar date on which a game tipped off. All maths is done with Intl so
 * daylight-saving transitions are handled by the platform tz database.
 */
export const NBA_TZ = 'America/New_York';

function partsIn(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second };
}

/** 'YYYY-MM-DD' of `date` in the given zone. */
export function zonedDateString(date: Date, timeZone = NBA_TZ): string {
  const p = partsIn(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** The NBA game date the morning pipeline should process: "yesterday" in New York. */
export function previousGameDate(now: Date = new Date()): string {
  return addDays(zonedDateString(now, NBA_TZ), -1);
}

/** Offset (minutes) of the zone from UTC at a given instant. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const p = partsIn(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * Convert a wall-clock time in a zone to a UTC instant. For non-existent local
 * times (spring-forward gap) the result moves forward by the gap; for
 * ambiguous times (fall-back) the earlier instant is chosen.
 */
export function zonedTimeToUtc(isoDate: string, hhmm: string, timeZone = NBA_TZ): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const candidates = [-720, -60, 0, 60, 720]
    .map((delta) => naive - offsetMinutes(new Date(naive + delta * 60000), timeZone) * 60000)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b);
  for (const c of candidates) {
    const p = partsIn(new Date(c), timeZone);
    if (p.year === y && p.month === m && p.day === d && p.hour === hh && p.minute === mm) return new Date(c);
  }
  // Gap: local time does not exist; fall back to the standard-offset reading.
  return new Date(naive - offsetMinutes(new Date(naive - 12 * 3600000), timeZone) * 60000);
}

/** Next UTC instant at which the daily job should run (e.g. 08:00 New York). */
export function nextDailyRun(now: Date, hhmm = '08:00', timeZone = NBA_TZ): Date {
  const today = zonedDateString(now, timeZone);
  const candidate = zonedTimeToUtc(today, hhmm, timeZone);
  return candidate.getTime() > now.getTime() ? candidate : zonedTimeToUtc(addDays(today, 1), hhmm, timeZone);
}

/** Idempotency key for a daily pipeline run. */
export function dailyRunKey(brand: string, gameDate: string, workflow = 'daily'): string {
  return `${workflow}:${brand}:${gameDate}`;
}

/** Retry ladder after the daily run time, in minutes: 08:00, 08:30, 09:30, 11:00, 14:00 by default. */
export const RETRY_LADDER_MINUTES = [0, 30, 90, 180, 360] as const;

/**
 * Schedule slots that are due "now" for the game date being processed today.
 * Returns slot labels (HH:MM in the zone) whose time has passed; the caller
 * enqueues each at most once (idempotency key per slot) and stops once a run
 * completes with all games final.
 */
export function dueScheduleSlots(now: Date, runTime = '08:00', timeZone = NBA_TZ, ladder: readonly number[] = RETRY_LADDER_MINUTES): { gameDate: string; slots: string[] } {
  const today = zonedDateString(now, timeZone);
  const base = zonedTimeToUtc(today, runTime, timeZone).getTime();
  const slots = ladder
    .map((m) => new Date(base + m * 60_000))
    .filter((t) => t.getTime() <= now.getTime())
    .map((t) => {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t);
      return p;
    });
  return { gameDate: addDays(today, -1), slots };
}
