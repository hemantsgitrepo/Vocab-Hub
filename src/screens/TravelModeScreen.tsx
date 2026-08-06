import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, SegmentedButtons, Text } from 'react-native-paper';
import Tts from 'react-native-tts';
import {
  CheckSquare,
  Headphones,
  Pause,
  Play,
  Repeat,
  SkipForward,
  Square,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import Word from '../db/models/Word';
import { useAllWords, useTravelFields } from '../hooks';
import { TRAVEL_FIELDS, TravelField } from '../db/settings';
import { initTts } from '../lib/tts';
import {
  hidePlaybackNotification,
  onPlaybackAction,
  requestPlaybackNotificationPermission,
  showPlaybackNotification,
} from '../lib/playbackNotification';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import { TRAVEL_GUIDE } from '../lib/guides';
import {
  CategoryKey,
  TRAVEL_CATEGORIES,
  categoryCounts,
  categoryFor,
} from '../lib/travelCategories';
import { useInfoSheet } from '../ui/InfoSheet';
import EmptyState from '../ui/EmptyState';

/** Builds the spoken segments for one word, in canonical field order. */
function segmentsFor(w: Word, enabled: TravelField[]): string[] {
  const text: Record<TravelField, string> = {
    word: w.word,
    meaning: w.meaning,
    synonyms: w.synonyms.length ? `Synonyms: ${w.synonyms.join(', ')}` : '',
    antonyms: w.antonyms.length ? `Antonyms: ${w.antonyms.join(', ')}` : '',
    example: w.exampleSentence,
    layman: w.laymanExplanation ?? '',
  };
  return TRAVEL_FIELDS.filter((f) => enabled.includes(f.key))
    .map((f) => text[f.key])
    .filter((t) => t.trim().length > 0);
}

// Android's TTS treats rate 0.5 as normal speed; multiply for 0.8x / 1x / 1.25x.
const RATES: Record<string, number> = { '0.8': 0.4, '1': 0.5, '1.25': 0.625 };
const PITCHES: Record<string, number> = { low: 0.8, normal: 1, high: 1.2 };

export default function TravelModeScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const help = useInfoSheet(TRAVEL_GUIDE);
  const words = useAllWords();
  const [travelFields] = useTravelFields();
  const [category, setCategory] = useState<CategoryKey>('all');
  // Words the user has hand-removed from the current category. Tracking
  // exclusions rather than inclusions means words added later are picked up
  // automatically, and clearing refinements is just an empty set.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [speed, setSpeed] = useState('1');
  const [pitch, setPitch] = useState('normal');
  const [loop, setLoop] = useState(false);

  const playToken = useRef(0);
  const resolveRef = useRef<(() => void) | null>(null);
  const indexRef = useRef(0);
  const loopRef = useRef(loop);
  loopRef.current = loop;
  // Read inside the async playback loop, so mid-session edits take effect.
  const fieldsRef = useRef(travelFields);
  fieldsRef.current = travelFields;

  // Recomputed per render pass rather than per tick: category membership only
  // shifts at a day boundary, so a stable value keeps the list from churning.
  const now = useMemo(() => new Date(), [words]);
  const counts = useMemo(() => categoryCounts(words, now), [words, now]);
  const activeCategory = categoryFor(category);
  const inCategory = useMemo(
    () => words.filter((w) => activeCategory.match(w, now)),
    [words, activeCategory, now]
  );
  const queue = useMemo(
    () => inCategory.filter((w) => !excluded.has(w.id)),
    [inCategory, excluded]
  );

  /**
   * Ends the wait for the current utterance. Clearing the ref first means a
   * late event from an already-finished utterance can't resolve the *next*
   * segment's promise early.
   */
  const finishSegment = useCallback(() => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.();
  }, []);

  useEffect(() => {
    initTts();
    const subs: any[] = [
      Tts.addEventListener('tts-finish', finishSegment),
      Tts.addEventListener('tts-cancel', finishSegment),
      // Without this a failed utterance would leave the loop awaiting forever.
      Tts.addEventListener('tts-error', finishSegment),
    ];
    return () => {
      playToken.current++;
      Tts.stop();
      subs.forEach((s) => s?.remove?.());
    };
  }, [finishSegment]);

  const speak = (text: string) =>
    new Promise<void>((resolve) => {
      resolveRef.current = resolve;
      // speak() rejects on Android when the engine refuses the utterance, and
      // no event follows — skip that segment rather than stalling the whole
      // playlist. (Its typings claim an utteranceId; it returns the promise.)
      Promise.resolve(Tts.speak(text) as unknown).catch(finishSegment);
    });

  // RN timers pause while the Android activity is paused (screen locked or app
  // backgrounded), which would stall the playback loop between utterances. Off
  // screen the pause intervals are skipped so playback chains directly off the
  // tts-finish events, which keep firing in the background.
  const pendingWait = useRef<{ resolve: () => void; timer: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && pendingWait.current) {
        clearTimeout(pendingWait.current.timer);
        const { resolve } = pendingWait.current;
        pendingWait.current = null;
        resolve();
      }
    });
    return () => sub.remove();
  }, []);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      if (AppState.currentState !== 'active') {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        pendingWait.current = null;
        resolve();
      }, ms);
      pendingWait.current = { resolve, timer };
    });

  // Push rate/pitch to the engine as soon as they change, so adjusting them
  // mid-playback takes effect from the next segment instead of needing a
  // stop/start. The engine applies these per utterance, so the one currently
  // being spoken finishes at its original setting.
  useEffect(() => {
    Tts.setDefaultRate(RATES[speed]);
    Tts.setDefaultPitch(PITCHES[pitch]);
  }, [speed, pitch]);

  // Read through a ref so the async playback loop and the notification
  // handlers always see the current queue, not their mount-time closure.
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const playlist = () => queueRef.current;

  // Last content pushed to the notification, so pausing can redraw it with a
  // Play button instead of losing the word it was sitting on.
  const notificationContent = useRef<{ title: string; body: string } | null>(null);

  const playFrom = async (start: number) => {
    const token = ++playToken.current;
    const list = playlist();
    if (list.length === 0) return;
    // Asked on first play rather than at launch, so the prompt arrives with
    // the context that explains it.
    await requestPlaybackNotificationPermission();
    if (token !== playToken.current) return;
    Tts.setDefaultRate(RATES[speed]);
    Tts.setDefaultPitch(PITCHES[pitch]);
    setIsPlaying(true);
    let i = start >= list.length ? 0 : start;
    while (token === playToken.current) {
      indexRef.current = i;
      const w = list[i];
      setCurrentId(w.id);
      notificationContent.current = {
        title: w.word,
        body: `Word ${i + 1} of ${list.length}`,
      };
      void showPlaybackNotification({ ...notificationContent.current, isPlaying: true });
      // Only the fields enabled in Settings, with a short pause between each.
      const segments = segmentsFor(w, fieldsRef.current);
      for (let s = 0; s < segments.length; s++) {
        await speak(segments[s]);
        if (token !== playToken.current) return;
        if (s < segments.length - 1) {
          await wait(600);
          if (token !== playToken.current) return;
        }
      }
      await wait(1200);
      if (token !== playToken.current) return;
      i++;
      if (i >= list.length) {
        if (!loopRef.current) break;
        i = 0;
      }
    }
    if (token === playToken.current) {
      // Reached the end — rewind so the next play starts the playlist over
      // instead of replaying the final word.
      indexRef.current = 0;
      setIsPlaying(false);
      setCurrentId(null);
      notificationContent.current = null;
      void hidePlaybackNotification();
    }
  };

  /** Pauses: the playlist position is kept so play resumes where it left off. */
  const stop = () => {
    playToken.current++;
    Tts.stop();
    setIsPlaying(false);
    setCurrentId(null);
    // Keep the notification up showing a Play button, so playback can be
    // resumed from the shade without reopening the app.
    if (notificationContent.current) {
      void showPlaybackNotification({ ...notificationContent.current, isPlaying: false });
    }
  };

  /** Ends the session outright and tears the foreground service down. */
  const stopPlayback = () => {
    playToken.current++;
    Tts.stop();
    setIsPlaying(false);
    setCurrentId(null);
    indexRef.current = 0;
    notificationContent.current = null;
    void hidePlaybackNotification();
  };

  const togglePlay = () => {
    if (!isPlaying && travelFields.length === 0) return;
    isPlaying ? stop() : playFrom(indexRef.current);
  };

  const skip = () => {
    if (!isPlaying) return;
    const next = indexRef.current + 1;
    playToken.current++;
    Tts.stop();
    playFrom(next >= playlist().length ? 0 : next);
  };

  // The notification subscription is registered once, so route presses through
  // a ref to reach the current handlers rather than the mount-time closures.
  const controls = useRef({ togglePlay, skip, stopPlayback });
  controls.current = { togglePlay, skip, stopPlayback };

  useEffect(() => {
    const unsubscribe = onPlaybackAction((action) => {
      if (action === 'toggle') controls.current.togglePlay();
      else if (action === 'next') controls.current.skip();
      else controls.current.stopPlayback();
    });
    return () => {
      unsubscribe();
      // Leaving the screen must not strand a foreground service.
      void hidePlaybackNotification();
    };
  }, []);

  const toggleWord = (id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = inCategory.length > 0 && queue.length === inCategory.length;
  const toggleAll = () =>
    setExcluded(allSelected ? new Set(inCategory.map((w) => w.id)) : new Set());

  /**
   * Switching category swaps the whole playlist, so any hand-refinements are
   * dropped and a running session is ended — resuming into a different list
   * would leave the saved position pointing at the wrong word.
   */
  const pickCategory = (key: CategoryKey) => {
    if (key === category) return;
    setCategory(key);
    setExcluded(new Set());
    if (isPlaying) stopPlayback();
  };

  // Fade + lift the list whenever the category changes, so a swapped playlist
  // reads as new content arriving rather than an abrupt repaint.
  const enter = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [category, enter]);

  const enterStyle = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
    ],
  };

  const renderItem = ({ item }: { item: Word }) => {
    const active = item.id === currentId;
    const included = !excluded.has(item.id);
    return (
      <Pressable
        onPress={() => toggleWord(item.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: included }}
        accessibilityLabel={item.word}
      >
        <Card
          style={[
            styles.wordCard,
            !included && styles.wordCardExcluded,
            active && styles.wordCardActive,
          ]}
        >
          <Card.Content style={styles.wordRow}>
            {included ? (
              <CheckSquare size={22} color={colors.primary} />
            ) : (
              <Square size={22} color={colors.muted} />
            )}
            <View style={styles.wordTextWrap}>
              <Text variant="titleMedium" style={styles.wordText}>
                {item.word}
              </Text>
              <Text variant="bodySmall" numberOfLines={1} style={styles.wordMeaning}>
                {item.meaning}
              </Text>
            </View>
            {active && <Text style={styles.nowPlaying}>▶</Text>}
          </Card.Content>
        </Card>
      </Pressable>
    );
  };

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="headlineMedium" style={styles.title}>
            Travel mode
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Listen to your words back-to-back, hands-free.
          </Text>
        </View>
        {help.button}
      </View>

      {words.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            Icon={Headphones}
            title="Nothing queued yet"
            message="Travel Mode reads your collection aloud so you can revise while commuting, walking or cooking. Add a few words and they'll queue up here automatically."
            actionLabel="Add your first word"
            onAction={() => navigation.navigate('Add')}
            footnote="Tap ? above to see how playback works"
          />
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // A horizontal ScrollView in a column parent stretches to fill the
            // free vertical space unless its growth is pinned.
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            {TRAVEL_CATEGORIES.map((c) => {
              const on = c.key === category;
              const count = counts[c.key];
              return (
                <Pressable
                  key={c.key}
                  onPress={() => pickCategory(c.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${c.label}, ${count} words`}
                  style={({ pressed }) => [
                    styles.chip,
                    on && styles.chipOn,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <c.Icon size={15} color={on ? '#FFFFFF' : colors.primary} />
                  <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>
                    {c.label}
                  </Text>
                  <View style={[styles.chipCount, on && styles.chipCountOn]}>
                    <Text style={[styles.chipCountText, on && styles.chipCountTextOn]}>
                      {count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <Animated.View style={[styles.flex, enterStyle]}>
            {inCategory.length === 0 ? (
              <View style={styles.categoryEmpty}>
                <activeCategory.Icon size={30} color={colors.muted} />
                <Text variant="titleMedium" style={styles.categoryEmptyTitle}>
                  Nothing in {activeCategory.label.toLowerCase()}
                </Text>
                <Text variant="bodySmall" style={styles.categoryEmptyBody}>
                  {activeCategory.emptyHint}
                </Text>
              </View>
            ) : (
              <FlatList
                data={inCategory}
                keyExtractor={(w) => w.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                  <View style={styles.listHeader}>
                    <Text variant="labelLarge" style={styles.queueCount}>
                      {queue.length === inCategory.length
                        ? `${inCategory.length} word${inCategory.length === 1 ? '' : 's'} queued`
                        : `${queue.length} of ${inCategory.length} queued`}
                    </Text>
                    <Button mode="text" onPress={toggleAll} compact>
                      {allSelected ? 'Clear' : 'Select all'}
                    </Button>
                  </View>
                }
              />
            )}
          </Animated.View>
        </>
      )}

      <View style={styles.player}>
        <Text variant="labelMedium" style={styles.fieldSummary}>
          {travelFields.length === 0
            ? 'No fields selected — pick some in Settings'
            : `Playing: ${TRAVEL_FIELDS.filter((f) => travelFields.includes(f.key))
                .map((f) => f.label.toLowerCase())
                .join(' · ')}`}
        </Text>
        <View style={styles.controlRow}>
          <Text variant="labelMedium" style={styles.controlLabel}>
            Speed
          </Text>
          <SegmentedButtons
            value={speed}
            onValueChange={setSpeed}
            density="small"
            style={styles.flex}
            buttons={[
              { value: '0.8', label: '0.8x', showSelectedCheck: false },
              { value: '1', label: '1x', showSelectedCheck: false },
              { value: '1.25', label: '1.25x', showSelectedCheck: false },
            ]}
          />
        </View>
        <View style={styles.controlRow}>
          <Text variant="labelMedium" style={styles.controlLabel}>
            Pitch
          </Text>
          <SegmentedButtons
            value={pitch}
            onValueChange={setPitch}
            density="small"
            style={styles.flex}
            buttons={[
              { value: 'low', label: 'Low', showSelectedCheck: false },
              { value: 'normal', label: 'Mid', showSelectedCheck: false },
              { value: 'high', label: 'High', showSelectedCheck: false },
            ]}
          />
        </View>
        <View style={styles.buttonsRow}>
          <Pressable
            onPress={() => setLoop((l) => !l)}
            accessibilityRole="button"
            accessibilityLabel="Loop playlist"
            accessibilityState={{ selected: loop }}
            style={[styles.roundBtn, loop && styles.roundBtnActive]}
          >
            <Repeat size={22} color={loop ? '#FFFFFF' : colors.primary} />
          </Pressable>
          <Pressable
            onPress={togglePlay}
            disabled={travelFields.length === 0}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            style={[styles.playBtn, travelFields.length === 0 && styles.playBtnDisabled]}
          >
            {isPlaying ? (
              <Pause size={30} color="#FFFFFF" fill="#FFFFFF" />
            ) : (
              <Play size={30} color="#FFFFFF" fill="#FFFFFF" />
            )}
          </Pressable>
          <Pressable
            onPress={skip}
            accessibilityRole="button"
            accessibilityLabel="Skip to next word"
            style={styles.roundBtn}
          >
            <SkipForward size={22} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {help.sheet}
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerText: { flex: 1 },
  title: { color: colors.text, fontWeight: '700' },
  subtitle: { color: colors.muted, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 8 },
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 12,
    paddingRight: 8,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipPressed: { opacity: 0.7 },
  chipLabel: { color: colors.text, fontWeight: '600', fontSize: 13 },
  chipLabelOn: { color: '#FFFFFF' },
  chipCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  chipCountOn: { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipCountText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  chipCountTextOn: { color: '#FFFFFF' },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 6,
  },
  queueCount: { color: colors.muted },
  categoryEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  categoryEmptyTitle: { color: colors.text, fontWeight: '600' },
  categoryEmptyBody: { color: colors.muted, textAlign: 'center' },
  wordCard: { backgroundColor: colors.surface, marginBottom: 8 },
  wordCardExcluded: { opacity: 0.55 },
  wordCardActive: { borderWidth: 2, borderColor: colors.primary },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wordTextWrap: { flex: 1 },
  wordText: { color: colors.text, fontWeight: '600' },
  wordMeaning: { color: colors.muted },
  nowPlaying: { color: colors.primary, fontSize: 16 },
  player: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 12,
    elevation: 8,
  },
  fieldSummary: { color: colors.muted, textAlign: 'center', marginBottom: 10 },
  controlLabel: { width: 48, color: colors.muted },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginTop: 14,
  },
  roundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnActive: { backgroundColor: colors.primary },
  playBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  playBtnDisabled: { backgroundColor: colors.muted },
});
