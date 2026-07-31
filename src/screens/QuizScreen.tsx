import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import Svg, { Circle } from 'react-native-svg';
import {
  BookOpen,
  Check,
  Flame,
  GraduationCap,
  Layers,
  PenLine,
  Sparkles,
  Trophy,
} from 'lucide-react-native';
import Word, { PracticeStatus } from '../db/models/Word';
import { fetchAllWords, setPracticeStatus, wordsFromPastDays } from '../db/words';
import { useQuizAntonyms, useQuizSynonyms } from '../hooks';
import { QUIZ_GUIDE } from '../lib/guides';
import { useInfoSheet } from '../ui/InfoSheet';
import { playSfx } from '../lib/sfx';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import Confetti from './games/Confetti';
import GameArcade from './games/GameArcade';

type QuizType = 'flashcards' | 'mcq' | 'fill';
type Phase = 'setup' | 'active' | 'done';

/** What the prompt is showing in place of the word itself, if anything. */
type PromptKind = 'word' | 'synonym' | 'antonym';

interface Question {
  word: Word;
  prompt: string;
  promptKind: PromptKind;
  options: string[]; // empty for flashcards
  correctIndex: number;
}

const MAX_QUESTIONS = 10;
const LETTERS = ['A', 'B', 'C', 'D'];

const MODES: { key: QuizType; title: string; blurb: string; Icon: typeof Layers }[] = [
  { key: 'flashcards', title: 'Flashcards', blurb: 'Flip, recall, self-grade.', Icon: Layers },
  { key: 'mcq', title: 'Meanings', blurb: 'Pick the right definition.', Icon: BookOpen },
  { key: 'fill', title: 'Fill the blank', blurb: 'Complete real sentences.', Icon: PenLine },
];

const SOURCES = [
  { value: 'all', label: 'All time' },
  { value: '7', label: 'Past 7 days' },
  { value: '30', label: 'Past 30 days' },
];

const RING_R = 62;
const RING_LEN = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildQuestions(
  words: Word[],
  type: QuizType,
  useSynonyms: boolean,
  useAntonyms: boolean
): Question[] {
  const pool = shuffle(words).slice(0, MAX_QUESTIONS);
  return pool.map((word) => {
    // Pick one enabled hint type at random per question; fall back to the word
    // itself when neither is enabled or the word has none available.
    const kinds: PromptKind[] = [];
    if (useSynonyms && word.synonyms.length) kinds.push('synonym');
    if (useAntonyms && word.antonyms.length) kinds.push('antonym');
    const promptKind: PromptKind = kinds.length ? shuffle(kinds)[0] : 'word';
    const hint =
      promptKind === 'synonym'
        ? shuffle(word.synonyms)[0]
        : promptKind === 'antonym'
          ? shuffle(word.antonyms)[0]
          : undefined;
    const headword = hint ?? word.word;

    if (type === 'flashcards') {
      return { word, prompt: headword, promptKind, options: [], correctIndex: 0 };
    }
    const distractors = shuffle(words.filter((w) => w.id !== word.id)).slice(0, 3);
    if (type === 'mcq') {
      const options = shuffle([word.meaning, ...distractors.map((d) => d.meaning)]);
      return {
        word,
        prompt: headword,
        promptKind,
        options,
        correctIndex: options.indexOf(word.meaning),
      };
    }
    // fill-in-the-blank: blank the word out of its own example sentence.
    const blanked = word.exampleSentence.replace(
      new RegExp(`\\b${escapeRegExp(word.word)}\\b`, 'gi'),
      '_____'
    );
    const sentence = blanked.includes('_____')
      ? blanked
      : `${word.exampleSentence}\n\nWhich word fits this sentence?`;
    const prompt = hint
      ? `${sentence}\n\nHint — ${promptKind === 'antonym' ? 'opposite of' : 'similar to'}: ${hint}`
      : sentence;
    const options = shuffle([word.word, ...distractors.map((d) => d.word)]);
    return {
      word,
      prompt,
      promptKind: 'word',
      options,
      correctIndex: options.indexOf(word.word),
    };
  });
}

