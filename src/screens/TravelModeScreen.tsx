import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, SegmentedButtons, Text } from 'react-native-paper';
import Tts from 'react-native-tts';
import {
  CheckSquare,
  Pause,
  Play,
  Repeat,
  SkipForward,
  Square,
} from 'lucide-react-native';
import Word from '../db/models/Word';
import { useAllWords } from '../hooks';
import { colors } from '../theme';

// Android's TTS treats rate 0.5 as normal speed; multiply for 0.8x / 1x / 1.25x.
const RATES: Record<string, number> = { '0.8': 0.4, '1': 0.5, '1.25': 0.625 };
const PITCHES: Record<string, number> = { low: 0.8, normal: 1, high: 1.2 };

export default function TravelModeScreen() {
  const words = useAllWords();
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
  const initialised = useRef(false);

  // Select everything once words first arrive; after that the user is in charge.
  useEffect(() => {
    if (!initialised.current && words.length > 0) {
      initialised.current = true;
      setSelected(new Set(words.map((w) => w.id)));
    }
  }, [words]);

  useEffect(() => {
    Tts.getInitStatus().catch(() => {});
    const done = () => resolveRef.current?.();
    const subs: any[] = [
      Tts.addEventListener('tts-finish', done),
      Tts.addEventListener('tts-cancel', done),
    ];
    return () => {
      playToken.current++;
      Tts.stop();
      subs.forEach((s) => s?.remove?.());
    };
  }, []);

  const speak = (text: string) =>
    new Promise<void>((resolve) => {
      resolveRef.current = resolve;
      Tts.speak(text);
    });

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const playlist = () => words.filter((w) => selected.has(w.id));

  const playFrom = async (start: number) => {
    const token = ++playToken.current;
    const list = playlist();
    if (list.length === 0) return;
    Tts.setDefaultRate(RATES[speed]);
    Tts.setDefaultPitch(PITCHES[pitch]);
    setIsPlaying(true);
    let i = start >= list.length ? 0 : start;
    while (token === playToken.current) {
      indexRef.current = i;
      const w = list[i];
      setCurrentId(w.id);
      // Sequence: word → short pause → meaning → example, like a podcast segment.
      await speak(w.word);
      if (token !== playToken.current) return;
      await wait(700);
      if (token !== playToken.current) return;
      await speak(w.meaning);
      if (token !== playToken.current) return;
      await wait(400);
      if (token !== playToken.current) return;
      if (w.exampleSentence) {
        await speak(w.exampleSentence);
        if (token !== playToken.current) return;
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
      setIsPlaying(false);
      setCurrentId(null);
    }
  };

  const stop = () => {
    playToken.current++;
    Tts.stop();
    setIsPlaying(false);
    setCurrentId(null);
  };

  const togglePlay = () => (isPlaying ? stop() : playFrom(indexRef.current));

  const skip = () => {
    if (!isPlaying) return;
    const next = indexRef.current + 1;
    playToken.current++;
    Tts.stop();
    playFrom(next >= playlist().length ? 0 : next);
  };

  const toggleWord = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = words.length > 0 && selected.size === words.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(words.map((w) => w.id)));

  const renderItem = ({ item }: { item: Word }) => {
    const active = item.id === currentId;
    return (
      <Pressable onPress={() => toggleWord(item.id)}>
        <Card style={[styles.wordCard, active && styles.wordCardActive]}>
          <Card.Content style={styles.wordRow}>
            {selected.has(item.id) ? (
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Travel mode
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Listen to your words back-to-back, hands-free.
        </Text>
      </View>

      {words.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Add some words first — then they'll show up here as a playlist.
          </Text>
        </View>
      ) : (
        <FlatList
          data={words}
          keyExtractor={(w) => w.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Button mode="text" onPress={toggleAll} compact style={styles.selectAll}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </Button>
          }
        />
      )}

      <View style={styles.player}>
        <View style={styles.controlLabels}>
          <Text variant="labelMedium" style={styles.controlLabel}>
            Speed
          </Text>
          <Text variant="labelMedium" style={styles.controlLabel}>
            Pitch
          </Text>
        </View>
        <View style={styles.controlRow}>
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
            style={[styles.roundBtn, loop && styles.roundBtnActive]}
          >
            <Repeat size={22} color={loop ? '#FFFFFF' : colors.primary} />
          </Pressable>
          <Pressable onPress={togglePlay} style={styles.playBtn}>
            {isPlaying ? (
              <Pause size={30} color="#FFFFFF" fill="#FFFFFF" />
            ) : (
              <Play size={30} color="#FFFFFF" fill="#FFFFFF" />
            )}
          </Pressable>
          <Pressable onPress={skip} style={styles.roundBtn}>
            <SkipForward size={22} color={colors.primary} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 16 },
  title: { color: colors.text, fontWeight: '700' },
  subtitle: { color: colors.muted, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', padding: 32 },
  emptyText: { color: colors.muted, textAlign: 'center' },
  list: { padding: 16, paddingBottom: 8 },
  selectAll: { alignSelf: 'flex-end' },
  wordCard: { backgroundColor: colors.surface, marginBottom: 8 },
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
  controlLabels: { flexDirection: 'row', gap: 8 },
  controlLabel: { flex: 1, color: colors.muted, marginBottom: 4 },
  controlRow: { flexDirection: 'row', gap: 8 },
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
});
