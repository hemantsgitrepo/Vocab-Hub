// ---------------------------------------------------------------------------
// Forgiving streak engine.
//
// Whether a given day hit the goal is always DERIVED from word timestamps, so
// it can never drift out of sync with the collection. Everything that cannot
// be derived — freeze inventory, which days a freeze rescued, an open repair
// challenge, milestones already celebrated — lives in a small persisted state
// object that this module advances one day at a time.
//
// Every function here is pure: `now` is injected, nothing touches the DB.
// ---------------------------------------------------------------------------

/** Words added after midnight but before this hour still count for yesterday. */
export const GRACE_HOURS = 2;

/** A free streak freeze is granted for every N consecutive days. */
export const FREEZE_EVERY = 10;

/** Streaks shorter than this aren't worth interrupting the user to repair. */
export const MIN_REPAIRABLE = 3;

/** How long the user has to complete a repair challenge. */
export const REPAIR_WINDOW_HOURS = 48;

export const MILESTONES = [7, 14, 30, 50, 100];

/** Safety bound so a long-dormant install can't spin through years of days. */
const MAX_SETTLE_DAYS = 400;

// ----- day keys -------------------------------------------------------------

/** Sortable local day key, e.g. "2026-08-06". */
export function dayKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  out.setHours(0, 0, 0, 0);
  return out;
}

/**
 * The day a moment belongs to once the grace period is applied — 01:30 on the
 * 7th still counts toward the 6th. Used for both word attribution and "today",
 * so the two can never disagree.
 */
