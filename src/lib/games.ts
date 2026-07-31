import Word from '../db/models/Word';

export type GameKey = 'millionaire' | 'memory' | 'scrabble' | 'crossword' | 'bee';

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
  {
    key: 'scrabble',
    title: 'Vocab Scrabble',
    tagline: 'Spell your words from a rack of 7 tiles.',
    unlockAt: 60,
  },
  {
    key: 'crossword',
    title: 'Context Crossword',
    tagline: 'A fresh mini crossword from your own words.',
    unlockAt: 75,
  },
  {
    key: 'bee',
    title: 'Spelling Bee',
    tagline: 'Seven hexes, one golden pangram.',
    unlockAt: 90,
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

// ---------------------------------------------------------------------------
// Vocab Scrabble
// ---------------------------------------------------------------------------

/** Standard Scrabble letter values. */
export const LETTER_PTS: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1,
  M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8,
  Y: 4, Z: 10,
};

export type SlotBonus = 'DL' | 'TL' | 'DW' | 'TW' | null;

export interface ScrabbleRound {
  rack: string[]; // 7 uppercase letters
  /** A word from the pool guaranteed spellable from the rack. */
  seedWord: string;
  /** Bonus per play-row slot (7 slots). */
  bonuses: SlotBonus[];
}

const VOWELS = 'AEIOU';
const COMMON = 'ETAOINSHRDLU';

/** Alphabetic-only, uppercased; the only words games can trust. */
function cleanPool(words: Word[], min = 3, max = 12): { raw: Word; up: string }[] {
  return words
    .map((w) => ({ raw: w, up: w.word.toUpperCase().trim() }))
    .filter(({ up }) => /^[A-Z]+$/.test(up) && up.length >= min && up.length <= max);
}

/** Multiset check: can `word` be spelled from `rack`? */
export function spellableFrom(word: string, rack: string[]): boolean {
  const avail = new Map<string, number>();
  for (const l of rack) avail.set(l, (avail.get(l) ?? 0) + 1);
  for (const l of word) {
    const n = avail.get(l) ?? 0;
    if (n === 0) return false;
    avail.set(l, n - 1);
  }
  return true;
}

/** New rack seeded from a random 4-7 letter pool word, padded with fillers. */
export function buildScrabbleRound(words: Word[]): ScrabbleRound | null {
  const pool = cleanPool(words, 3, 7);
  if (pool.length === 0) return null;
  const seed = shuffle(pool)[0].up;
  const rack = seed.split('');
  while (rack.length < 7) {
    // Vowel-biased filler keeps racks playable.
    const src = Math.random() < 0.4 ? VOWELS : COMMON;
    rack.push(src[Math.floor(Math.random() * src.length)]);
  }
  const bonuses: SlotBonus[] = Array(7).fill(null);
  const slots = shuffle([0, 1, 2, 3, 4, 5, 6]);
  bonuses[slots[0]] = Math.random() < 0.5 ? 'DL' : 'TL';
  bonuses[slots[1]] = Math.random() < 0.6 ? 'DW' : 'TW';
  return { rack: shuffle(rack), seedWord: seed, bonuses };
}

/** Score `word` laid on the play row starting at slot 0. */
export function scoreScrabble(word: string, bonuses: SlotBonus[]): number {
  let sum = 0;
  let wordMult = 1;
  for (let i = 0; i < word.length; i++) {
    let pts = LETTER_PTS[word[i]] ?? 0;
    const b = bonuses[i];
    if (b === 'DL') pts *= 2;
    if (b === 'TL') pts *= 3;
    if (b === 'DW') wordMult *= 2;
    if (b === 'TW') wordMult *= 3;
    sum += pts;
  }
  return sum * wordMult;
}

/** Is `entry` a word from the learned pool (and spellable rules already met)? */
export function isPoolWord(entry: string, words: Word[]): boolean {
  const target = entry.toUpperCase();
  return words.some((w) => w.word.toUpperCase().trim() === target);
}

// ---------------------------------------------------------------------------
// Context Crossword
// ---------------------------------------------------------------------------

export const CROSSWORD_SIZE = 7;

export interface CrosswordWord {
  word: string; // uppercase
  clue: string;
  row: number;
  col: number;
  dir: 'across' | 'down';
  num: number;
}

export interface CrosswordPuzzle {
  size: number;
  words: CrosswordWord[];
}

