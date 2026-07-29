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
