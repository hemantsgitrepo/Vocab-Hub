import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { observeWordCount } from '../db/words';
import { GAMES, GameDef, GameKey } from '../lib/games';
import { getCelebratedUnlocks, setCelebratedUnlocks } from '../db/settings';

// ---------------------------------------------------------------------------
// Watches the word count app-wide and fires a milestone celebration the moment
// a game crosses its unlock threshold. Detection lives here (a single provider)
// rather than in GameArcade, because the arcade is rendered on two tabs at once
// and would otherwise double-fire and race on persistence.
// ---------------------------------------------------------------------------

export interface Celebration {
  game: GameDef;
  /** Other games unlocked in the same batch, e.g. after a bulk CSV import. */
  alsoUnlocked: number;
}

interface UnlockContextValue {
  celebration: Celebration | null;
  dismiss: () => void;
}

const UnlockContext = createContext<UnlockContextValue>({
  celebration: null,
  dismiss: () => {},
});

export function useUnlockCelebration(): UnlockContextValue {
  return useContext(UnlockContext);
}

export function UnlockProvider({ children }: { children: React.ReactNode }) {
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [ready, setReady] = useState(false);
  // null → the stored list has never been initialized; seeded on first count.
  const seenRef = useRef<Set<GameKey> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCelebratedUnlocks().then((stored) => {
      if (cancelled) return;
      seenRef.current = stored === null ? null : new Set(stored as GameKey[]);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const sub = observeWordCount().subscribe((count) => {
      const unlocked = GAMES.filter((g) => count >= g.unlockAt);

      if (seenRef.current === null) {
        // First run after this feature shipped: treat whatever is already
        // unlocked as seen, so an existing collection doesn't trigger a burst
        // of celebrations for milestones the user passed long ago.
        const seeded = unlocked.map((g) => g.key);
        seenRef.current = new Set(seeded);
        setCelebratedUnlocks(seeded);
        return;
      }

      const seen = seenRef.current;
      const fresh = unlocked.filter((g) => !seen.has(g.key));
      if (fresh.length === 0) return;

      fresh.forEach((g) => seen.add(g.key));
      setCelebratedUnlocks([...seen]);
      // GAMES is ordered by threshold, so the last one is the biggest milestone.
      setCelebration({
        game: fresh[fresh.length - 1],
        alsoUnlocked: fresh.length - 1,
      });
    });
    return () => sub.unsubscribe();
  }, [ready]);

  const value = useMemo(
    () => ({ celebration, dismiss: () => setCelebration(null) }),
    [celebration]
  );

  return <UnlockContext.Provider value={value}>{children}</UnlockContext.Provider>;
}
