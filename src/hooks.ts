import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import Word from './db/models/Word';
import { observeAllWords, observeWordCount } from './db/words';
import { GAMES, GameKey } from './lib/games';
import {
  DEFAULT_DAILY_GOAL,
  DEFAULT_GAME_SOUNDS,
  DEFAULT_QUIZ_ANTONYMS,
  DEFAULT_QUIZ_SYNONYMS,
  DEFAULT_TRAVEL_FIELDS,
  TravelField,
  getDailyGoal,
  getGameSounds,
  getOnboardingComplete,
  getQuizAntonyms,
  getQuizSynonyms,
  getTravelFields,
  setDailyGoal,
  setGameSounds,
  setOnboardingComplete,
  setQuizAntonyms,
  setQuizSynonyms,
  setTravelFields,
} from './db/settings';
import { setSfxEnabled } from './lib/sfx';

/** All words, newest first, kept live via WatermelonDB observation. */
export function useAllWords(): Word[] {
  const [words, setWords] = useState<Word[]>([]);
  useEffect(() => {
    const sub = observeAllWords().subscribe(setWords);
    return () => sub.unsubscribe();
  }, []);
  return words;
}

export interface GameUnlock {
  unlocked: boolean;
  /** Words still needed to unlock (0 when unlocked). */
  remaining: number;
  /** 0..1 progress toward the unlock threshold. */
  progress: number;
  unlockAt: number;
}

export interface GameUnlockStatus {
  totalWords: number;
  games: Record<GameKey, GameUnlock>;
}

/** Live unlock progression for every game, driven by the total word count. */
export function useGameUnlockStatus(): GameUnlockStatus {
  const [totalWords, setTotalWords] = useState(0);
  useEffect(() => {
    const sub = observeWordCount().subscribe(setTotalWords);
    return () => sub.unsubscribe();
  }, []);
  const games = {} as Record<GameKey, GameUnlock>;
  for (const g of GAMES) {
    games[g.key] = {
      unlocked: totalWords >= g.unlockAt,
      remaining: Math.max(g.unlockAt - totalWords, 0),
      progress: Math.min(totalWords / g.unlockAt, 1),
      unlockAt: g.unlockAt,
    };
  }
  return { totalWords, games };
}

/**
 * First-launch onboarding gate. `null` while the stored flag is still loading,
 * so the carousel never flashes for a returning user.
 */
export function useOnboarding(): [boolean | null, () => void] {
  const [done, setDone] = useState<boolean | null>(null);
  useEffect(() => {
    getOnboardingComplete().then(setDone);
  }, []);
  const complete = () => {
    setDone(true);
    setOnboardingComplete(true);
  };
  return [done, complete];
}

/** Daily goal, re-read whenever the screen gains focus so edits in Settings propagate. */
export function useDailyGoal(): [number, (n: number) => void] {
  const [goal, setGoal] = useState(DEFAULT_DAILY_GOAL);
  useFocusEffect(
    useCallback(() => {
      getDailyGoal().then(setGoal);
    }, [])
  );
  const update = (n: number) => {
    setGoal(n);
    setDailyGoal(n);
  };
  return [goal, update];
}

/** Which word fields Travel Mode reads aloud, re-read whenever a screen focuses. */
export function useTravelFields(): [TravelField[], (f: TravelField[]) => void] {
  const [fields, setFields] = useState<TravelField[]>(DEFAULT_TRAVEL_FIELDS);
  useFocusEffect(
    useCallback(() => {
      getTravelFields().then(setFields);
    }, [])
  );
  const update = (next: TravelField[]) => {
    setFields(next);
    setTravelFields(next);
  };
  return [fields, update];
}

/** Whether arcade games play sound effects. */
export function useGameSounds(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(DEFAULT_GAME_SOUNDS);
  useFocusEffect(
    useCallback(() => {
      getGameSounds().then(setEnabled);
    }, [])
  );
  const update = (next: boolean) => {
    setEnabled(next);
    setGameSounds(next);
    setSfxEnabled(next); // applies immediately, no restart needed
  };
  return [enabled, update];
}

/** Whether quizzes prompt with a synonym instead of the word itself. */
export function useQuizSynonyms(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(DEFAULT_QUIZ_SYNONYMS);
  useFocusEffect(
    useCallback(() => {
      getQuizSynonyms().then(setEnabled);
    }, [])
  );
  const update = (next: boolean) => {
    setEnabled(next);
    setQuizSynonyms(next);
  };
  return [enabled, update];
}

/** Whether quizzes prompt with an antonym instead of the word itself. */
export function useQuizAntonyms(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(DEFAULT_QUIZ_ANTONYMS);
  useFocusEffect(
    useCallback(() => {
      getQuizAntonyms().then(setEnabled);
    }, [])
  );
  const update = (next: boolean) => {
    setEnabled(next);
    setQuizAntonyms(next);
  };
  return [enabled, update];
}
