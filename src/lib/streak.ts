function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function countByDay(dates: Date[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const key = localDayKey(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Words added today (local time). */
export function countToday(dates: Date[], now = new Date()): number {
  return countByDay(dates).get(localDayKey(now)) ?? 0;
}

export interface DayEntry {
  /** Local midnight of the day. */
  date: Date;
  count: number;
  met: boolean;
  isToday: boolean;
}

/** The last `days` days (oldest first) with word counts and goal completion. */
export function dayHistory(
  dates: Date[],
  goal: number,
  days: number,
  now = new Date()
): DayEntry[] {
  const counts = countByDay(dates);
  const out: DayEntry[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const count = counts.get(localDayKey(d)) ?? 0;
    out.push({ date: d, count, met: goal > 0 && count >= goal, isToday: i === 0 });
  }
  return out;
}

/** Longest run of consecutive goal-met days, ever. */
export function bestStreak(dates: Date[], goal: number): number {
  if (goal <= 0) return 0;
  const metKeys = new Set<string>();
  const starts: Date[] = [];
  for (const [key, count] of countByDay(dates)) {
    if (count < goal) continue;
    metKeys.add(key);
    const [y, m, d] = key.split('-').map(Number);
    starts.push(new Date(y, m, d));
  }
  let best = 0;
  for (const start of starts) {
    const prev = new Date(start);
    prev.setDate(prev.getDate() - 1);
    if (metKeys.has(localDayKey(prev))) continue; // not the start of a run
    let len = 0;
    const cursor = new Date(start);
    while (metKeys.has(localDayKey(cursor))) {
      len++;
      cursor.setDate(cursor.getDate() + 1);
    }
    if (len > best) best = len;
  }
  return best;
}

/** Total days (ever) where the goal was met. */
export function countMetDays(dates: Date[], goal: number): number {
  if (goal <= 0) return 0;
  let n = 0;
  for (const c of countByDay(dates).values()) if (c >= goal) n++;
  return n;
}

/**
 * Consecutive days (ending today or yesterday) where at least `goal` words were added.
 * An unfinished today doesn't break the streak — it just doesn't count yet.
 */
export function computeStreak(dates: Date[], goal: number, now = new Date()): number {
  if (goal <= 0) return 0;
  const counts = countByDay(dates);
  const cursor = new Date(now);
  if ((counts.get(localDayKey(cursor)) ?? 0) < goal) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while ((counts.get(localDayKey(cursor)) ?? 0) >= goal) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
