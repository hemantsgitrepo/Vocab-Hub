import Word from '../db/models/Word';

export type GameKey = 'millionaire' | 'memory';

export interface GameDef {
  key: GameKey;
  title: string;
  tagline: string;
  unlockAt: number;
}

export const GAMES: GameDef[] = [
  {
    key: 'millionaire',
    title: 'Vocab Millionaire',
    tagline: '15 questions. One shot at 1,000,000 points.',
    unlockAt: 20,
  },
  {
    key: 'memory',
    title: 'Memory Match',
    tagline: 'Flip the grid, pair every word with its match.',
    unlockAt: 50,
  },
];

// ---------------------------------------------------------------------------
// Vocab Millionaire
// ---------------------------------------------------------------------------

/** Prize ladder, question 1 → 15. */
export const LADDER = [
  100, 200, 300, 500, 1_000,
  2_000, 4_000, 8_000, 16_000, 32_000,
  64_000, 125_000, 250_000, 500_000, 1_000_000,
];

/** 0-based question indexes that bank their prize permanently. */
export const SAFE_HAVENS = [4, 9]; // Q5 = 1,000 pts · Q10 = 32,000 pts

export interface MillionaireQuestion {
  word: Word;
  options: string[]; // 4 meanings
  correctIndex: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIFF_RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

/**
 * 15 questions from 15 unique random words, easiest first so the climb
 * feels like a real game show. Distractor meanings come from other words.
 */
export function buildMillionaireQuestions(words: Word[]): MillionaireQuestion[] {
  const picked = shuffle(words)
    .slice(0, 15)
    .sort(
      (a, b) => (DIFF_RANK[a.difficultyLevel] ?? 1) - (DIFF_RANK[b.difficultyLevel] ?? 1)
    );
  return picked.map((word) => {
    const distractors = shuffle(words.filter((w) => w.id !== word.id))
      .slice(0, 3)
      .map((w) => w.meaning);
    const options = shuffle([word.meaning, ...distractors]);
    return { word, options, correctIndex: options.indexOf(word.meaning) };
  });
}

/** Points guaranteed after a wrong answer at 0-based question `index`. */
export function safeHavenPoints(index: number): number {
  const passed = SAFE_HAVENS.filter((h) => index > h);
  return passed.length ? LADDER[passed[passed.length - 1]] : 0;
}

/** Two random wrong option indexes to strike for the 50:50 lifeline. */
export function fiftyFiftyStrikes(q: MillionaireQuestion): number[] {
  const wrong = q.options.map((_, i) => i).filter((i) => i !== q.correctIndex);
  return shuffle(wrong).slice(0, 2);
}

// ---------------------------------------------------------------------------
// Memory Match
// ---------------------------------------------------------------------------

export interface MemoryCard {
  id: string; // unique per card
  pairId: string; // shared by the two cards of a pair
  face: 'word' | 'match';
  label: string;
}

export const MEMORY_PAIRS = 6; // 6 pairs → 4x3 grid

/**
 * A fresh randomized deck each session: 6 random words, each paired with its
 * first synonym (or its meaning when no synonym exists).
 */
export function buildMemoryDeck(words: Word[]): MemoryCard[] {
  const picked = shuffle(words).slice(0, MEMORY_PAIRS);
  const cards = picked.flatMap((w): MemoryCard[] => {
    const match = w.synonyms[0] ?? w.meaning;
    return [
      { id: `${w.id}-w`, pairId: w.id, face: 'word', label: w.word },
      { id: `${w.id}-m`, pairId: w.id, face: 'match', label: match },
    ];
  });
  return shuffle(cards);
}