function clueFor(w: Word): string {
  const options: string[] = [];
  const blanked = w.exampleSentence.replace(
    new RegExp(`\\b${w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
    '_____'
  );
  if (blanked.includes('_____')) options.push(`“${blanked}”`);
  options.push(w.meaning);
  if (w.antonyms[0]) options.push(`Opposite of ${w.antonyms[0].toLowerCase()}`);
  return shuffle(options)[0];
}

interface Placement {
  word: string;
  raw: Word;
  row: number;
  col: number;
  dir: 'across' | 'down';
}

function canPlace(
  grid: (string | null)[][],
  word: string,
  row: number,
  col: number,
  dir: 'across' | 'down',
  size: number
): boolean {
  const dr = dir === 'down' ? 1 : 0;
  const dc = dir === 'across' ? 1 : 0;
  if (row < 0 || col < 0) return false;
  if (row + dr * (word.length - 1) >= size) return false;
  if (col + dc * (word.length - 1) >= size) return false;
  // Cell before start / after end must be free.
  const br = row - dr, bc = col - dc;
  if (br >= 0 && bc >= 0 && grid[br]?.[bc]) return false;
  const ar = row + dr * word.length, ac = col + dc * word.length;
  if (ar < size && ac < size && grid[ar]?.[ac]) return false;

  let crosses = 0;
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i, c = col + dc * i;
    const cell = grid[r][c];
    if (cell) {
      if (cell !== word[i]) return false;
      crosses++;
    } else {
      // New cell: its perpendicular neighbours must be empty.
      const n1 = dir === 'across' ? grid[r - 1]?.[c] : grid[r]?.[c - 1];
      const n2 = dir === 'across' ? grid[r + 1]?.[c] : grid[r]?.[c + 1];
      if (n1 || n2) return false;
    }
  }
  return crosses > 0;
}

/**
 * Dynamically generates a mini crossword: up to `target` pool words crossed
 * on a size×size grid. Returns null when the pool can't produce ≥4 crossings
 * (caller retries or shows a friendly notice).
 */
export function buildCrossword(
  words: Word[],
  size = CROSSWORD_SIZE,
  target = 6,
  attempts = 80
): CrosswordPuzzle | null {
  const pool = cleanPool(words, 3, size);
  if (pool.length < 4) return null;

  let best: Placement[] = [];
  for (let att = 0; att < attempts && best.length < target; att++) {
    const grid: (string | null)[][] = Array.from({ length: size }, () =>
      Array(size).fill(null)
    );
    const order = shuffle(pool).slice(0, 14);
    const placed: Placement[] = [];

    const first = order[0];
    const fr = Math.floor(size / 2);
    const fc = Math.floor((size - first.up.length) / 2);
    placed.push({ word: first.up, raw: first.raw, row: fr, col: fc, dir: 'across' });
    for (let i = 0; i < first.up.length; i++) grid[fr][fc + i] = first.up[i];

    for (const cand of order.slice(1)) {
      if (placed.length >= target) break;
      if (placed.some((p) => p.word === cand.up)) continue;
      let done = false;
      // Try to cross an existing placement at a shared letter.
      for (const p of shuffle(placed)) {
        if (done) break;
        const pdr = p.dir === 'down' ? 1 : 0;
        const pdc = p.dir === 'across' ? 1 : 0;
        for (let pi = 0; pi < p.word.length && !done; pi++) {
          const letter = p.word[pi];
          for (let ci = 0; ci < cand.up.length && !done; ci++) {
            if (cand.up[ci] !== letter) continue;
            const dir = p.dir === 'across' ? 'down' : 'across';
            const row = p.row + pdr * pi - (dir === 'down' ? ci : 0);
            const col = p.col + pdc * pi - (dir === 'across' ? ci : 0);
            if (canPlace(grid, cand.up, row, col, dir, size)) {
              placed.push({ word: cand.up, raw: cand.raw, row, col, dir });
              const dr = dir === 'down' ? 1 : 0;
              const dc = dir === 'across' ? 1 : 0;
              for (let i = 0; i < cand.up.length; i++) {
                grid[row + dr * i][col + dc * i] = cand.up[i];
              }
              done = true;
            }
          }
        }
      }
    }
    if (placed.length > best.length) best = placed;
  }

  if (best.length < 4) return null;
  // Number clues top-to-bottom, left-to-right like a real crossword.
  const sorted = [...best].sort((a, b) => a.row - b.row || a.col - b.col);
  return {
    size,
    words: sorted.map((p, i) => ({
      word: p.word,
      clue: clueFor(p.raw),
      row: p.row,
      col: p.col,
      dir: p.dir,
      num: i + 1,
    })),
  };
}

// ---------------------------------------------------------------------------
// Spelling Bee
// ---------------------------------------------------------------------------

export interface BeeRound {
  /** 7 unique letters; index 0 is the mandatory center. */
  letters: string[];
  center: string;
  /** Pool words spellable from the hive (subsets allowed, center required). */
  answers: string[];
  /** Answers using all 7 letters. */
  pangrams: string[];
}

const uniq = (s: string) => [...new Set(s.split(''))];

/**
 * Builds a hive from the pool: prefers a 7-unique-letter word (guaranteed
 * pangram), else pads a shorter word's letters with common fillers. Answers
 * are every pool word whose letters fit the hive and include the center.
 */
export function buildBeeRound(words: Word[]): BeeRound | null {
  const pool = cleanPool(words, 4, 12);
  if (pool.length === 0) return null;

  const sevens = pool.filter(({ up }) => uniq(up).length === 7);
  let letters: string[];
  if (sevens.length > 0) {
    letters = uniq(shuffle(sevens)[0].up);
  } else {
    const base = shuffle(pool.filter(({ up }) => uniq(up).length <= 7))[0];
    if (!base) return null;
    letters = uniq(base.up);
    for (const f of shuffle(COMMON.split(''))) {
      if (letters.length >= 7) break;
      if (!letters.includes(f)) letters.push(f);
    }
  }

  const set = new Set(letters);
  const fits = pool.filter(({ up }) => uniq(up).every((l) => set.has(l)));

  // Center = the hive letter that keeps the most answers alive.
  let center = letters[0];
  let bestCount = -1;
  for (const l of letters) {
    const n = fits.filter(({ up }) => up.includes(l)).length;
    if (n > bestCount) {
      bestCount = n;
      center = l;
    }
  }

  const answers = [...new Set(fits.filter(({ up }) => up.includes(center)).map(({ up }) => up))];
  if (answers.length === 0) return null;
  const pangrams = answers.filter((w) => uniq(w).length === 7);
  const outer = shuffle(letters.filter((l) => l !== center));
  return { letters: [center, ...outer], center, answers, pangrams };
}

/** Bee scoring: 4 letters = 1 pt, else length; pangram = length + 7 bonus. */
export function beePoints(word: string, isPangram: boolean): number {
  const base = word.length === 4 ? 1 : word.length;
  return isPangram ? base + 7 : base;
}
