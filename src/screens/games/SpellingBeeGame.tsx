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
import Svg, { Polygon } from 'react-native-svg';
import {
  Delete,
  HelpCircle,
  Hexagon,
  Lightbulb,
  Shuffle,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react-native';
import { GAME_GUIDES } from '../../lib/guides';
import { InfoSheet } from '../../ui/InfoSheet';
import Word from '../../db/models/Word';
import Confetti from './Confetti';
import { getGameStat, setGameStat } from '../../db/settings';
import { playSfx } from '../../lib/sfx';
import { BeeRound, beePoints, buildBeeRound } from '../../lib/games';

// Midnight-hive palette: black comb, honey gold.
const C = {
  bgTop: '#1C1403',
  bgBottom: '#0A0701',
  honey: '#FFC529',
  honeyDeep: '#E8A200',
  comb: '#3A2E10',
  combBorder: '#57461C',
  text: '#FFF7E0',
  muted: '#BFA45E',
  green: '#4ADE80',
  red: '#F87171',
  ink: '#3A2703',
};

const HEX_R = 46; // circumradius of each hex cell

interface Props {
  visible: boolean;
  onClose: () => void;
  words: Word[];
}

/** Pointy-top hexagon corner points around (cx, cy). */
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
}

export default function SpellingBeeGame({ visible, onClose, words }: Props) {
  const { width } = useWindowDimensions();

  const [round, setRound] = useState<BeeRound | null>(null);
  const [entry, setEntry] = useState('');
  const [found, setFound] = useState<string[]>([]);
  const [points, setPoints] = useState(0);
  const [notice, setNotice] = useState<{ text: string; good: boolean } | null>(null);
  const [pangramFlash, setPangramFlash] = useState(false);
  const [won, setWon] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [clue, setClue] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const entryShake = useMemo(() => new Animated.Value(0), []);
  const entryPop = useMemo(() => new Animated.Value(1), []);
  const hiveSpin = useMemo(() => new Animated.Value(0), []);
  const pangramAnim = useMemo(() => new Animated.Value(0), []);
  const resultAnim = useMemo(() => new Animated.Value(0), []);
  const hexAnims = useMemo(() => Array.from({ length: 7 }, () => new Animated.Value(0)), []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const newHive = () => {
    clearTimers();
    setRound(buildBeeRound(words));
    setEntry('');
    setFound([]);
    setPoints(0);
    setNotice(null);
    setClue(null);
    setWon(false);
    setNewBest(false);
    hexAnims.forEach((a) => a.setValue(0));
    Animated.stagger(
      70,
      hexAnims.map((a) =>
        Animated.spring(a, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true })
      )
    ).start();
  };

  useEffect(() => {
    if (!visible) return;
    getGameStat('bee').then(setBest);
    newHive();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!round) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <LinearGradient colors={[C.bgTop, C.bgBottom]} style={styles.bg}>
          <SafeAreaView style={styles.centerFill}>
            <Hexagon size={40} color={C.muted} />
            <Text variant="titleMedium" style={{ color: C.text, textAlign: 'center' }}>
              The hive needs more nectar.{'\n'}Add a few more words first!
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

  const outer = round.letters.slice(1);

  const flashNotice = (text: string, good: boolean) => {
    setNotice({ text, good });
    timers.current.push(setTimeout(() => setNotice(null), 1700));
  };

  const shakeEntry = () => {
    Animated.sequence([
      Animated.timing(entryShake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(entryShake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(entryShake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(entryShake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const tapLetter = (letter: string) => {
    if (won) return;
    playSfx('tap');
    Vibration.vibrate(9);
    setEntry((e) => (e.length >= 14 ? e : e + letter));
    Animated.sequence([
      Animated.timing(entryPop, { toValue: 1.12, duration: 80, useNativeDriver: true }),
      Animated.spring(entryPop, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  const backspace = () => {
    if (won) return;
    playSfx('tap');
    setEntry((e) => e.slice(0, -1));
  };

  const spinHive = () => {
    if (won) return;
    playSfx('tap');
    hiveSpin.setValue(0);
    Animated.timing(hiveSpin, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      hiveSpin.setValue(0);
      setRound((r) =>
        r ? { ...r, letters: [r.center, ...[...outer].sort(() => Math.random() - 0.5)] } : r
      );
    });
  };

  const revealClue = () => {
    playSfx('tap');
    const unfound = round.answers.filter((a) => !found.includes(a));
    if (unfound.length === 0) return;
    const target = unfound[Math.floor(Math.random() * unfound.length)];
    const w = words.find((x) => x.word.toUpperCase().trim() === target);
    setClue(w ? `${target.length} letters — ${w.meaning}` : `${target.length} letters`);
  };

  const submit = () => {
    if (won || entry.length === 0) return;
    if (entry.length < 4) {
      playSfx('error');
      Vibration.vibrate(45);
      shakeEntry();
      flashNotice('Too short — 4 letters minimum.', false);
      setEntry('');
      return;
    }
    if (!entry.includes(round.center)) {
      playSfx('error');
      Vibration.vibrate(45);
      shakeEntry();
      flashNotice(`Must use the golden ${round.center}.`, false);
      setEntry('');
      return;
    }
    if (found.includes(entry)) {
      playSfx('error');
      shakeEntry();
      flashNotice('Already found!', false);
      setEntry('');
      return;
    }
    if (!round.answers.includes(entry)) {
      playSfx('error');
      Vibration.vibrate([0, 45, 40, 45]);
      shakeEntry();
      flashNotice("Not one of your learned words.", false);
      setEntry('');
      return;
    }

    const isPangram = round.pangrams.includes(entry);
    const pts = beePoints(entry, isPangram);
    const nextFound = [...found, entry];
    const nextPoints = points + pts;
    setFound(nextFound);
    setPoints(nextPoints);
    setEntry('');
    setClue(null);

    if (isPangram) {
      playSfx('fanfare');
      Vibration.vibrate([0, 60, 50, 60, 50, 180]);
      setPangramFlash(true);
      pangramAnim.setValue(0);
      Animated.spring(pangramAnim, {
        toValue: 1,
        friction: 5,
        tension: 70,
        useNativeDriver: true,
      }).start();
      timers.current.push(setTimeout(() => setPangramFlash(false), 2400));
      flashNotice(`PANGRAM! +${pts} pts`, true);
    } else {
      playSfx('success');
      Vibration.vibrate(30);
      flashNotice(`${entry} · +${pts} pts`, true);
    }

    if (nextFound.length === round.answers.length) {
      timers.current.push(
        setTimeout(() => {
          setWon(true);
          playSfx('fanfare');
          resultAnim.setValue(0);
          Animated.spring(resultAnim, {
            toValue: 1,
            friction: 5,
            tension: 60,
            useNativeDriver: true,
          }).start();
          if (nextPoints > best) {
            setBest(nextPoints);
            setNewBest(true);
            setGameStat('bee', nextPoints);
          }
        }, isPangram ? 1600 : 700)
      );
    }
  };

  // ----- Honeycomb geometry (pointy-top, center + 6 neighbours) -----
  const hexW = Math.sqrt(3) * HEX_R;
  const boardW = Math.min(width - 40, hexW * 3 + 8);
  const cx = boardW / 2;
  const cy = HEX_R * 2.55;
  const boardH = cy * 2;
  const ring = Array.from({ length: 6 }, (_, i) => {
    // Neighbor directions for pointy-top hexes are perpendicular to the
    // edges (60°k), not the corners — 30° off and the combs overlap.
    const a = (Math.PI / 180) * (60 * i);
    const d = hexW + 4;
    return { x: cx + d * Math.cos(a), y: cy + d * Math.sin(a) };
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
              accessibilityLabel="How Spelling Bee works"
            >
              <HelpCircle size={18} color={C.muted} />
            </Pressable>
            <View style={styles.headerCenter}>
              <View style={styles.titleRow}>
                <Hexagon size={18} color={C.honey} />
                <Text variant="titleMedium" style={styles.title}>
                  Spelling Bee
                </Text>
              </View>
              <Text variant="labelSmall" style={styles.subtitle}>
                {found.length}/{round.answers.length} words · {points} pts
                {best > 0 ? ` · best ${best}` : ''}
              </Text>
            </View>
            <Pressable onPress={revealClue} hitSlop={10} style={styles.headerBtn}>
              <Lightbulb size={18} color={C.muted} />
            </Pressable>
          </View>

          <InfoSheet
            visible={helpOpen}
            onClose={() => setHelpOpen(false)}
            guide={GAME_GUIDES.bee}
          />

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Entry line */}
            <Animated.View
              style={[
                styles.entryRow,
                {
                  transform: [
                    {
                      translateX: entryShake.interpolate({
                        inputRange: [-1, 1],
                        outputRange: [-8, 8],
                      }),
                    },
                    { scale: entryPop },
                  ],
                },
              ]}
            >
              {entry.length === 0 ? (
                <Text style={styles.entryPlaceholder}>Tap the comb to spell…</Text>
              ) : (
                <Text style={styles.entryText}>
                  {entry.split('').map((l, i) => (
                    <Text
                      key={i}
                      style={l === round.center ? { color: C.honey } : undefined}
                    >
                      {l}
                    </Text>
                  ))}
                  <Text style={styles.caret}>|</Text>
                </Text>
              )}
            </Animated.View>

            {/* Notice / clue */}
            <View style={styles.noticeRow}>
              {notice && (
                <Text
                  variant="labelLarge"
                  style={[styles.notice, { color: notice.good ? C.green : C.red }]}
                >
                  {notice.text}
                </Text>
              )}
              {!notice && clue && (
                <Text variant="labelMedium" style={styles.clueText}>
                  💡 {clue}
                </Text>
              )}
            </View>

            {/* Honeycomb */}
            <Animated.View
              style={{
                width: boardW,
                height: boardH,
                alignSelf: 'center',
                transform: [
                  {
                    rotate: hiveSpin.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg'],
                    }),
                  },
                ],
              }}
            >
              <Svg width={boardW} height={boardH}>
                {ring.map((p, i) => (
                  <Polygon
                    key={i}
                    points={hexPoints(p.x, p.y, HEX_R - 2)}
                    fill={C.comb}
                    stroke={C.combBorder}
                    strokeWidth={2}
                  />
                ))}
                <Polygon
                  points={hexPoints(cx, cy, HEX_R - 2)}
                  fill={C.honey}
                  stroke={C.honeyDeep}
                  strokeWidth={2.5}
                />
              </Svg>
              {/* Letter overlays (counter-rotate so glyphs stay upright) */}
              {[{ x: cx, y: cy, letter: round.center, center: true },
                ...ring.map((p, i) => ({ ...p, letter: outer[i], center: false }))].map(
                (h, i) => (
                  <Animated.View
                    key={`${h.letter}-${i}`}
                    style={[
                      styles.hexTouch,
                      {
                        left: h.x - HEX_R * 0.75,
                        top: h.y - HEX_R * 0.75,
                        width: HEX_R * 1.5,
                        height: HEX_R * 1.5,
                        opacity: hexAnims[i],
                        transform: [
                          { scale: hexAnims[i] },
                          {
                            rotate: hiveSpin.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '-180deg'],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => tapLetter(h.letter)}
                      style={styles.hexPress}
                      hitSlop={4}
                    >
                      {({ pressed }) => (
                        <Text
                          style={[
                            styles.hexLetter,
                            h.center && { color: C.ink },
                            pressed && { transform: [{ scale: 1.25 }] },
                          ]}
                        >
                          {h.letter}
                        </Text>
                      )}
                    </Pressable>
                  </Animated.View>
                )
              )}
            </Animated.View>

            {/* Controls */}
            <View style={styles.controls}>
              <Pressable onPress={backspace} style={styles.controlBtn}>
                <Delete size={16} color={C.muted} />
                <Text variant="labelMedium" style={styles.controlText}>
                  Delete
                </Text>
              </Pressable>
              <Pressable onPress={spinHive} style={styles.controlBtn}>
                <Shuffle size={16} color={C.muted} />
                <Text variant="labelMedium" style={styles.controlText}>
                  Shuffle
                </Text>
              </Pressable>
              <Pressable onPress={submit}>
                <LinearGradient
                  colors={[C.honey, C.honeyDeep]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtn}
                >
                  <Text variant="titleSmall" style={styles.submitText}>
                    Enter
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>

            {/* Found words */}
            {found.length > 0 && (
              <View style={styles.foundWrap}>
                {found.map((w) => (
                  <View
                    key={w}
                    style={[
                      styles.foundChip,
                      round.pangrams.includes(w) && styles.foundChipPangram,
                    ]}
                  >
                    <Text
                      variant="labelMedium"
                      style={[
                        styles.foundText,
                        round.pangrams.includes(w) && { color: C.ink },
                      ]}
                    >
                      {w}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text variant="labelSmall" style={styles.rules}>
              Words use only these 7 letters and must include the golden center.
              {round.pangrams.length > 0 ? ' One of them uses all seven…' : ''}
            </Text>
          </ScrollView>

          {/* Pangram flash */}
          {pangramFlash && (
            <View pointerEvents="none" style={styles.pangramLayer}>
              <Animated.View
                style={{
                  opacity: pangramAnim,
                  transform: [
                    {
                      scale: pangramAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 1],
                      }),
                    },
                  ],
                }}
              >
                <Text style={styles.pangramText}>PANGRAM!</Text>
              </Animated.View>
              <Confetti count={40} />
            </View>
          )}

          {/* Victory overlay */}
          {won && (
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
                  <Trophy size={46} color={C.honey} fill={C.honey} />
                </View>
                <Text variant="headlineSmall" style={styles.resultTitle}>
                  Hive cleared!
                </Text>
                <Text style={styles.resultScore}>
                  {points}
                  <Text style={styles.resultUnit}> pts</Text>
                </Text>
                {newBest && (
                  <View style={styles.newBestChip}>
                    <Sparkles size={14} color={C.ink} />
                    <Text variant="labelMedium" style={styles.newBestText}>
                      NEW BEST
                    </Text>
                  </View>
                )}
                <Text variant="bodyMedium" style={styles.resultBody}>
                  You found every word hiding in the comb
                  {round.pangrams.some((p) => found.includes(p)) ? ' — pangram included!' : '.'}
                </Text>
                <Pressable onPress={newHive}>
                  <LinearGradient
                    colors={[C.honey, C.honeyDeep]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.againBtn}
                  >
                    <Hexagon size={18} color={C.ink} />
                    <Text variant="titleMedium" style={styles.againText}>
                      New hive
                    </Text>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={onClose} hitSlop={8}>
                  <Text variant="labelLarge" style={styles.exitText}>
                    Back to studying
                  </Text>
                </Pressable>
              </Animated.View>
              <Confetti count={36} />
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
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
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
  body: { paddingBottom: 30 },
  entryRow: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  entryPlaceholder: { color: C.muted, fontSize: 16 },
  entryText: { color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: 2 },
  caret: { color: C.honey, fontWeight: '400' },
  noticeRow: { minHeight: 26, alignItems: 'center', justifyContent: 'center' },
  notice: { fontWeight: '800' },
  clueText: { color: C.muted, paddingHorizontal: 24, textAlign: 'center' },
  hexTouch: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  hexPress: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexLetter: { color: C.text, fontSize: 26, fontWeight: '800' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 16,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.combBorder,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  controlText: { color: C.muted, fontWeight: '700' },
  submitBtn: { borderRadius: 22, paddingVertical: 11, paddingHorizontal: 26 },
  submitText: { color: C.ink, fontWeight: '800' },
  foundWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  foundChip: {
    backgroundColor: C.comb,
    borderWidth: 1,
    borderColor: C.combBorder,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  foundChipPangram: { backgroundColor: C.honey, borderColor: C.honeyDeep },
  foundText: { color: C.text, fontWeight: '700' },
  rules: { color: C.muted, textAlign: 'center', marginTop: 18, paddingHorizontal: 32 },
  pangramLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pangramText: {
    color: C.honey,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: '#000000AA',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 2 },
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0A0701EE',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resultCard: { alignItems: 'center' },
  trophyHalo: {
    backgroundColor: C.honey + '1A',
    borderRadius: 44,
    padding: 18,
    borderWidth: 1,
    borderColor: C.honey + '40',
    marginBottom: 12,
  },
  resultTitle: { color: C.text, fontWeight: '800' },
  resultScore: { color: C.honey, fontSize: 44, fontWeight: '800', marginTop: 4 },
  resultUnit: { fontSize: 18, color: C.muted },
  newBestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.honey,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  newBestText: { color: C.ink, fontWeight: '800', letterSpacing: 0.5 },
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
  againText: { color: C.ink, fontWeight: '800' },
  exitText: { color: C.muted, marginTop: 16, textAlign: 'center' },
});
