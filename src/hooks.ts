import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import Word from './db/models/Word';
import { observeAllWords } from './db/words';
import { DEFAULT_DAILY_GOAL, getDailyGoal, setDailyGoal } from './db/settings';

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
