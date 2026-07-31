import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Vibration,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Blocks, Eraser, HelpCircle, Shuffle, Sparkles, Trophy, X } from 'lucide-react-native';
import { GAME_GUIDES } from '../../lib/guides';
import { InfoSheet } from '../../ui/InfoSheet';
import Word from '../../db/models/Word';
import Confetti from './Confetti';
import { getGameStat, setGameStat } from '../../db/settings';
import { playSfx } from '../../lib/sfx';
import {
  LETTER_PTS,
  ScrabbleRound,
  buildScrabbleRound,
  isPoolWord,
  scoreScrabble,
} from '../../lib/games';

// Warm wood-and-brass palette: a lamplit game parlor.
const C = {
  bgTop: '#2B1704',
  bgBottom: '#120800',
  tile: '#FBEED3',
  tileEdge: '#D9BE8C',
  tileInk: '#4A2B0A',
  slot: '#3D2409',
  slotBorder: '#5C3A14',
  gold: '#F5B93E',
  text: '#FFF4DF',
  muted: '#C4A276',
  green: '#34D399',
  red: '#F87171',
  dl: '#38BDF8',
  tl: '#818CF8',
  dw: '#FB923C',
  tw: '#F87171',
};

const ROUNDS = 5;
const BONUS_TINT: Record<string, string> = { DL: C.dl, TL: C.tl, DW: C.dw, TW: C.tw };

interface Props {
  visible: boolean;
  onClose: () => void;
  words: Word[];
}

interface Feedback {
  kind: 'ok' | 'bad' | 'info';
  text: string;
}