function bumpStatus(word: Word, correct: boolean) {
  const next: PracticeStatus = correct
    ? word.practiceStatus === 'new'
      ? 'learning'
      : 'mastered'
    : 'learning';
  if (next !== word.practiceStatus) setPracticeStatus(word, next).catch(() => {});
}

export default function QuizScreen() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const help = useInfoSheet(QUIZ_GUIDE, { onDark: true });
  const [phase, setPhase] = useState<Phase>('setup');
  const [type, setType] = useState<QuizType>('flashcards');
  const [source, setSource] = useState('all');
  // Read-only here — the toggles themselves live in Settings.
  const [useSynonyms] = useQuizSynonyms();
  const [useAntonyms] = useQuizAntonyms();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [notice, setNotice] = useState('');
  const [run, setRun] = useState(0); // current correct streak
  const [bestRun, setBestRun] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ----- Animations -----
  const progressAnim = useMemo(() => new Animated.Value(0), []);
  const qSlide = useMemo(() => new Animated.Value(0), []);
  const flipAnim = useMemo(() => new Animated.Value(0), []);
  const shakeAnim = useMemo(() => new Animated.Value(0), []);
  const runPop = useMemo(() => new Animated.Value(1), []);
  const nextAnim = useMemo(() => new Animated.Value(0), []);
  const ringAnim = useMemo(() => new Animated.Value(0), []);
  const resultAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase !== 'active') return;
    Animated.timing(progressAnim, {
      toValue: questions.length ? qIndex / questions.length : 0,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animates width
    }).start();
  }, [qIndex, phase, questions.length, progressAnim]);

  const start = async () => {
    setNotice('');
    playSfx('tap');
    const words =
      source === 'all' ? await fetchAllWords() : await wordsFromPastDays(Number(source));
    const needed = type === 'flashcards' ? 1 : 4;
    if (words.length < needed) {
      setNotice(
        type === 'flashcards'
          ? 'Add at least one word to start a quiz.'
          : `This quiz type needs at least 4 words in the selected range — you have ${words.length}.`
      );
      return;
    }
    setQuestions(buildQuestions(words, type, useSynonyms, useAntonyms));
    setQIndex(0);
    setScore(0);
    setRun(0);
    setBestRun(0);
    setAnswered(null);
    setRevealed(false);
    progressAnim.setValue(0);
    flipAnim.setValue(0);
    qSlide.setValue(width);
    setPhase('active');
    Animated.timing(qSlide, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const registerResult = (correct: boolean) => {
    if (correct) {
      setScore((s) => s + 1);
      setRun((r) => {
        const next = r + 1;
        setBestRun((b) => Math.max(b, next));
        return next;
      });
      playSfx('success');
      Vibration.vibrate(28);
      Animated.sequence([
        Animated.timing(runPop, { toValue: 1.35, duration: 130, useNativeDriver: true }),
        Animated.spring(runPop, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    } else {
      setRun(0);
      playSfx('error');
      Vibration.vibrate([0, 45, 40, 45]);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]).start();
    }
  };

  const finish = () => {
    setPhase('done');
    playSfx('fanfare');
    ringAnim.setValue(0);
    resultAnim.setValue(0);
    Animated.parallel([
      Animated.spring(resultAnim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.timing(ringAnim, {
        toValue: questions.length ? score / questions.length : 0,
        duration: 1100,
        delay: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // SVG stroke props
      }),
    ]).start();
  };

  const next = () => {
    playSfx('tap');
    if (qIndex + 1 >= questions.length) {
      finish();
      return;
    }
    nextAnim.setValue(0);
    Animated.timing(qSlide, {
      toValue: -width,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setQIndex((i) => i + 1);
      setAnswered(null);
      setRevealed(false);
      flipAnim.setValue(0);
      qSlide.setValue(width);
      Animated.timing(qSlide, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const answer = (idx: number) => {
    if (answered !== null) return;
    setAnswered(idx);
    const q = questions[qIndex];
    const correct = idx === q.correctIndex;
    registerResult(correct);
    bumpStatus(q.word, correct);
    nextAnim.setValue(0);
    Animated.timing(nextAnim, {
      toValue: 1,
      duration: 300,
      delay: 350,
      useNativeDriver: true,
    }).start();
  };

  const flip = () => {
    playSfx('tap');
    Vibration.vibrate(10);
    Animated.timing(flipAnim, {
      toValue: revealed ? 0 : 1,
      duration: 420,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
    setRevealed((r) => !r);
  };

  const flashcardResult = (knewIt: boolean) => {
    const q = questions[qIndex];
    registerResult(knewIt);
    bumpStatus(q.word, knewIt);
    timers.current.push(setTimeout(next, 550));
  };

  const q = questions[qIndex];
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;

  const resultTier =
    pct === 100
      ? { title: 'Flawless!', body: 'Every single word — your studying is paying off.' }
      : pct >= 80
        ? { title: 'Brilliant round', body: 'These words are becoming second nature.' }
        : pct >= 50
          ? { title: 'Solid progress', body: 'A few slips — revisit them and they’ll stick.' }
          : { title: 'Seeds planted', body: 'Tough round. Travel Mode is great for a refresher.' };

  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ================= SETUP ================= */}
      {phase === 'setup' && (
        <ScrollView contentContainerStyle={styles.content}>
          <LinearGradient
            colors={[colors.primary, colors.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroIcon}>
              <GraduationCap size={26} color="#FFFFFF" />
            </View>
            <View style={styles.heroText}>
              <Text variant="headlineSmall" style={styles.heroTitle}>
                Quiz Arena
              </Text>
              <Text variant="bodySmall" style={styles.heroSub}>
                Active recall turns learned words into owned words.
              </Text>
            </View>
            {help.button}
          </LinearGradient>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Choose your challenge
          </Text>
          {MODES.map(({ key, title, blurb, Icon }) => {
            const active = type === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  setType(key);
                  playSfx('tap');
                }}
              >
                {({ pressed }) => (
                  <View
                    style={[
                      styles.modeCard,
                      active && styles.modeCardActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.modeIcon,
                        { backgroundColor: (active ? colors.primary : colors.muted) + '1C' },
                      ]}
                    >
                      <Icon size={20} color={active ? colors.primary : colors.muted} />
                    </View>
                    <View style={styles.modeText}>
                      <Text
                        variant="titleSmall"
                        style={[styles.modeTitle, active && { color: colors.primary }]}
                      >
                        {title}
                      </Text>
                      <Text variant="bodySmall" style={styles.modeBlurb}>
                        {blurb}
                      </Text>
                    </View>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <Check size={13} color="#FFFFFF" strokeWidth={3.5} />}
                    </View>
                  </View>
                )}
              </Pressable>
            );
          })}

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Words from
          </Text>
          <View style={styles.chipRow}>
            {SOURCES.map((s) => {
              const active = source === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => {
                    setSource(s.value);
                    playSfx('tap');
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    variant="labelLarge"
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {!!notice && (
            <View style={styles.noticeBanner}>
              <Text variant="bodyMedium" style={styles.noticeText}>
                {notice}
              </Text>
            </View>
          )}

          <Pressable onPress={start}>
            {({ pressed }) => (
              <LinearGradient
                colors={[colors.primary, colors.violet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.startBtn, pressed && styles.pressed]}
              >
                <Sparkles size={18} color="#FFFFFF" />
                <Text variant="titleMedium" style={styles.startText}>
                  Start quiz
                </Text>
              </LinearGradient>
            )}
          </Pressable>

          <GameArcade />
        </ScrollView>
      )}

      {/* ================= ACTIVE ================= */}
      {phase === 'active' && q && (
        <View style={styles.activeFill}>
          {/* Progress + streak header */}
          <View style={styles.activeHeader}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <View style={styles.activeMetaRow}>
              <Text variant="labelLarge" style={styles.metaText}>
                {qIndex + 1} / {questions.length}
              </Text>
              <Animated.View
                style={[
                  styles.runChip,
                  run > 0 && styles.runChipHot,
                  { transform: [{ scale: runPop }] },
                ]}
              >
                <Flame
                  size={14}
                  color={run > 0 ? colors.amber : colors.muted}
                  fill={run > 0 ? colors.amber : 'none'}
                />
                <Text
                  variant="labelMedium"
                  style={[styles.runText, run > 0 && { color: colors.amber }]}
                >
                  {run} streak
                </Text>
              </Animated.View>
              <Text variant="labelLarge" style={styles.metaText}>
                {score} pts
              </Text>
            </View>
          </View>

          <Animated.View
            style={[
              styles.questionArea,
              {
                transform: [
                  { translateX: qSlide },
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
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.qScroll}>
              {type === 'flashcards' ? (
                <>
                  {/* 3D flip card */}
                  <Pressable onPress={flip}>
                    <View style={styles.flipStage}>
                      <Animated.View
                        style={[
                          styles.cardFace,
                          styles.cardFront,
                          {
                            transform: [
                              { perspective: 1200 },
                              {
                                rotateY: flipAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '180deg'],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        {q.promptKind !== 'word' && (
                          <Text variant="labelMedium" style={styles.kindBadge}>
                            {q.promptKind === 'antonym' ? 'ANTONYM OF' : 'SYNONYM OF'}
                          </Text>
                        )}
                        <Text variant="displaySmall" style={styles.flashWord}>
                          {q.prompt}
                        </Text>
                        {q.promptKind === 'word' && !!q.word.pronunciation && (
                          <Text variant="bodyLarge" style={styles.flashPron}>
                            {q.word.pronunciation}
                          </Text>
                        )}
                        <Text variant="labelMedium" style={styles.tapHint}>
                          {q.promptKind !== 'word' ? 'Tap to reveal the word' : 'Tap to flip'}
                        </Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.cardFace,
                          styles.cardBack,
                          {
                            transform: [
                              { perspective: 1200 },
                              {
                                rotateY: flipAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['180deg', '360deg'],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        {q.promptKind !== 'word' && (
                          <Text variant="headlineSmall" style={styles.revealWord}>
                            {q.word.word}
                          </Text>
                        )}
                        <Text variant="titleLarge" style={styles.flashBack}>
                          {q.word.meaning}
                        </Text>
                        {q.word.synonyms.length > 0 && (
                          <Text variant="bodyMedium" style={styles.flashHint}>
                            Similar: {q.word.synonyms.join(', ')}
                          </Text>
                        )}
                        {q.word.antonyms.length > 0 && (
                          <Text variant="bodyMedium" style={styles.flashHint}>
                            Opposite: {q.word.antonyms.join(', ')}
                          </Text>
                        )}
                        {!!q.word.laymanExplanation && (
                          <Text variant="bodyMedium" style={styles.flashHint}>
                            In plain terms: {q.word.laymanExplanation}
                          </Text>
                        )}
                      </Animated.View>
                    </View>
                  </Pressable>
                  {revealed && (
                    <View style={styles.flashButtons}>
                      <Pressable onPress={() => flashcardResult(false)} style={styles.flex}>
                        {({ pressed }) => (
                          <View style={[styles.againBtn, pressed && styles.pressed]}>
                            <Text variant="titleSmall" style={styles.againText}>
                              Review again
                            </Text>
                          </View>
                        )}
                      </Pressable>
                      <Pressable onPress={() => flashcardResult(true)} style={styles.flex}>
                        {({ pressed }) => (
                          <LinearGradient
                            colors={[colors.sage, colors.green]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.knewBtn, pressed && styles.pressed]}
                          >
                            <Check size={17} color="#FFFFFF" strokeWidth={3} />
                            <Text variant="titleSmall" style={styles.knewText}>
                              Knew it
                            </Text>
                          </LinearGradient>
                        )}
                      </Pressable>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.questionCard}>
                    {q.promptKind !== 'word' && (
                      <Text variant="labelMedium" style={styles.kindBadge}>
                        {q.promptKind === 'antonym' ? 'ANTONYM OF' : 'SYNONYM OF'}
                      </Text>
                    )}
                    <Text
                      variant={type === 'mcq' ? 'headlineMedium' : 'titleLarge'}
                      style={type === 'mcq' ? styles.mcqWord : styles.sentence}
                    >
                      {q.prompt}
                    </Text>
                  </View>
                  {q.options.map((opt, idx) => {
                    const isCorrect = answered !== null && idx === q.correctIndex;
                    const isWrongPick = answered === idx && idx !== q.correctIndex;
                    return (
                      <Pressable key={idx} onPress={() => answer(idx)}>
                        {({ pressed }) => (
                          <View
                            style={[
                              styles.option,
                              pressed && answered === null && styles.optionPressed,
                              isCorrect && styles.optionCorrect,
                              isWrongPick && styles.optionWrong,
                            ]}
                          >
                            <View
                              style={[
                                styles.optionLetter,
                                isCorrect && { backgroundColor: colors.green },
                                isWrongPick && { backgroundColor: colors.red },
                              ]}
                            >
                              {isCorrect ? (
                                <Check size={14} color="#FFFFFF" strokeWidth={3.5} />
                              ) : (
                                <Text variant="labelMedium" style={styles.optionLetterText}>
                                  {LETTERS[idx]}
                                </Text>
                              )}
                            </View>
                            <Text variant="bodyLarge" style={styles.optionText}>
                              {opt}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                  {answered !== null && (
                    <Animated.View
                      style={{
                        opacity: nextAnim,
                        transform: [
                          {
                            translateY: nextAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [14, 0],
                            }),
                          },
                        ],
                      }}
                    >
                      <Pressable onPress={next}>
                        {({ pressed }) => (
                          <LinearGradient
                            colors={[colors.primary, colors.violet]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.startBtn, pressed && styles.pressed]}
                          >
                            <Text variant="titleMedium" style={styles.startText}>
                              {qIndex + 1 >= questions.length ? 'See results' : 'Next question'}
                            </Text>
                          </LinearGradient>
                        )}
                      </Pressable>
                    </Animated.View>
                  )}
                </>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* ================= DONE ================= */}
      {phase === 'done' && (
        <View style={styles.doneFill}>
          <Animated.View
            style={[
              styles.resultCard,
              {
                opacity: resultAnim,
                transform: [
                  {
                    scale: resultAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Score ring */}
            <View style={styles.ringWrap}>
              <Svg width={150} height={150}>
                <Circle
                  cx={75}
                  cy={75}
                  r={RING_R}
                  stroke={colors.surfaceAlt}
                  strokeWidth={11}
                  fill="none"
                />
                <AnimatedCircle
                  cx={75}
                  cy={75}
                  r={RING_R}
                  stroke={pct >= 50 ? colors.sage : colors.coral}
                  strokeWidth={11}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${RING_LEN} ${RING_LEN}`}
                  strokeDashoffset={ringAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [RING_LEN, 0],
                  })}
                  transform="rotate(-90 75 75)"
                />
              </Svg>
              <View style={styles.ringCenter}>
                <Text variant="displaySmall" style={styles.ringScore}>
                  {pct}%
                </Text>
                <Text variant="labelSmall" style={styles.ringLabel}>
                  {score}/{questions.length} correct
                </Text>
              </View>
            </View>

            <Text variant="headlineSmall" style={styles.resultTitle}>
              {resultTier.title}
            </Text>
            <Text variant="bodyMedium" style={styles.resultBody}>
              {resultTier.body}
            </Text>

            <View style={styles.statChips}>
              <View style={styles.statChip}>
                <Flame size={15} color={colors.amber} fill={colors.amber} />
                <Text variant="labelLarge" style={styles.statChipText}>
                  Best run {bestRun}
                </Text>
              </View>
              <View style={styles.statChip}>
                <Trophy size={15} color={colors.violet} />
                <Text variant="labelLarge" style={styles.statChipText}>
                  {score} words nailed
                </Text>
              </View>
            </View>

            <Pressable onPress={() => setPhase('setup')}>
              {({ pressed }) => (
                <LinearGradient
                  colors={[colors.primary, colors.violet]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.startBtn, styles.doneBtn, pressed && styles.pressed]}
                >
                  <Sparkles size={18} color="#FFFFFF" />
                  <Text variant="titleMedium" style={styles.startText}>
                    New quiz
                  </Text>
                </LinearGradient>
              )}
            </Pressable>
          </Animated.View>
          {pct >= 80 && <Confetti count={34} />}
        </View>
      )}

      {help.sheet}
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },

  // Setup
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    padding: 18,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1 },
  heroTitle: { color: '#FFFFFF', fontWeight: '800' },
  heroSub: { color: '#FFFFFFCC', marginTop: 2 },
  sectionTitle: { color: colors.text, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  modeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '0D',
  },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: { flex: 1 },
  modeTitle: { color: colors.text, fontWeight: '700' },
  modeBlurb: { color: colors.muted, marginTop: 1 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipRow: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.muted, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  noticeBanner: {
    backgroundColor: colors.coral + '1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.coral + '55',
    padding: 12,
    marginTop: 16,
  },
  noticeText: { color: colors.text, lineHeight: 20 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 20,
    paddingVertical: 15,
    marginTop: 22,
  },
  startText: { color: '#FFFFFF', fontWeight: '800' },

  // Active
  activeFill: { flex: 1 },
  activeHeader: { paddingHorizontal: 16, paddingTop: 14 },
  progressTrack: {
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  activeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  metaText: { color: colors.muted, fontWeight: '700' },
  runChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  runChipHot: { borderColor: colors.amber + '88', backgroundColor: colors.amber + '14' },
  runText: { color: colors.muted, fontWeight: '800' },
  questionArea: { flex: 1, marginTop: 6 },
  qScroll: { padding: 16, paddingBottom: 30 },

  // Flashcards
  flipStage: { minHeight: 300 },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    minHeight: 300,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backfaceVisibility: 'hidden',
  },
  cardFront: {
    position: 'relative',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cardBack: {
    backgroundColor: colors.primary + '10',
    borderWidth: 1.5,
    borderColor: colors.primary + '66',
  },
  kindBadge: { color: colors.violet, letterSpacing: 1.5, fontWeight: '800' },
  flashWord: { color: colors.text, fontWeight: '800', textAlign: 'center' },
  flashPron: { color: colors.muted, textAlign: 'center' },
  tapHint: { color: colors.primary, marginTop: 14, fontWeight: '700' },
  revealWord: { color: colors.primary, fontWeight: '800', textAlign: 'center' },
  flashBack: { color: colors.text, textAlign: 'center', lineHeight: 28 },
  flashHint: { color: colors.muted, textAlign: 'center' },
  flashButtons: { flexDirection: 'row', gap: 12, marginTop: 18 },
  againBtn: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.coral,
    paddingVertical: 13,
    alignItems: 'center',
  },
  againText: { color: colors.coral, fontWeight: '800' },
  knewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 18,
    paddingVertical: 13,
  },
  knewText: { color: '#FFFFFF', fontWeight: '800' },

  // MCQ / fill
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  mcqWord: { color: colors.text, fontWeight: '800', textAlign: 'center' },
  sentence: { color: colors.text, lineHeight: 28 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 9,
  },
  optionPressed: { borderColor: colors.primary, transform: [{ scale: 0.985 }] },
  optionCorrect: {
    backgroundColor: colors.green + '1A',
    borderColor: colors.green,
  },
  optionWrong: {
    backgroundColor: colors.red + '14',
    borderColor: colors.red,
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterText: { color: colors.muted, fontWeight: '800' },
  optionText: { color: colors.text, flex: 1, lineHeight: 22 },

  // Done
  doneFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  resultCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 30,
    paddingHorizontal: 22,
  },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringScore: { color: colors.text, fontWeight: '800' },
  ringLabel: { color: colors.muted, marginTop: 2 },
  resultTitle: { color: colors.text, fontWeight: '800', marginTop: 16 },
  resultBody: { color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 21 },
  statChips: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  statChipText: { color: colors.text, fontWeight: '700' },
  doneBtn: { alignSelf: 'stretch' },
});
