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

export const DEFAULT_DARK_MODE = false;

const DARK_MODE_KEY = 'settings.darkMode';

export async function getDarkMode(): Promise<boolean> {
  const value = await database.localStorage.get<boolean>(DARK_MODE_KEY);
  return value ?? DEFAULT_DARK_MODE;
}

export async function setDarkMode(enabled: boolean): Promise<void> {
  await database.localStorage.set(DARK_MODE_KEY, enabled);
}
