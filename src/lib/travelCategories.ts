// Predefined playlists for Travel Mode.
//
// These replace ad-hoc per-word picking as the primary way to choose what
// plays. Each category is a single predicate over a Word, so adding one is a
// single entry here — no changes to the screen.
//
// The set deliberately spans the three axes a learner actually thinks in:
// recency (Recent), progress (Needs practice / Mastered) and difficulty
// (Challenging). Combining them into a filter matrix was rejected: it
// multiplies choices without multiplying intent, and most combinations
// ("mastered AND recent") answer no real question.

import { Clock, Flame, Layers, LucideIcon, Target, Trophy } from 'lucide-react-native';
import Word from '../db/models/Word';

export type CategoryKey = 'all' | 'recent' | 'practice' | 'mastered' | 'hard';

export interface TravelCategory {
  key: CategoryKey;
  label: string;
  Icon: LucideIcon;
  /** Shown when the category is selected but empty. */
  emptyHint: string;
  match: (w: Word, now: Date) => boolean;
}

/** Words added on or after this many days ago count as "recent". */
export const RECENT_DAYS = 7;

/** Midnight of the day `RECENT_DAYS - 1` days back, so "recent" is whole days. */
function recentCutoff(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (RECENT_DAYS - 1));
  return d.getTime();
}

export const TRAVEL_CATEGORIES: TravelCategory[] = [
  {
    key: 'all',
    label: 'All words',
    Icon: Layers,
    emptyHint: 'Add a few words and they will queue up here.',
    match: () => true,
  },
  {
    key: 'recent',
    label: 'Recent',
    Icon: Clock,
    emptyHint: `Nothing added in the last ${RECENT_DAYS} days.`,
    match: (w, now) => w.createdAt.getTime() >= recentCutoff(now),
  },
  {
    key: 'practice',
    label: 'Needs practice',
    Icon: Target,
    emptyHint: 'Every word is mastered — nothing left to drill.',
    match: (w) => w.practiceStatus !== 'mastered',
  },
  {
    key: 'mastered',
    label: 'Mastered',
    Icon: Trophy,
    emptyHint: 'Answer words correctly in the Quiz to master them.',
    match: (w) => w.practiceStatus === 'mastered',
  },
  {
    key: 'hard',
    label: 'Challenging',
    Icon: Flame,
    emptyHint: 'No words are marked hard yet.',
    match: (w) => w.difficultyLevel === 'hard',
  },
];

export function categoryFor(key: CategoryKey): TravelCategory {
  return TRAVEL_CATEGORIES.find((c) => c.key === key) ?? TRAVEL_CATEGORIES[0];
}

/** Word counts per category, for the chip badges. */
export function categoryCounts(words: Word[], now: Date): Record<CategoryKey, number> {
  const counts = {} as Record<CategoryKey, number>;
  for (const c of TRAVEL_CATEGORIES) {
    counts[c.key] = words.filter((w) => c.match(w, now)).length;
  }
  return counts;
}
