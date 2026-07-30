import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import Word from './db/models/Word';
import { observeAllWords } from './db/words';
import {
  DEFAULT_DAILY_GOAL,
  DEFAULT_QUIZ_SYNONYMS,
  DEFAULT_TRAVEL_FIELDS,
  TravelField,
  getDailyGoal,
  getQuizSynonyms,
  getTravelFields,
  setDailyGoal,
  setQuizSynonyms,
  setTravelFields,
} from './db/settings';

/** All words, newest first, kept live via WatermelonDB observation. */
export function useAllWords(): Word[] {
  const [words, setWords] = useState<Word[]>([]);
  useEffect(() => {
    const sub = observeAllWords().subscribe(setWords);
    return () => sub.unsubscribe();
  }, []);
  return words;
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
