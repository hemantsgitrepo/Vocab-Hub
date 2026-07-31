// ponytail: settings live in WatermelonDB's built-in key-value localStorage —
// no AsyncStorage dependency needed for a handful of scalar preferences.
import { database } from './index';

export const DEFAULT_DAILY_GOAL = 5;

const DAILY_GOAL_KEY = 'settings.dailyGoal';

export async function getDailyGoal(): Promise<number> {
  const value = await database.localStorage.get<number>(DAILY_GOAL_KEY);
  return value ?? DEFAULT_DAILY_GOAL;
}

export async function setDailyGoal(goal: number): Promise<void> {
  await database.localStorage.set(DAILY_GOAL_KEY, goal);
}

export type TravelField =
  | 'word'
  | 'meaning'
  | 'synonyms'
  | 'antonyms'
  | 'example'
  | 'layman';

/** Canonical playback order — Travel Mode speaks fields in this sequence. */
export const TRAVEL_FIELDS: { key: TravelField; label: string }[] = [
  { key: 'word', label: 'Word' },
  { key: 'meaning', label: 'Meaning' },
  { key: 'synonyms', label: 'Synonyms' },
  { key: 'antonyms', label: 'Antonyms' },
  { key: 'example', label: 'Example sentence' },
  { key: 'layman', label: "Layman's explanation" },
];

export const DEFAULT_TRAVEL_FIELDS: TravelField[] = ['word', 'meaning', 'example'];

const TRAVEL_FIELDS_KEY = 'settings.travelFields';

export async function getTravelFields(): Promise<TravelField[]> {
  const raw = await database.localStorage.get<string>(TRAVEL_FIELDS_KEY);
  if (raw == null) return DEFAULT_TRAVEL_FIELDS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TRAVEL_FIELDS;
    const valid = TRAVEL_FIELDS.map((f) => f.key);
    return parsed.filter((k): k is TravelField => valid.includes(k as TravelField));
  } catch {
    return DEFAULT_TRAVEL_FIELDS;
  }
}

export async function setTravelFields(fields: TravelField[]): Promise<void> {
  await database.localStorage.set(TRAVEL_FIELDS_KEY, JSON.stringify(fields));
}

export const DEFAULT_QUIZ_SYNONYMS = false;

const QUIZ_SYNONYMS_KEY = 'settings.quizUseSynonyms';

export async function getQuizSynonyms(): Promise<boolean> {
  const value = await database.localStorage.get<boolean>(QUIZ_SYNONYMS_KEY);
  return value ?? DEFAULT_QUIZ_SYNONYMS;
}

export async function setQuizSynonyms(enabled: boolean): Promise<void> {
  await database.localStorage.set(QUIZ_SYNONYMS_KEY, enabled);
}

export const DEFAULT_QUIZ_ANTONYMS = false;

const QUIZ_ANTONYMS_KEY = 'settings.quizUseAntonyms';

export async function getQuizAntonyms(): Promise<boolean> {
  const value = await database.localStorage.get<boolean>(QUIZ_ANTONYMS_KEY);
  return value ?? DEFAULT_QUIZ_ANTONYMS;
}

export async function setQuizAntonyms(enabled: boolean): Promise<void> {
  await database.localStorage.set(QUIZ_ANTONYMS_KEY, enabled);
}

/** Best Vocab Millionaire score, in points. */
const MILLIONAIRE_BEST_KEY = 'games.millionaire.bestScore';

export async function getMillionaireBest(): Promise<number> {
  const value = await database.localStorage.get<number>(MILLIONAIRE_BEST_KEY);
  return value ?? 0;
}

export async function setMillionaireBest(score: number): Promise<void> {
  await database.localStorage.set(MILLIONAIRE_BEST_KEY, score);
}

/** Generic per-game stat (best score / solved count) for the arcade games. */
const gameStatKey = (game: string) => `games.stat.${game}`;

export async function getGameStat(game: string): Promise<number> {
  const value = await database.localStorage.get<number>(gameStatKey(game));
  return value ?? 0;
}

export async function setGameStat(game: string, value: number): Promise<void> {
  await database.localStorage.set(gameStatKey(game), value);
}

export const DEFAULT_GAME_SOUNDS = true;

const GAME_SOUNDS_KEY = 'settings.gameSounds';

export async function getGameSounds(): Promise<boolean> {
  const value = await database.localStorage.get<boolean>(GAME_SOUNDS_KEY);
  return value ?? DEFAULT_GAME_SOUNDS;
}

export async function setGameSounds(enabled: boolean): Promise<void> {
  await database.localStorage.set(GAME_SOUNDS_KEY, enabled);
}

/** Best Memory Match result, in moves (lower is better; 0 = never played). */
const MEMORY_BEST_KEY = 'games.memory.bestMoves';

export async function getMemoryBest(): Promise<number> {
  const value = await database.localStorage.get<number>(MEMORY_BEST_KEY);
  return value ?? 0;
}

export async function setMemoryBest(moves: number): Promise<void> {
  await database.localStorage.set(MEMORY_BEST_KEY, moves);
}

/** Whether the first-launch onboarding carousel has been completed/skipped. */
const ONBOARDING_KEY = 'settings.onboardingComplete';

export async function getOnboardingComplete(): Promise<boolean> {
  const value = await database.localStorage.get<boolean>(ONBOARDING_KEY);
  return value ?? false;
}

export async function setOnboardingComplete(done: boolean): Promise<void> {
  await database.localStorage.set(ONBOARDING_KEY, done);
}

/**
 * Games whose unlock celebration has already played. Persisted so a milestone
 * modal fires exactly once per game, even across restarts.
 */
const CELEBRATED_KEY = 'games.celebratedUnlocks';

/** `null` means "never initialized" — distinct from an empty list. */
export async function getCelebratedUnlocks(): Promise<string[] | null> {
  const raw = await database.localStorage.get<string>(CELEBRATED_KEY);
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is string => typeof k === 'string');
  } catch {
    return [];
  }
}

export async function setCelebratedUnlocks(keys: string[]): Promise<void> {
  await database.localStorage.set(CELEBRATED_KEY, JSON.stringify(keys));
}

export type ThemeMode = 'light' | 'dark' | 'system';

export const DEFAULT_THEME_MODE: ThemeMode = 'system';

const THEME_MODE_KEY = 'settings.themeMode';
const LEGACY_DARK_MODE_KEY = 'settings.darkMode';

export async function getThemeMode(): Promise<ThemeMode> {
  const value = await database.localStorage.get<string>(THEME_MODE_KEY);
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  // Migrate the old boolean toggle: an explicit true/false keeps its choice.
  const legacy = await database.localStorage.get<boolean>(LEGACY_DARK_MODE_KEY);
  if (legacy === true) return 'dark';
  if (legacy === false) return 'light';
  return DEFAULT_THEME_MODE;
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  await database.localStorage.set(THEME_MODE_KEY, mode);
}