export default function ScrabbleGame({ visible, onClose, words }: Props) {
  const { width } = useWindowDimensions();

  const [round, setRound] = useState<ScrabbleRound | null>(null);
  const [roundNum, setRoundNum] = useState(1);
  // Placed tile = index into rack; null slot = empty.
  const [placed, setPlaced] = useState<(number | null)[]>(Array(7).fill(null));
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [done, setDone] = useState(false);
  const [best, setBest] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const shakeAnim = useMemo(() => new Animated.Value(0), []);
  const scorePop = useMemo(() => new Animated.Value(1), []);
  const rowGlow = useMemo(() => new Animated.Value(0), []);
  const resultAnim = useMemo(() => new Animated.Value(0), []);
  const rackAnims = useMemo(() => Array.from({ length: 7 }, () => new Animated.Value(0)), []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const dealRack = (num: number) => {
    setRound(buildScrabbleRound(words));
    setRoundNum(num);
    setPlaced(Array(7).fill(null));
    setFeedback(null);
    rowGlow.setValue(0);
    rackAnims.forEach((a) => a.setValue(0));
    Animated.stagger(
      60,
      rackAnims.map((a) =>
        Animated.spring(a, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true })
      )
    ).start();
  };

  useEffect(() => {
    if (!visible) return;
    setTotal(0);
    setDone(false);
    setNewBest(false);
    getGameStat('scrabble').then(setBest);
    dealRack(1);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!round) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <LinearGradient colors={[C.bgTop, C.bgBottom]} style={styles.bg}>
          <SafeAreaView style={styles.centerFill}>
            <Text variant="titleMedium" style={{ color: C.text }}>
              Add a few more words to deal a rack.
            </Text>
            <Pressable onPress={onClose}>
              <Text variant="labelLarge" style={styles.exitText}>
                Close
              </Text>
            </Pressable>
          </SafeAreaView>
        </LinearGradient>
      </Modal>
    );
  }

  const entryIndexes = placed.filter((i): i is number => i !== null);
  const entry = entryIndexes.map((i) => round.rack[i]).join('');
  const previewPts = entry.length >= 2 ? scoreScrabble(entry, round.bonuses) : 0;

  const placeTile = (rackIdx: number) => {
    if (placed.includes(rackIdx) || done) return;
    const slot = placed.indexOf(null);
    if (slot === -1) return;
    playSfx('tap');
    Vibration.vibrate(10);
    const next = [...placed];
    next[slot] = rackIdx;
    setPlaced(next);
    setFeedback(null);
  };

  const recallTile = (slot: number) => {
    if (placed[slot] === null || done) return;
    playSfx('tap');
    // Pull the tile and close the gap so the word stays contiguous.
    const next = placed.filter((_, i) => i !== slot);
    next.push(null);
    setPlaced(next);
    setFeedback(null);
  };

  const clearRow = () => {
    if (entry.length === 0) return;
    playSfx('tap');
    setPlaced(Array(7).fill(null));
    setFeedback(null);
  };

  const shuffleRack = () => {
    if (!round) return;
    playSfx('tap');
    const order = [...round.rack.keys()].sort(() => Math.random() - 0.5);
    const remap = new Map(order.map((oldIdx, newIdx) => [oldIdx, newIdx]));
    setRound({ ...round, rack: order.map((i) => round.rack[i]) });
    setPlaced(placed.map((p) => (p === null ? null : remap.get(p)!)));
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const advance = (added: number) => {
    const nextTotal = total + added;
    setTotal(nextTotal);
    if (roundNum >= ROUNDS) {
      timers.current.push(
        setTimeout(() => {
          setDone(true);
          playSfx('fanfare');
          Vibration.vibrate([0, 70, 70, 70, 70, 200]);
          resultAnim.setValue(0);
          Animated.spring(resultAnim, {
            toValue: 1,
            friction: 5,
            tension: 60,
            useNativeDriver: true,
          }).start();
          if (nextTotal > best) {
            setBest(nextTotal);
            setNewBest(true);
            setGameStat('scrabble', nextTotal);
          }
        }, 900)
      );
    } else {
      timers.current.push(setTimeout(() => dealRack(roundNum + 1), 1100));
    }
  };

  const submit = () => {
    if (done) return;
    if (entry.length < 3) {
      playSfx('error');
      Vibration.vibrate(50);
      shake();
      setFeedback({ kind: 'bad', text: 'Words need at least 3 letters.' });
      return;
    }
    if (!isPoolWord(entry, words)) {
      playSfx('error');
      Vibration.vibrate([0, 50, 40, 50]);
      shake();
      setFeedback({ kind: 'bad', text: `"${entry}" isn't in your learned words yet.` });
      return;
    }
    const pts = scoreScrabble(entry, round.bonuses);
    playSfx('success');
    Vibration.vibrate(35);
    setFeedback({ kind: 'ok', text: `${entry} · +${pts} pts!` });
    Animated.sequence([
      Animated.timing(rowGlow, { toValue: 1, duration: 180, useNativeDriver: false }),
      Animated.timing(rowGlow, { toValue: 0, duration: 600, useNativeDriver: false }),
    ]).start();
    Animated.sequence([
      Animated.timing(scorePop, { toValue: 1.3, duration: 140, useNativeDriver: true }),
      Animated.spring(scorePop, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    advance(pts);
  };

  const skip = () => {
    if (done) return;
    playSfx('tap');
    setFeedback({
      kind: 'info',
      text: `You could have played "${round.seedWord}". Next rack…`,
    });
    advance(0);
  };

  // ----- Layout -----
  const H_PAD = 14;
  const GAP = 6;
  const tileW = Math.floor((width - H_PAD * 2 - GAP * 6) / 7) - 1;
  const tileH = tileW * 1.12;

  const glowBorder = rowGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [C.slotBorder, C.gold],
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <LinearGradient colors={[C.bgTop, C.bgBottom]} style={styles.bg}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.headerBtn}>
              <X size={20} color={C.muted} />
            </Pressable>
            <Pressable
              onPress={() => {
                playSfx('tap');
                setHelpOpen(true);
              }}
              hitSlop={10}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="How Vocab Scrabble works"
            >
              <HelpCircle size={18} color={C.muted} />
            </Pressable>
            <View style={styles.headerCenter}>
              <View style={styles.titleRow}>
                <Blocks size={18} color={C.gold} />
                <Text variant="titleMedium" style={styles.title}>
                  Vocab Scrabble
                </Text>
              </View>
              <Text variant="labelSmall" style={styles.subtitle}>
                Rack {roundNum}/{ROUNDS}
                {best > 0 ? ` · best ${best}` : ''}
              </Text>
            </View>
            <View style={styles.headerScore}>
              <Animated.Text style={[styles.scoreText, { transform: [{ scale: scorePop }] }]}>
                {total}
              </Animated.Text>
              <Text variant="labelSmall" style={styles.subtitle}>
                pts
              </Text>
            </View>
          </View>

          <InfoSheet
            visible={helpOpen}
            onClose={() => setHelpOpen(false)}
            guide={GAME_GUIDES.scrabble}
          />

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text variant="bodySmall" style={styles.instructions}>
              Tap tiles to spell one of your learned words. Land letters on
              bonus squares for multipliers.
            </Text>

            {/* Play row */}
            <Animated.View
              style={[
                styles.playRow,
                {
                  gap: GAP,
                  transform: [
                    {
                      translateX: shakeAnim.interpolate({
                        inputRange: [-1, 1],
                        outputRange: [-8, 8],
                      }),
                    },
                  ],
                },
              ]}
            >
              {round.bonuses.map((bonus, slot) => {
                const rackIdx = placed[slot];
                return (
                  <Pressable key={slot} onPress={() => recallTile(slot)}>
                    <Animated.View
                      style={[
                        styles.slot,
                        { width: tileW, height: tileH, borderColor: glowBorder },
                        bonus !== null &&
                          rackIdx === null && { borderColor: BONUS_TINT[bonus] + '99' },
                      ]}
                    >
                      {rackIdx !== null ? (
                        <View style={[styles.tile, { width: tileW - 4, height: tileH - 4 }]}>
                          <Text style={styles.tileLetter}>{round.rack[rackIdx]}</Text>
                          <Text style={styles.tilePts}>{LETTER_PTS[round.rack[rackIdx]]}</Text>
                        </View>
                      ) : bonus !== null ? (
                        <Text style={[styles.bonusLabel, { color: BONUS_TINT[bonus] }]}>
                          {bonus}
                        </Text>
                      ) : null}
                    </Animated.View>
                  </Pressable>
                );
              })}
            </Animated.View>

            {/* Preview + feedback */}
            <View style={styles.previewRow}>
              {entry.length >= 2 && !feedback && (
                <Text variant="labelLarge" style={styles.preview}>
                  {entry} · {previewPts} pts if valid
                </Text>
              )}
              {feedback && (
                <Text
                  variant="labelLarge"
                  style={[
                    styles.preview,
                    feedback.kind === 'ok' && { color: C.green },
                    feedback.kind === 'bad' && { color: C.red },
                  ]}
                >
                  {feedback.text}
                </Text>
              )}
            </View>

            {/* Rack */}
            <View style={[styles.rackRow, { gap: GAP }]}>
              {round.rack.map((letter, i) => {
                const used = placed.includes(i);
                return (
                  <Animated.View
                    key={`${roundNum}-${i}`}
                    style={{
                      opacity: rackAnims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, used ? 0.25 : 1],
                      }),
                      transform: [
                        {
                          translateY: rackAnims[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [26, 0],
                          }),
                        },
                        { scale: used ? 0.92 : 1 },
                      ],
                    }}
                  >
                    <Pressable onPress={() => placeTile(i)} disabled={used}>
                      <View style={[styles.tile, { width: tileW, height: tileH }]}>
                        <Text style={styles.tileLetter}>{letter}</Text>
                        <Text style={styles.tilePts}>{LETTER_PTS[letter]}</Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            {/* Controls */}
            <View style={styles.controls}>
              <Pressable onPress={clearRow} style={styles.controlBtn}>
                <Eraser size={16} color={C.muted} />
                <Text variant="labelMedium" style={styles.controlText}>
                  Clear
                </Text>
              </Pressable>
              <Pressable onPress={shuffleRack} style={styles.controlBtn}>
                <Shuffle size={16} color={C.muted} />
                <Text variant="labelMedium" style={styles.controlText}>
                  Shuffle
                </Text>
              </Pressable>
              <Pressable onPress={submit}>
                <LinearGradient
                  colors={[C.gold, '#D97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtn}
                >
                  <Text variant="titleSmall" style={styles.submitText}>
                    Play word
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>

            <Pressable onPress={skip} hitSlop={8}>
              <Text variant="labelMedium" style={styles.skipText}>
                Stuck? Skip this rack (reveals a word)
              </Text>
            </Pressable>

            {/* Bonus legend */}
            <View style={styles.legend}>
              {(['DL', 'TL', 'DW', 'TW'] as const).map((b) => (
                <View key={b} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: BONUS_TINT[b] }]} />
                  <Text variant="labelSmall" style={styles.legendText}>
                    {b === 'DL'
                      ? '2× letter'
                      : b === 'TL'
                        ? '3× letter'
                        : b === 'DW'
                          ? '2× word'
                          : '3× word'}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Final score overlay */}
          {done && (
            <View style={styles.overlay}>
              <Animated.View
                style={[
                  styles.resultCard,
                  {
                    opacity: resultAnim,
                    transform: [
                      {
                        scale: resultAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.7, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.trophyHalo}>
                  <Trophy size={46} color={C.gold} fill={C.gold} />
                </View>
                <Text variant="headlineSmall" style={styles.resultTitle}>
                  Racks complete!
                </Text>
                <Text style={styles.resultScore}>
                  {total}
                  <Text style={styles.resultUnit}> pts</Text>
                </Text>
                {newBest && (
                  <View style={styles.newBestChip}>
                    <Sparkles size={14} color={C.tileInk} />
                    <Text variant="labelMedium" style={styles.newBestText}>
                      NEW BEST
                    </Text>
                  </View>
                )}
                <Text variant="bodyMedium" style={styles.resultBody}>
                  Every word you played came from your own vocabulary.
                </Text>
                <Pressable
                  onPress={() => {
                    setDone(false);
                    setTotal(0);
                    setNewBest(false);
                    dealRack(1);
                  }}
                >
                  <LinearGradient
                    colors={[C.gold, '#D97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.againBtn}
                  >
                    <Blocks size={18} color={C.tileInk} />
                    <Text variant="titleMedium" style={styles.againText}>
                      New racks
                    </Text>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={onClose} hitSlop={8}>
                  <Text variant="labelLarge" style={styles.exitText}>
                    Back to studying
                  </Text>
                </Pressable>
              </Animated.View>
              <Confetti count={34} />
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  headerBtn: { width: 40, alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: C.text, fontWeight: '800' },
  subtitle: { color: C.muted, marginTop: 2 },
  headerScore: { width: 52, alignItems: 'center' },
  scoreText: { color: C.gold, fontSize: 22, fontWeight: '800' },
  body: { paddingHorizontal: 14, paddingBottom: 30 },
  instructions: { color: C.muted, textAlign: 'center', marginTop: 10, lineHeight: 18 },
  playRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  slot: {
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: C.slot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bonusLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  tile: {
    backgroundColor: C.tile,
    borderRadius: 8,
    borderBottomWidth: 3,
    borderBottomColor: C.tileEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLetter: { color: C.tileInk, fontSize: 22, fontWeight: '800' },
  tilePts: {
    position: 'absolute',
    bottom: 3,
    right: 5,
    color: C.tileInk,
    fontSize: 9,
    fontWeight: '700',
    opacity: 0.7,
  },
  previewRow: { minHeight: 30, justifyContent: 'center', marginTop: 12 },
  preview: { color: C.gold, textAlign: 'center' },
  rackRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 6 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 20,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.slotBorder,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  controlText: { color: C.muted, fontWeight: '700' },
  submitBtn: {
    borderRadius: 22,
    paddingVertical: 11,
    paddingHorizontal: 24,
  },
  submitText: { color: C.tileInk, fontWeight: '800' },
  skipText: { color: C.muted, textAlign: 'center', marginTop: 18, textDecorationLine: 'underline' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 22,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: C.muted },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#120800EE',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resultCard: { alignItems: 'center' },
  trophyHalo: {
    backgroundColor: C.gold + '1A',
    borderRadius: 44,
    padding: 18,
    borderWidth: 1,
    borderColor: C.gold + '40',
    marginBottom: 12,
  },
  resultTitle: { color: C.text, fontWeight: '800' },
  resultScore: { color: C.gold, fontSize: 44, fontWeight: '800', marginTop: 4 },
  resultUnit: { fontSize: 18, color: C.muted },
  newBestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  newBestText: { color: C.tileInk, fontWeight: '800', letterSpacing: 0.5 },
  resultBody: { color: C.muted, textAlign: 'center', marginTop: 10, lineHeight: 21 },
  againBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 26,
    paddingVertical: 13,
    paddingHorizontal: 28,
    marginTop: 22,
  },
  againText: { color: C.tileInk, fontWeight: '800' },
  exitText: { color: C.muted, marginTop: 16, textAlign: 'center' },
});
