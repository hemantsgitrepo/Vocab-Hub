import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Vibration,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Brain, RotateCcw, Sparkles, Trophy, X } from 'lucide-react-native';
import Word from '../../db/models/Word';
import Confetti from './Confetti';
import { getMemoryBest, setMemoryBest } from '../../db/settings';
import { MEMORY_PAIRS, MemoryCard, buildMemoryDeck } from '../../lib/games';

// Deep-forest arcade palette, independent of the app theme.
const C = {
  bgTop: '#042C26',
  bgBottom: '#010F0D',
  cardBack: '#0C4A3E',
  cardBackHi: '#12655A',
  cardFace: '#F4FBF7',
  border: '#1B7A63',
  mint: '#34D399',
  text: '#ECFDF5',
  muted: '#7FB8A4',
  ink: '#064E3B',
  gold: '#FBBF24',
};

const COLS = 3;
const FLIP_MS = 260;
const MISMATCH_HOLD = 850;

interface Props {
  visible: boolean;
  onClose: () => void;
  words: Word[];
}

interface CardAnims {
  flip: Animated.Value; // 0 face-down → 1 face-up
  pop: Animated.Value; // match celebration scale
  shake: Animated.Value;
}

export default function MemoryMatch({ visible, onClose, words }: Props) {
  const { width } = useWindowDimensions();

  const [deck, setDeck] = useState<MemoryCard[]>([]);
  const [faceUp, setFaceUp] = useState<string[]>([]); // ids currently flipped (max 2)
  const [matched, setMatched] = useState<Set<string>>(new Set()); // pairIds
  const [moves, setMoves] = useState(0);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [won, setWon] = useState(false);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const anims = useRef<Map<string, CardAnims>>(new Map());
  const entrance = useMemo(() => new Animated.Value(0), []);
  const resultAnim = useMemo(() => new Animated.Value(0), []);

  const animsFor = (id: string): CardAnims => {
    let a = anims.current.get(id);
    if (!a) {
      a = { flip: new Animated.Value(0), pop: new Animated.Value(1), shake: new Animated.Value(0) };
      anims.current.set(id, a);
    }
    return a;
  };

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const newRound = () => {
    clearTimers();
    anims.current.clear();
    setDeck(buildMemoryDeck(words));
    setFaceUp([]);
    setMatched(new Set());
    setMoves(0);
    setWon(false);
    setNewBest(false);
    busy.current = false;
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (!visible) return;
    getMemoryBest().then(setBest);
    newRound();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const flipTo = (id: string, up: boolean) =>
    Animated.timing(animsFor(id).flip, {
      toValue: up ? 1 : 0,
      duration: FLIP_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });

  const celebrate = (aId: string, bId: string) => {
    const pulse = (v: Animated.Value) =>
      Animated.sequence([
        Animated.timing(v, { toValue: 1.14, duration: 130, useNativeDriver: true }),
        Animated.spring(v, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]);
    Animated.parallel([pulse(animsFor(aId).pop), pulse(animsFor(bId).pop)]).start();
  };

  const wobble = (aId: string, bId: string) => {
    const s = (v: Animated.Value) =>
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(v, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]);
    Animated.parallel([s(animsFor(aId).shake), s(animsFor(bId).shake)]).start();
  };

  const tapCard = (card: MemoryCard) => {
    if (busy.current || won) return;
    if (faceUp.includes(card.id) || matched.has(card.pairId)) return;

    Vibration.vibrate(12);
    flipTo(card.id, true).start();

    if (faceUp.length === 0) {
      setFaceUp([card.id]);
      return;
    }

    // Second card of the attempt.
    const firstId = faceUp[0];
    const first = deck.find((c) => c.id === firstId)!;
    setFaceUp([firstId, card.id]);
    setMoves((m) => m + 1);
    busy.current = true;

    if (first.pairId === card.pairId) {
      timers.current.push(
        setTimeout(() => {
          Vibration.vibrate(30);
          const nextMatched = new Set(matched).add(card.pairId);
          setMatched(nextMatched);
          setFaceUp([]);
          celebrate(firstId, card.id);
          busy.current = false;

          if (nextMatched.size === MEMORY_PAIRS) {
            const finalMoves = moves + 1;
            setWon(true);
            Vibration.vibrate([0, 70, 70, 70, 70, 200]);
            resultAnim.setValue(0);
            Animated.spring(resultAnim, {
              toValue: 1,
              friction: 5,
              tension: 60,
              useNativeDriver: true,
            }).start();
            if (best === 0 || finalMoves < best) {
              setBest(finalMoves);
              setNewBest(true);
              setMemoryBest(finalMoves);
            }
          }
        }, FLIP_MS + 60)
      );
    } else {
      timers.current.push(
        setTimeout(() => {
          Vibration.vibrate([0, 40, 50, 40]);
          wobble(firstId, card.id);
        }, FLIP_MS + 40)
      );
      timers.current.push(
        setTimeout(() => {
          Animated.parallel([flipTo(firstId, false), flipTo(card.id, false)]).start(() => {
            busy.current = false;
          });
          setFaceUp([]);
        }, FLIP_MS + MISMATCH_HOLD)
      );
    }
  };

  // ----- Layout -----
  const H_PAD = 16;
  const GAP = 10;
  // Floor minus a hair so 3 cards + gaps never exceed the row (float rounding
  // was wrapping the grid to 2 columns).
  const cardW = Math.floor((width - H_PAD * 2 - GAP * (COLS - 1)) / COLS) - 1;
  const cardH = cardW * 1.12;

  const pairsFound = matched.size;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <LinearGradient colors={[C.bgTop, C.bgBottom]} style={styles.bg}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.headerBtn}>
              <X size={20} color={C.muted} />
            </Pressable>
            <View style={styles.headerCenter}>
              <View style={styles.titleRow}>
                <Brain size={18} color={C.mint} />
                <Text variant="titleMedium" style={styles.title}>
                  Memory Match
                </Text>
              </View>
              <Text variant="labelSmall" style={styles.subtitle}>
                {pairsFound}/{MEMORY_PAIRS} pairs · {moves} moves
                {best > 0 ? ` · best ${best}` : ''}
              </Text>
            </View>
            <Pressable onPress={newRound} hitSlop={10} style={styles.headerBtn}>
              <RotateCcw size={18} color={C.muted} />
            </Pressable>
          </View>

          {/* Progress dots */}
          <View style={styles.pairDots}>
            {Array.from({ length: MEMORY_PAIRS }, (_, i) => (
              <View
                key={i}
                style={[styles.pairDot, i < pairsFound && styles.pairDotDone]}
              />
            ))}
          </View>

          {/* Grid */}
          <View style={[styles.grid, { paddingHorizontal: H_PAD, gap: GAP }]}>
            {deck.map((card, i) => {
              const a = animsFor(card.id);
              const isMatched = matched.has(card.pairId);
              const frontRotate = a.flip.interpolate({
                inputRange: [0, 1],
                outputRange: ['180deg', '360deg'],
              });
              const backRotate = a.flip.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '180deg'],
              });
              return (
                <Animated.View
                  key={card.id}
                  style={{
                    width: cardW,
                    height: cardH,
                    opacity: entrance,
                    transform: [
                      {
                        translateY: entrance.interpolate({
                          inputRange: [0, 1],
                          outputRange: [24 + (i % COLS) * 8, 0],
                        }),
                      },
                      { scale: a.pop },
                      {
                        translateX: a.shake.interpolate({
                          inputRange: [-1, 1],
                          outputRange: [-7, 7],
                        }),
                      },
                    ],
                  }}
                >
                  <Pressable style={styles.cardPress} onPress={() => tapCard(card)}>
                    {/* Back (face-down) */}
                    <Animated.View
                      style={[
                        styles.cardFaceCommon,
                        { transform: [{ perspective: 900 }, { rotateY: backRotate }] },
                      ]}
                    >
                      <LinearGradient
                        colors={[C.cardBackHi, C.cardBack]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.cardBackInner}
                      >
                        <Sparkles size={22} color={C.mint + '88'} />
                      </LinearGradient>
                    </Animated.View>
                    {/* Front (face-up) */}
                    <Animated.View
                      style={[
                        styles.cardFaceCommon,
                        styles.cardFront,
                        isMatched && styles.cardFrontMatched,
                        { transform: [{ perspective: 900 }, { rotateY: frontRotate }] },
                      ]}
                    >
                      <Text
                        variant={card.face === 'word' ? 'titleSmall' : 'bodySmall'}
                        numberOfLines={4}
                        style={[
                          styles.cardLabel,
                          card.face === 'word' && styles.cardLabelWord,
                          isMatched && styles.cardLabelMatched,
                        ]}
                      >
                        {card.label}
                      </Text>
                    </Animated.View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          <Text variant="labelMedium" style={styles.footerHint}>
            Pair each word with its synonym or meaning
          </Text>

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
                  <Trophy size={46} color={C.gold} fill={C.gold} />
                </View>
                <Text variant="headlineSmall" style={styles.resultTitle}>
                  Board cleared!
                </Text>
                <Text style={styles.resultMoves}>
                  {moves}
                  <Text style={styles.resultMovesUnit}> moves</Text>
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
                  Every flip strengthens the link between word and meaning.
                </Text>
                <Pressable onPress={newRound}>
                  <LinearGradient
                    colors={[C.mint, '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.againBtn}
                  >
                    <RotateCcw size={18} color={C.ink} />
                    <Text variant="titleMedium" style={styles.againText}>
                      New board
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  headerBtn: { width: 36, alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: C.text, fontWeight: '800' },
  subtitle: { color: C.muted, marginTop: 2 },
  pairDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 6,
  },
  pairDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.cardBack,
    borderWidth: 1,
    borderColor: C.border,
  },
  pairDotDone: { backgroundColor: C.mint, borderColor: C.mint },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 8,
  },
  cardPress: { flex: 1 },
  cardFaceCommon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  cardBackInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardFront: {
    backgroundColor: C.cardFace,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderWidth: 2,
    borderColor: C.cardFace,
  },
  cardFrontMatched: { borderColor: C.mint, backgroundColor: '#D9F8EA' },
  cardLabel: { color: C.ink, textAlign: 'center' },
  cardLabelWord: { fontWeight: '800' },
  cardLabelMatched: { color: '#047857' },
  footerHint: { color: C.muted, textAlign: 'center', marginTop: 'auto', marginBottom: 14 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#010F0DE6',
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
  resultMoves: { color: C.mint, fontSize: 42, fontWeight: '800', marginTop: 4 },
  resultMovesUnit: { fontSize: 18, color: C.muted },
  newBestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.mint,
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