export function effectiveDay(now: Date = new Date()): Date {
  const d = new Date(now);
  if (d.getHours() < GRACE_HOURS) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Words added per effective day. */
export function countsByDay(dates: Date[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of dates) {
    const k = dayKey(effectiveDay(raw));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/** The instant a given day is judged — the end of its grace period. */
export function settlementInstant(dayK: string): number {
  const next = addDays(keyToDate(dayK), 1);
  next.setHours(GRACE_HOURS, 0, 0, 0);
  return next.getTime();
}

// ----- state ----------------------------------------------------------------

export interface RepairChallenge {
  /** The streak that was lost and can be won back. */
  brokenStreak: number;
  /** The day that was missed. */
  missedDay: string;
  /** Words needed in a single day to restore it. */
  target: number;
  /** Epoch ms after which the offer is gone. */
  expiresAt: number;
}

export interface StreakState {
  version: number;
  /** Settled through the END of this day; null before first settlement. */
  lastSettledDay: string | null;
  /** Streak as of the end of `lastSettledDay` — today is added for display. */
  currentStreak: number;
  longestStreak: number;
  freezes: number;
  /** Highest streak length a freeze has already been granted for. */
  freezeAwardedFor: number;
  /** Days a freeze rescued, newest last. */
  protectedDays: string[];
  repair: RepairChallenge | null;
  celebrated: number[];
}

export const STREAK_STATE_VERSION = 1;

export function initialState(): StreakState {
  return {
    version: STREAK_STATE_VERSION,
    lastSettledDay: null,
    currentStreak: 0,
    longestStreak: 0,
    freezes: 0,
    freezeAwardedFor: 0,
    protectedDays: [],
    repair: null,
    celebrated: [],
  };
}

/** Words needed to win a streak back — the brief's 10, scaled for big goals. */
export function repairTarget(goal: number): number {
  return Math.max(10, goal * 2);
}

export interface SettleEvents {
  /** Days a freeze was spent on during this settlement. */
  protectedDays: string[];
  /** Freezes granted during this settlement. */
  freezesAwarded: number;
  /** Set when the streak broke with no freeze left. */
  broke: { streak: number; day: string } | null;
}

function awardFreezes(state: StreakState, events: SettleEvents) {
  // Grant one per completed block of FREEZE_EVERY, catching up if several
  // blocks passed (possible on a first-run bootstrap).
  const due = Math.floor(state.currentStreak / FREEZE_EVERY) * FREEZE_EVERY;
  while (state.freezeAwardedFor < due) {
    state.freezeAwardedFor += FREEZE_EVERY;
    state.freezes += 1;
    events.freezesAwarded += 1;
  }
}

/**
 * Advances `state` through every fully-elapsed day up to (but not including)
 * today. Idempotent: calling it repeatedly on the same day changes nothing.
 */
export function settle(
  state: StreakState,
  counts: Map<string, number>,
  goal: number,
  now: Date = new Date()
): { state: StreakState; events: SettleEvents } {
  const next: StreakState = {
    ...state,
    protectedDays: [...state.protectedDays],
    celebrated: [...state.celebrated],
  };
  const events: SettleEvents = { protectedDays: [], freezesAwarded: 0, broke: null };
  if (goal <= 0) return { state: next, events };

  const today = effectiveDay(now);

  // First run: adopt the history that already exists rather than pretending
  // the user starts from zero, but don't retro-spend freezes on old misses.
  if (next.lastSettledDay === null) {
    const met = [...counts.entries()]
      .filter(([, c]) => c >= goal)
      .map(([k]) => k)
      .sort();
    if (met.length === 0) {
      next.lastSettledDay = dayKey(addDays(today, -1));
      return { state: next, events };
    }
    // Walk back from yesterday while days were met.
    const metSet = new Set(met);
    let run = 0;
    let cursor = addDays(today, -1);
    while (metSet.has(dayKey(cursor))) {
      run++;
      cursor = addDays(cursor, -1);
    }
    next.currentStreak = run;
    next.longestStreak = Math.max(next.longestStreak, run);
    next.freezeAwardedFor = Math.floor(run / FREEZE_EVERY) * FREEZE_EVERY;
    next.freezes = Math.floor(run / FREEZE_EVERY);
    next.lastSettledDay = dayKey(addDays(today, -1));
    return { state: next, events };
  }

  let cursor = addDays(keyToDate(next.lastSettledDay), 1);
  let guard = 0;
  while (cursor.getTime() < today.getTime() && guard++ < MAX_SETTLE_DAYS) {
    const k = dayKey(cursor);
    const hit = (counts.get(k) ?? 0) >= goal;

    if (hit) {
      next.currentStreak += 1;
      next.longestStreak = Math.max(next.longestStreak, next.currentStreak);
      awardFreezes(next, events);
    } else if (next.freezes > 0) {
      // A freeze absorbs the miss: the streak survives but doesn't grow.
      next.freezes -= 1;
      next.protectedDays.push(k);
      events.protectedDays.push(k);
    } else {
      if (next.currentStreak >= MIN_REPAIRABLE) {
        events.broke = { streak: next.currentStreak, day: k };
        next.repair = {
          brokenStreak: next.currentStreak,
          missedDay: k,
          target: repairTarget(goal),
          expiresAt: settlementInstant(k) + REPAIR_WINDOW_HOURS * 3600 * 1000,
        };
      }
      next.currentStreak = 0;
      next.freezeAwardedFor = 0;
    }
    next.lastSettledDay = k;
    cursor = addDays(cursor, 1);
  }

  return { state: next, events };
}

/**
 * Resolves an open repair challenge: completed, expired, or still running.
 * This is the ONLY place that decision is made — `project` just displays the
 * result, so the two can never disagree.
 */
export function reconcile(
  state: StreakState,
  counts: Map<string, number>,
  goal: number,
  now: Date = new Date()
): StreakState {
  let s = settle(state, counts, goal, now).state;

  // Award against the streak the user can actually see, so reaching day 10
  // grants the freeze that same day rather than when the day rolls over.
  // `freezeAwardedFor` makes this idempotent with the award inside settle().
  const shown = project(s, counts, goal, now).streak;
  while (s.freezeAwardedFor + FREEZE_EVERY <= shown) {
    s = {
      ...s,
      freezeAwardedFor: s.freezeAwardedFor + FREEZE_EVERY,
      freezes: s.freezes + 1,
    };
  }

  if (s.repair) {
    const todayCount = counts.get(dayKey(effectiveDay(now))) ?? 0;
    if (now.getTime() > s.repair.expiresAt) {
      s = { ...s, repair: null };
    } else if (todayCount >= s.repair.target) {
      // Won back: the lost streak returns and today extends it as normal.
      s = { ...s, currentStreak: s.repair.brokenStreak, repair: null };
    }
  }
  return s;
}

/**
 * Folds today into the settled state for display. Kept separate from `settle`
 * so today stays fluid — it can be recomputed on every word added without
 * mutating history.
 */
export interface StreakView {
  /** Streak including today when today's goal is already met. */
  streak: number;
  longestStreak: number;
  freezes: number;
  todayCount: number;
  todayMet: boolean;
  /** Words still needed today to extend the streak. */
  remainingToday: number;
  /** Days until the next free freeze. */
  daysToNextFreeze: number;
  repair: RepairChallenge | null;
}

export function project(
  state: StreakState,
  counts: Map<string, number>,
  goal: number,
  now: Date = new Date()
): StreakView {
  const todayK = dayKey(effectiveDay(now));
  const todayCount = counts.get(todayK) ?? 0;
  const todayMet = goal > 0 && todayCount >= goal;

  const streak = state.currentStreak + (todayMet ? 1 : 0);
  const nextBlock = (Math.floor(streak / FREEZE_EVERY) + 1) * FREEZE_EVERY;

  return {
    streak,
    longestStreak: Math.max(state.longestStreak, streak),
    freezes: state.freezes,
    todayCount,
    todayMet,
    remainingToday: Math.max(goal - todayCount, 0),
    daysToNextFreeze: Math.max(nextBlock - streak, 0),
    repair: state.repair,
  };
}

/** The highest milestone reached but not yet celebrated. */
export function pendingMilestone(state: StreakState, streak: number): number | null {
  const hit = MILESTONES.filter((m) => streak >= m && !state.celebrated.includes(m));
  return hit.length ? hit[hit.length - 1] : null;
}

// ----- calendar -------------------------------------------------------------

export type DayStatus = 'met' | 'protected' | 'missed' | 'future' | 'idle';

export interface CalendarCell {
  key: string;
  date: Date;
  count: number;
  status: DayStatus;
  isToday: boolean;
}

/**
 * One month of cells for the heatmap. `idle` means "before the user started",
 * so an empty history doesn't render as a wall of failures.
 */
export function monthGrid(
  year: number,
  month: number,
  counts: Map<string, number>,
  protectedDays: string[],
  goal: number,
  firstActiveDay: string | null,
  now: Date = new Date()
): CalendarCell[] {
  const todayK = dayKey(effectiveDay(now));
  const prot = new Set(protectedDays);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 1; i <= days; i++) {
    const date = new Date(year, month, i);
    const k = dayKey(date);
    const count = counts.get(k) ?? 0;
    let status: DayStatus;
    if (k > todayK) status = 'future';
    else if (goal > 0 && count >= goal) status = 'met';
    else if (prot.has(k)) status = 'protected';
    else if (firstActiveDay && k < firstActiveDay) status = 'idle';
    else if (k === todayK) status = 'idle'; // today isn't a miss until it ends
    else status = 'missed';
    cells.push({ key: k, date, count, status, isToday: k === todayK });
  }
  return cells;
}
