import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import {
  Crown,
  Gem,
  Lightbulb,
  MessageSquareQuote,
  Scissors,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react-native';
import Word from '../../db/models/Word';
import Confetti from './Confetti';
import { getMillionaireBest, setMillionaireBest } from '../../db/settings';
import { playSfx } from '../../lib/sfx';
import {
  LADDER,
  MillionaireQuestion,
  SAFE_HAVENS,
  buildMillionaireQuestions,
  fiftyFiftyStrikes,
  safeHavenPoints,
} from '../../lib/games';

// Game-show palette — deliberately its own world, independent of app theme.
const C = {
  bgTop: '#150A3D',
  bgBottom: '#06021A',
  surface: '#221252',
  surfaceHi: '#2E1A6B',
  border: '#41288F',
  gold: '#FFC53D',
  goldDeep: '#F59E0B',
  text: '#F5F1FF',
  muted: '#A79BD4',
  green: '#22C55E',
  red: '#EF4444',
  cyan: '#38BDF8',
};

const LETTERS = ['A', 'B', 'C', 'D'];
const REVEAL_DELAY = 1400;

type Phase = 'intro' | 'playing' | 'won' | 'lost';
type RevealState = 'idle' | 'locked' | 'revealed';
type Lifeline = 'fifty' | 'hint' | 'clue';

interface Props {
  visible: boolean;
  onClose: () => void;
  words: Word[];
}

const fmt = (n: number) => n.toLocaleString('en-US');

export default function VocabMillionaire({ visible, onClose, words }: Props) {
  const { width } = useWindowDimensions();

  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<MillionaireQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [reveal, setReveal] = useState<RevealState>('idle');
  const [struck, setStruck] = useState<number[]>([]);
  const [used, setUsed] = useState<Record<Lifeline, boolean>>({
    fifty: false,
    hint: false,
    clue: false,
  });
  const [banner, setBanner] = useState<{ kind: Lifeline; text: string } | null>(null);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [burst, setBurst] = useState(0); // confetti replay key
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ----- Animations -----
  const introPulse = useMemo(() => new Animated.Value(1), []);
  const qSlide = useMemo(() => new Animated.Value(0), []); // 0 = onscreen
  const lockPulse = useMemo(() => new Animated.Value(0), []);
  const prizePop = useMemo(() => new Animated.Value(1), []);
  const bannerAnim = useMemo(() => new Animated.Value(0), []);
  const shake = useMemo(() => new Animated.Value(0), []);
  const resultAnim = useMemo(() => new Animated.Value(0), []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const after = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(() => {
    if (!visible) return;
    setPhase('intro');
    getMillionaireBest().then(setBest);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(introPulse, {
          toValue: 1.06,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(introPulse, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      clearTimers();
    };
  }, [visible, introPulse]);

  // Suspense pulse while an answer is locked in.
  useEffect(() => {
    if (reveal !== 'locked') return;
    lockPulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lockPulse, { toValue: 1, duration: 350, useNativeDriver: false }),
        Animated.timing(lockPulse, { toValue: 0, duration: 350, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reveal, lockPulse]);

  const startGame = () => {
    setQuestions(buildMillionaireQuestions(words));
    setQIndex(0);
    setSelected(null);
    setReveal('idle');
    setStruck([]);
    setUsed({ fifty: false, hint: false, clue: false });
    setBanner(null);
    setNewBest(false);
    qSlide.setValue(0);
    setPhase('playing');
  };

  const finish = useCallback(
    (won: boolean, score: number) => {
      resultAnim.setValue(0);
      setPhase(won ? 'won' : 'lost');
      setBurst((b) => b + 1);
      Animated.spring(resultAnim, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }).start();
      if (score > best) {
        setBest(score);
        setNewBest(true);
        setMillionaireBest(score);
      }
      if (won) playSfx('fanfare');
      Vibration.vibrate(won ? [0, 80, 80, 80, 80, 220] : 120);
    },
    [best, resultAnim]
  );

  const advance = useCallback(() => {
    // Slide the old question out, swap, slide the new one in.
    Animated.timing(qSlide, {
      toValue: -width,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setQIndex((i) => i + 1);
      setSelected(null);
      setReveal('idle');
      setStruck([]);
      setBanner(null);
      qSlide.setValue(width);
      Animated.timing(qSlide, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [qSlide, width]);

  const pick = (idx: number) => {
    if (reveal !== 'idle' || struck.includes(idx)) return;
    setSelected(idx);
    setReveal('locked');
    playSfx('tap');
    Vibration.vibrate(18);

    after(REVEAL_DELAY, () => {
      setReveal('revealed');
      const q = questions[qIndex];
      const correct = idx === q.correctIndex;
      if (correct) {
        playSfx('success');
        Vibration.vibrate(35);
        Animated.sequence([
          Animated.timing(prizePop, { toValue: 1.25, duration: 140, useNativeDriver: true }),
          Animated.spring(prizePop, { toValue: 1, friction: 4, useNativeDriver: true }),
        ]).start();
        if (qIndex === LADDER.length - 1) {
          after(1100, () => finish(true, LADDER[LADDER.length - 1]));
        } else {
          if (SAFE_HAVENS.includes(qIndex)) setBurst((b) => b + 1); // milestone shower
          after(1100, advance);
        }
      } else {
        playSfx('error');
        Vibration.vibrate([0, 60, 60, 140]);
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
        after(1900, () => finish(false, safeHavenPoints(qIndex)));
      }
    });
  };

  const spendLifeline = (kind: Lifeline) => {
    if (used[kind] || reveal !== 'idle') return;
    const q = questions[qIndex];
    setUsed((u) => ({ ...u, [kind]: true }));
    playSfx('tap');
    Vibration.vibrate(20);
    if (kind === 'fifty') {
      setStruck(fiftyFiftyStrikes(q));
      return;
    }
    const text =
      kind === 'hint'
        ? q.word.wordOrigin ??
          q.word.laymanExplanation ??
          `Part of speech: ${q.word.partOfSpeech || 'unknown'}`
        : q.word.exampleSentence.replace(
            new RegExp(`\\b${q.word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
            '_____'
          );
    setBanner({ kind, text });
    bannerAnim.setValue(0);
    Animated.spring(bannerAnim, { toValue: 1, friction: 7, useNativeDriver: true }).start();
  };

  const confirmQuit = () => {
    if (phase !== 'playing') {
      onClose();
      return;
    }
    Alert.alert('Leave the hot seat?', 'Your progress in this game will be lost.', [
      { text: 'Keep playing', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: onClose },
    ]);
  };

  const q = questions[qIndex];

  const optionColors = (idx: number): { bg: string; border: string } => {
    if (reveal === 'revealed' && q) {
      if (idx === q.correctIndex) return { bg: '#123B23', border: C.green };
      if (idx === selected) return { bg: '#3B1220', border: C.red };
    }
    if (reveal === 'locked' && idx === selected) return { bg: '#3B2E0E', border: C.gold };
    return { bg: C.surface, border: C.border };
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={confirmQuit} statusBarTranslucent>
      <LinearGradient colors={[C.bgTop, C.bgBottom]} style={styles.bg}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* ---------- INTRO ---------- */}
          {phase === 'intro' && (
            <View style={styles.centerFill}>
              <View style={styles.logoHalo}>
                <Crown size={54} color={C.gold} fill={C.gold} />
              </View>
              <Text variant="headlineLarge" style={styles.introTitle}>
                Vocab Millionaire
              </Text>
              <Text variant="bodyLarge" style={styles.introSub}>
                15 questions stand between you and{'\n'}
                <Text style={styles.introMillion}>1,000,000 points</Text>
              </Text>

              <View style={styles.ruleRow}>
                <Scissors size={18} color={C.cyan} />
                <Text variant="bodyMedium" style={styles.ruleText}>
                  50:50 — cut away two wrong answers
                </Text>
              </View>
              <View style={styles.ruleRow}>
                <Lightbulb size={18} color={C.gold} />
                <Text variant="bodyMedium" style={styles.ruleText}>
                  Hint — reveal the word's origin story
                </Text>
              </View>
              <View style={styles.ruleRow}>
                <MessageSquareQuote size={18} color="#EC4899" />
                <Text variant="bodyMedium" style={styles.ruleText}>
                  Clue — see the word used in a sentence
                </Text>
              </View>
              <View style={styles.ruleRow}>
                <Gem size={18} color={C.green} />
                <Text variant="bodyMedium" style={styles.ruleText}>
                  Questions 5 & 10 bank your points for good
                </Text>
              </View>

              {best > 0 && (
                <Text variant="labelLarge" style={styles.bestLine}>
                  Personal best · {fmt(best)} pts
                </Text>
              )}

              <Animated.View style={{ transform: [{ scale: introPulse }] }}>
                <Pressable onPress={startGame}>
                  <LinearGradient
                    colors={[C.gold, '#F97316']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.playBtn}
                  >
                    <Sparkles size={20} color="#3B2300" />
                    <Text variant="titleMedium" style={styles.playBtnText}>
                      Take the hot seat
                    </Text>
                  </LinearGradient>
                </Pressable>
              </Animated.View>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text variant="labelLarge" style={styles.introExit}>
                  Maybe later
                </Text>
              </Pressable>
            </View>
          )}

          {/* ---------- PLAYING ---------- */}
          {phase === 'playing' && q && (
            <View style={styles.playFill}>
              {/* Top bar: quit + prize */}
              <View style={styles.topBar}>
                <Pressable onPress={confirmQuit} hitSlop={10} style={styles.quitBtn}>
                  <X size={20} color={C.muted} />
                </Pressable>
                <View style={styles.prizeBlock}>
                  <Text variant="labelSmall" style={styles.prizeLabel}>
                    QUESTION {qIndex + 1} OF {LADDER.length} · PLAYING FOR
                  </Text>
                  <Animated.Text
                    style={[styles.prizeValue, { transform: [{ scale: prizePop }] }]}
                  >
                    {fmt(LADDER[qIndex])} pts
                  </Animated.Text>
                </View>
                <View style={styles.quitBtn} />
              </View>

              {/* Ladder ticks */}
              <View style={styles.ladder}>
                {LADDER.map((_, i) => {
                  const isDone = i < qIndex;
                  const isNow = i === qIndex;
                  const haven = SAFE_HAVENS.includes(i);
                  return (
                    <View key={i} style={styles.ladderSlot}>
                      {haven ? (
                        <Gem
                          size={13}
                          color={isDone || isNow ? C.green : C.border}
                          fill={isDone ? C.green : 'none'}
                        />
                      ) : (
                        <View
                          style={[
                            styles.tick,
                            isDone && styles.tickDone,
                            isNow && styles.tickNow,
                          ]}
                        />
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Lifelines */}
              <View style={styles.lifelineRow}>
                {(
                  [
                    { kind: 'fifty' as Lifeline, Icon: Scissors, tint: C.cyan, label: '50:50' },
                    { kind: 'hint' as Lifeline, Icon: Lightbulb, tint: C.gold, label: 'Hint' },
                    {
                      kind: 'clue' as Lifeline,
                      Icon: MessageSquareQuote,
                      tint: '#EC4899',
                      label: 'Clue',
                    },
                  ] as const
                ).map(({ kind, Icon, tint, label }) => (
                  <Pressable
                    key={kind}
                    onPress={() => spendLifeline(kind)}
                    disabled={used[kind]}
                    style={[styles.lifeline, used[kind] && styles.lifelineUsed]}
                  >
                    <Icon size={18} color={used[kind] ? C.muted : tint} />
                    <Text
                      variant="labelSmall"
                      style={[styles.lifelineLabel, used[kind] && styles.lifelineLabelUsed]}
                    >
                      {label}
                    </Text>
                    {used[kind] && <View style={styles.lifelineStrike} />}
                  </Pressable>
                ))}
              </View>

              <Animated.View
                style={[
                  styles.questionArea,
                  {
                    transform: [
                      { translateX: qSlide },
                      {
                        translateX: shake.interpolate({
                          inputRange: [-1, 1],
                          outputRange: [-9, 9],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Question */}
                  <View style={styles.questionCard}>
                    <Text variant="labelMedium" style={styles.questionKicker}>
                      WHAT DOES THIS WORD MEAN?
                    </Text>
                    <Text variant="headlineMedium" style={styles.questionWord}>
                      {q.word.word}
                    </Text>
                    {!!q.word.pronunciation && (
                      <Text variant="bodyMedium" style={styles.questionPron}>
                        {q.word.pronunciation}
                      </Text>
                    )}
                  </View>

                  {/* Lifeline banner */}
                  {banner && (
                    <Animated.View
                      style={[
                        styles.banner,
                        {
                          opacity: bannerAnim,
                          transform: [
                            {
                              translateY: bannerAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-12, 0],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      {banner.kind === 'hint' ? (
                        <Lightbulb size={16} color={C.gold} />
                      ) : (
                        <MessageSquareQuote size={16} color="#EC4899" />
                      )}
                      <Text variant="bodySmall" style={styles.bannerText}>
                        {banner.text}
                      </Text>
                    </Animated.View>
                  )}

                  {/* Options */}
                  {q.options.map((opt, idx) => {
                    const { bg, border } = optionColors(idx);
                    const isStruck = struck.includes(idx);
                    const lockGlow =
                      reveal === 'locked' && idx === selected
                        ? lockPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [C.gold + '55', C.gold],
                          })
                        : undefined;
                    return (
                      <Pressable key={idx} onPress={() => pick(idx)} disabled={isStruck}>
                        <Animated.View
                          style={[
                            styles.option,
                            { backgroundColor: bg, borderColor: lockGlow ?? border },
                            isStruck && styles.optionStruck,
                          ]}
                        >
                          <View
                            style={[
                              styles.optionLetter,
                              reveal === 'revealed' &&
                                idx === q.correctIndex && { backgroundColor: C.green },
                              reveal === 'revealed' &&
                                idx === selected &&
                                idx !== q.correctIndex && { backgroundColor: C.red },
                            ]}
                          >
                            <Text variant="labelMedium" style={styles.optionLetterText}>
                              {LETTERS[idx]}
                            </Text>
                          </View>
                          <Text
                            variant="bodyMedium"
                            style={[styles.optionText, isStruck && styles.optionTextStruck]}
                          >
                            {opt}
                          </Text>
                        </Animated.View>
                      </Pressable>
                    );
                  })}

                  {/* Banked line */}
                  <View style={styles.bankedRow}>
                    <Gem size={12} color={C.green} />
                    <Text variant="labelMedium" style={styles.bankedLine}>
                      {safeHavenPoints(qIndex) > 0
                        ? `${fmt(safeHavenPoints(qIndex))} pts banked safely`
                        : 'Nothing banked yet — reach question 5 to lock in points'}
                    </Text>
                  </View>
                </ScrollView>
              </Animated.View>
            </View>
          )}

          {/* ---------- WON / LOST ---------- */}
          {(phase === 'won' || phase === 'lost') && (
            <View style={styles.centerFill}>
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
                <View style={[styles.logoHalo, phase === 'lost' && styles.haloLost]}>
                  {phase === 'won' ? (
                    <Trophy size={54} color={C.gold} fill={C.gold} />
                  ) : (
                    <Gem size={54} color={C.green} />
                  )}
                </View>
                <Text variant="headlineMedium" style={styles.resultTitle}>
                  {phase === 'won' ? 'VOCAB MILLIONAIRE!' : 'Game over'}
                </Text>
                <Text style={styles.resultScore}>
                  {fmt(phase === 'won' ? LADDER[LADDER.length - 1] : safeHavenPoints(qIndex))}
                  <Text style={styles.resultPts}> pts</Text>
                </Text>
                {newBest && (
                  <View style={styles.newBestChip}>
                    <Sparkles size={14} color="#3B2300" />
                    <Text variant="labelMedium" style={styles.newBestText}>
                      NEW PERSONAL BEST
                    </Text>
                  </View>
                )}
                <Text variant="bodyMedium" style={styles.resultBody}>
                  {phase === 'won'
                    ? `All ${LADDER.length} questions conquered. Your vocabulary is in rare form.`
                    : q
                      ? `"${q.word.word}" means: ${q.word.meaning}`
                      : ''}
                </Text>

                <Pressable onPress={startGame}>
                  <LinearGradient
                    colors={[C.gold, '#F97316']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.playBtn}
                  >
                    <Crown size={18} color="#3B2300" />
                    <Text variant="titleMedium" style={styles.playBtnText}>
                      Play again
                    </Text>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={onClose} hitSlop={8}>
                  <Text variant="labelLarge" style={styles.introExit}>
                    Back to studying
                  </Text>
                </Pressable>
              </Animated.View>
              <Confetti key={burst} count={phase === 'won' ? 44 : 18} />
            </View>
          )}

          {/* Milestone confetti during play */}
          {phase === 'playing' && burst > 0 && <Confetti key={`play-${burst}`} count={20} />}
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  playFill: { flex: 1 },

  // Intro
  logoHalo: {
    backgroundColor: C.gold + '1A',
    borderRadius: 48,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.gold + '40',
  },
  haloLost: { backgroundColor: C.green + '14', borderColor: C.green + '40' },
  introTitle: { color: C.text, fontWeight: '800', letterSpacing: 0.5 },
  introSub: { color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 24 },
  introMillion: { color: C.gold, fontWeight: '800' },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  ruleText: { color: C.text, opacity: 0.85 },
  bestLine: { color: C.gold, marginTop: 18 },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 30,
    marginTop: 26,
  },
  playBtnText: { color: '#3B2300', fontWeight: '800' },
  introExit: { color: C.muted, marginTop: 18, textAlign: 'center' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  quitBtn: { width: 36, alignItems: 'center' },
  prizeBlock: { flex: 1, alignItems: 'center' },
  prizeLabel: { color: C.muted, letterSpacing: 1 },
  prizeValue: { color: C.gold, fontSize: 26, fontWeight: '800', marginTop: 2 },

  // Ladder
  ladder: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 14,
  },
  ladderSlot: { flex: 1, alignItems: 'center' },
  tick: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
  },
  tickDone: { backgroundColor: C.gold },
  tickNow: {
    backgroundColor: C.gold,
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: C.gold,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },

  // Lifelines
  lifelineRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 14,
  },
  lifeline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  lifelineUsed: { opacity: 0.45 },
  lifelineLabel: { color: C.text, fontWeight: '700' },
  lifelineLabelUsed: { color: C.muted },
  lifelineStrike: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: C.red,
    transform: [{ rotate: '-8deg' }],
  },

  // Question + options
  questionArea: { flex: 1, marginTop: 14, paddingHorizontal: 16 },
  questionCard: {
    backgroundColor: C.surfaceHi,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  questionKicker: { color: C.muted, letterSpacing: 2 },
  questionWord: { color: C.text, fontWeight: '800', marginTop: 6 },
  questionPron: { color: C.cyan, marginTop: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginTop: 10,
  },
  bannerText: { color: C.text, flex: 1, lineHeight: 18 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 2,
    padding: 14,
    marginTop: 10,
  },
  optionStruck: { opacity: 0.25 },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterText: { color: C.text, fontWeight: '800' },
  optionText: { color: C.text, flex: 1, lineHeight: 20 },
  optionTextStruck: { textDecorationLine: 'line-through' },
  bankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 16,
  },
  bankedLine: { color: C.muted },

  // Result
  resultCard: { alignItems: 'center', paddingHorizontal: 12 },
  resultTitle: { color: C.text, fontWeight: '800', letterSpacing: 1 },
  resultScore: { color: C.gold, fontSize: 44, fontWeight: '800', marginTop: 6 },
  resultPts: { fontSize: 20, color: C.goldDeep },
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
  newBestText: { color: '#3B2300', fontWeight: '800', letterSpacing: 0.5 },
  resultBody: {
    color: C.muted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 21,
  },
});
