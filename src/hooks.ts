import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { Session } from '@supabase/supabase-js';
import Word from './db/models/Word';
import { observeAllWords, observeWordCount } from './db/words';
import { supabase } from './lib/supabaseClient';
import { GAMES, GameKey } from './lib/games';
import {
  DEFAULT_DAILY_GOAL,
  DEFAULT_GAME_SOUNDS,
  DEFAULT_NOTIFY_ENABLED,
  DEFAULT_QUIZ_ANTONYMS,
  DEFAULT_QUIZ_SYNONYMS,
  DEFAULT_TRAVEL_FIELDS,
  TravelField,
  getConsentAccepted,
  getDailyGoal,
  getGameSounds,
  getNotifyEmail,
  getNotifyEnabled,
  getOnboardingComplete,
  getStreakStateRaw,
  setStreakStateRaw,
  getQuizAntonyms,
  getQuizSynonyms,
  getTravelFields,
  setConsentAccepted,
  setDailyGoal,
  setGameSounds,
  setNotifyEmail,
  setNotifyEnabled,
  setOnboardingComplete,
  setQuizAntonyms,
  setQuizSynonyms,
  setTravelFields,
} from './db/settings';
import { setSfxEnabled } from './lib/sfx';
import {
  FREEZE_EVERY,
  STREAK_STATE_VERSION,
  StreakState,
  StreakView,
  countsByDay,
  initialState,
  pendingMilestone,
  project,
  reconcile,
} from './lib/streakEngine';

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
 * The forgiving streak system: settles elapsed days, spends freezes on misses,
 * runs repair challenges and surfaces milestones.
 *
 * Day completion is derived from word timestamps every time, so the streak can
 * never drift from the collection; only the non-derivable overlay is persisted.
 */
export interface StreakManager {
  /** False until the stored overlay has loaded — don't render numbers yet. */
  ready: boolean;
  view: StreakView;
  state: StreakState;
  /** Words added per effective day, for the calendar heatmap. */
  counts: Map<string, number>;
  /** First day the user ever added a word, so blank months aren't "missed". */
  firstActiveDay: string | null;
  /** Milestone awaiting celebration, or null. */
  milestone: number | null;
  celebrateMilestone: (m: number) => void;
  /** Give up on an open repair challenge. */
  declineRepair: () => void;
}

const EMPTY_VIEW: StreakView = {
  streak: 0,
  longestStreak: 0,
  freezes: 0,
  todayCount: 0,
  todayMet: false,
  remainingToday: 0,
  daysToNextFreeze: FREEZE_EVERY,
  repair: null,
};

export function useStreakManager(): StreakManager {
  const words = useAllWords();
  const [goal] = useDailyGoal();
  const [state, setState] = useState<StreakState | null>(null);

  const counts = useMemo(
    () => countsByDay(words.map((w) => w.createdAt)),
    [words]
  );
  const firstActiveDay = useMemo(() => {
    const keys = [...counts.keys()].sort();
    return keys.length ? keys[0] : null;
  }, [counts]);

  // Load the stored overlay once; a corrupt or absent payload starts fresh.
  useEffect(() => {
    let cancelled = false;
    getStreakStateRaw().then((raw) => {
      if (cancelled) return;
      const stored = raw as StreakState | null;
      setState(
        stored && stored.version === STREAK_STATE_VERSION ? stored : initialState()
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Advance through elapsed days and resolve repairs, then persist if changed.
  // Compared by value so this can't loop on its own output.
  useEffect(() => {
    if (!state || goal <= 0) return;
    const next = reconcile(state, counts, goal);
    if (JSON.stringify(next) !== JSON.stringify(state)) {
      setState(next);
      setStreakStateRaw(next);
    }
  }, [state, counts, goal]);

  const view = useMemo(
    () => (state && goal > 0 ? project(state, counts, goal) : EMPTY_VIEW),
    [state, counts, goal]
  );

  const milestone = useMemo(
    () => (state ? pendingMilestone(state, view.streak) : null),
    [state, view.streak]
  );

  const celebrateMilestone = useCallback((m: number) => {
    setState((prev) => {
      if (!prev || prev.celebrated.includes(m)) return prev;
      const next = { ...prev, celebrated: [...prev.celebrated, m] };
      setStreakStateRaw(next);
      return next;
    });
  }, []);

  const declineRepair = useCallback(() => {
    setState((prev) => {
      if (!prev || !prev.repair) return prev;
      const next = { ...prev, repair: null };
      setStreakStateRaw(next);
      return next;
    });
  }, []);

  return {
    ready: state !== null,
    view,
    state: state ?? initialState(),
    counts,
    firstActiveDay,
    milestone,
    celebrateMilestone,
    declineRepair,
  };
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

/**
 * The current Supabase auth session, if any — `null` means signed out (still
 * a fully valid, fully usable state; the app has no login requirement).
 * `loading` covers only the initial check, not later sign-in/out calls.
 */
export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

/**
 * Non-bypassable consent gate (Terms + Privacy), shown before onboarding.
 * `null` while the stored flag is still loading, so it never flashes.
 */
export function useConsent(): [boolean | null, () => void] {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  useEffect(() => {
    getConsentAccepted().then(setAccepted);
  }, []);
  const accept = () => {
    setAccepted(true);
    setConsentAccepted(true);
  };
  return [accepted, accept];
}

/** User-configurable notification email address. No backend acts on this yet. */
export function useNotifyEmail(): [string, (email: string) => void] {
  const [email, setEmail] = useState('');
  useFocusEffect(
    useCallback(() => {
      getNotifyEmail().then(setEmail);
    }, [])
  );
  const update = (next: string) => {
    setEmail(next);
    setNotifyEmail(next);
  };
  return [email, update];
}

/** Whether the user has opted into (future) email notifications. */
export function useNotifyEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(DEFAULT_NOTIFY_ENABLED);
  useFocusEffect(
    useCallback(() => {
      getNotifyEnabled().then(setEnabled);
    }, [])
  );
  const update = (next: boolean) => {
    setEnabled(next);
    setNotifyEnabled(next);
  };
  return [enabled, update];
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
