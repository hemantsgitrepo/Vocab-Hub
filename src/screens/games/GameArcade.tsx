import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { Gamepad2, Lock, Play, PlusCircle, Trophy } from 'lucide-react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../ThemeContext';
import { useAllWords, useGameUnlockStatus } from '../../hooks';
import { getGameStat, getMemoryBest, getMillionaireBest } from '../../db/settings';
import { initSfx, playSfx } from '../../lib/sfx';
import { GAMES, GameKey } from '../../lib/games';
import { GAME_GUIDES } from '../../lib/guides';
import { CARD_GRADIENTS, CARD_ICONS } from './gameVisuals';
import { useUnlockCelebration } from '../../ui/UnlockProvider';
import UnlockCelebration from '../../ui/UnlockCelebration';
import { InfoSheet } from '../../ui/InfoSheet';
import VocabMillionaire from './VocabMillionaire';
import MemoryMatch from './MemoryMatch';
import ScrabbleGame from './ScrabbleGame';
import CrosswordGame from './CrosswordGame';
import SpellingBeeGame from './SpellingBeeGame';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ZERO_BESTS: Record<GameKey, number> = {
  millionaire: 0,
  memory: 0,
  scrabble: 0,
  crossword: 0,
  bee: 0,
};

function bestLabelFor(key: GameKey, value: number): string {
  if (value <= 0) return 'No score yet';
  switch (key) {
    case 'millionaire':
      return `Best ${value.toLocaleString('en-US')} pts`;
    case 'memory':
      return `Best ${value} moves`;
    case 'crossword':
      return `Solved ×${value}`;
    default:
      return `Best ${value} pts`;
  }
}

const RING_R = 44;
const RING_LEN = 2 * Math.PI * RING_R;

/**
 * "Game Arcade" section: interactive cards for each game mode with live
 * unlock progression, plus the games themselves. Drop-in for any screen.
 */
export default function GameArcade() {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const words = useAllWords();
  const { totalWords, games } = useGameUnlockStatus();

  const [openGame, setOpenGame] = useState<GameKey | null>(null);
  const [teaser, setTeaser] = useState<GameKey | null>(null);
  const [guideFor, setGuideFor] = useState<GameKey | null>(null);
  const [bests, setBests] = useState<Record<GameKey, number>>(ZERO_BESTS);

  // The arcade is mounted on two tabs at once, so only the focused copy shows
  // the celebration — otherwise it would render twice.
  const isFocused = useIsFocused();
  const { celebration, dismiss } = useUnlockCelebration();

  const refreshBests = useCallback(() => {
    Promise.all([
      getMillionaireBest(),
      getMemoryBest(),
      getGameStat('scrabble'),
      getGameStat('crossword'),
      getGameStat('bee'),
    ]).then(([millionaire, memory, scrabble, crossword, bee]) =>
      setBests({ millionaire, memory, scrabble, crossword, bee })
    );
  }, []);
  useFocusEffect(refreshBests);

  // Warm up audio players + the user's sound preference before first play.
  useEffect(() => {
    initSfx().catch(() => {});
  }, []);

  // ----- Animations -----
  const cardAnims = useMemo(() => GAMES.map(() => new Animated.Value(0)), []);
  const playPulse = useMemo(() => new Animated.Value(1), []);
  const shimmer = useMemo(() => new Animated.Value(0), []);
  const sheetAnim = useMemo(() => new Animated.Value(0), []);
  const ringAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.stagger(
      120,
      cardAnims.map((a) =>
        Animated.spring(a, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true })
      )
    ).start();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(playPulse, {
          toValue: 1.09,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(playPulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1600),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    pulse.start();
    sweep.start();
    return () => {
      pulse.stop();
      sweep.stop();
    };
  }, [cardAnims, playPulse, shimmer]);

  const openTeaser = (key: GameKey) => {
    playSfx('tap');
    setTeaser(key);
    sheetAnim.setValue(0);
    ringAnim.setValue(0);
    Animated.parallel([
      Animated.spring(sheetAnim, { toValue: 1, friction: 8, tension: 65, useNativeDriver: true }),
      Animated.timing(ringAnim, {
        toValue: games[key].progress,
        duration: 900,
        delay: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // SVG stroke props need the JS driver
      }),
    ]).start();
  };

  const styles = useMemo(() => makeStyles(colors), [colors]);
  const teaserGame = teaser ? GAMES.find((g) => g.key === teaser)! : null;

  return (
    <View>
      <View style={styles.titleRow}>
        <Gamepad2 size={18} color={colors.violet} />
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Game Arcade
        </Text>
      </View>

      <View style={styles.cardsRow}>
        {GAMES.map((game, i) => {
          const status = games[game.key];
          const [gradA, gradB] = CARD_GRADIENTS[game.key];
          const Icon = CARD_ICONS[game.key];
          const bestLabel = bestLabelFor(game.key, bests[game.key]);

          return (
            <Animated.View
              key={game.key}
              style={[
                styles.cardWrap,
                {
                  opacity: cardAnims[i],
                  transform: [
                    {
                      translateY: cardAnims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [22, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {status.unlocked ? (
                <Pressable
                  onPress={() => {
                    playSfx('tap');
                    setOpenGame(game.key);
                  }}
                >
                  {({ pressed }) => (
                    <LinearGradient
                      colors={[gradA, gradB]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.card, pressed && styles.cardPressed]}
                    >
                      {/* Shimmer sweep */}
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.shimmer,
                          {
                            transform: [
                              {
                                translateX: shimmer.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [-90, 240],
                                }),
                              },
                              { rotate: '18deg' },
                            ],
                          },
                        ]}
                      />
                      <Icon size={26} color="#FFFFFF" />
                      <Text variant="titleSmall" style={styles.cardTitle}>
                        {game.title}
                      </Text>
                      <View style={styles.bestRow}>
                        <Trophy size={11} color="#FDE68A" />
                        <Text variant="labelSmall" style={styles.bestText}>
                          {bestLabel}
                        </Text>
                      </View>
                      <Animated.View
                        style={[styles.playChip, { transform: [{ scale: playPulse }] }]}
                      >
                        <Play size={12} color={gradA} fill={gradA} />
                        <Text variant="labelMedium" style={[styles.playChipText, { color: gradA }]}>
                          PLAY
                        </Text>
                      </Animated.View>
                    </LinearGradient>
                  )}
                </Pressable>
              ) : (
                <Pressable onPress={() => openTeaser(game.key)}>
                  {({ pressed }) => (
                    <View style={[styles.card, styles.cardLocked, pressed && styles.cardPressed]}>
                      <View style={styles.lockBadge}>
                        <Lock size={18} color={colors.muted} />
                      </View>
                      <Text variant="titleSmall" style={styles.cardTitleLocked}>
                        {game.title}
                      </Text>
                      <Text variant="labelSmall" style={styles.lockCount}>
                        {totalWords} / {status.unlockAt} words added
                      </Text>
                      <View style={styles.progressTrack}>
                        <View
                          style={[styles.progressFill, { width: `${status.progress * 100}%` }]}
                        />
                      </View>
                    </View>
                  )}
                </Pressable>
              )}
            </Animated.View>
          );
        })}
      </View>

      {/* ----- Locked teaser sheet ----- */}
      <Modal
        visible={teaser !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTeaser(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setTeaser(null)}>
          <Pressable onPress={() => {}}>
            <Animated.View
              style={[
                styles.sheet,
                {
                  opacity: sheetAnim,
                  transform: [
                    {
                      translateY: sheetAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [120, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {teaserGame && (
                <>
                  <View style={styles.ringWrap}>
                    <Svg width={110} height={110}>
                      <Circle
                        cx={55}
                        cy={55}
                        r={RING_R}
                        stroke={colors.border}
                        strokeWidth={7}
                        fill="none"
                      />
                      <AnimatedCircle
                        cx={55}
                        cy={55}
                        r={RING_R}
                        stroke={CARD_GRADIENTS[teaserGame.key][0]}
                        strokeWidth={7}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={`${RING_LEN} ${RING_LEN}`}
                        strokeDashoffset={ringAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [RING_LEN, 0],
                        })}
                        transform="rotate(-90 55 55)"
                      />
                    </Svg>
                    <View style={styles.ringCenter}>
                      <Lock size={16} color={colors.muted} />
                      <Text variant="titleMedium" style={styles.ringCount}>
                        {totalWords}/{teaserGame.unlockAt}
                      </Text>
                    </View>
                  </View>
                  <Text variant="titleLarge" style={styles.sheetTitle}>
                    {teaserGame.title} awaits!
                  </Text>
                  <Text variant="bodyMedium" style={styles.sheetBody}>
                    {teaserGame.tagline}
                  </Text>
                  <Text variant="bodyMedium" style={styles.sheetCount}>
                    Add{' '}
                    <Text style={styles.sheetCountStrong}>
                      {games[teaserGame.key].remaining} more word
                      {games[teaserGame.key].remaining === 1 ? '' : 's'}
                    </Text>{' '}
                    to step into the arena. Every word you learn is a move toward the win.
                  </Text>
                  <Pressable
                    onPress={() => {
                      playSfx('tap');
                      setTeaser(null);
                      navigation.navigate('Add');
                    }}
                  >
                    <LinearGradient
                      colors={CARD_GRADIENTS[teaserGame.key]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.sheetBtn}
                    >
                      <PlusCircle size={18} color="#FFFFFF" />
                      <Text variant="titleSmall" style={styles.sheetBtnText}>
                        Add words now
                      </Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      playSfx('tap');
                      const key = teaserGame.key;
                      setTeaser(null);
                      setGuideFor(key);
                    }}
                    hitSlop={8}
                  >
                    <Text variant="labelLarge" style={styles.sheetGuide}>
                      How this game works
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setTeaser(null)} hitSlop={8}>
                    <Text variant="labelLarge" style={styles.sheetDismiss}>
                      I'll be back
                    </Text>
                  </Pressable>
                </>
              )}
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ----- The games ----- */}
      <VocabMillionaire
        visible={openGame === 'millionaire'}
        onClose={() => {
          setOpenGame(null);
          refreshBests();
        }}
        words={words}
      />
      <MemoryMatch
        visible={openGame === 'memory'}
        onClose={() => {
          setOpenGame(null);
          refreshBests();
        }}
        words={words}
      />
      <ScrabbleGame
        visible={openGame === 'scrabble'}
        onClose={() => {
          setOpenGame(null);
          refreshBests();
        }}
        words={words}
      />
      <CrosswordGame
        visible={openGame === 'crossword'}
        onClose={() => {
          setOpenGame(null);
          refreshBests();
        }}
        words={words}
      />
      <SpellingBeeGame
        visible={openGame === 'bee'}
        onClose={() => {
          setOpenGame(null);
          refreshBests();
        }}
        words={words}
      />

      {/* ----- Rules preview for a still-locked game ----- */}
      {guideFor && (
        <InfoSheet
          visible
          onClose={() => setGuideFor(null)}
          guide={GAME_GUIDES[guideFor]}
        />
      )}

      {/* ----- Milestone unlock celebration ----- */}
      {isFocused && (
        <UnlockCelebration
          game={celebration?.game ?? null}
          alsoUnlocked={celebration?.alsoUnlocked ?? 0}
          onPlay={() => {
            const key = celebration?.game.key;
            dismiss();
            if (key) setOpenGame(key);
          }}
          onClose={dismiss}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    sheetGuide: {
      color: colors.primary,
      textAlign: 'center',
      fontWeight: '700',
      marginTop: 14,
      padding: 4,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 24,
      marginBottom: 8,
    },
    sectionTitle: { color: colors.text, fontWeight: '600' },
    cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    cardWrap: { flexBasis: '47%', flexGrow: 1 },
    card: {
      borderRadius: 18,
      padding: 14,
      minHeight: 148,
      overflow: 'hidden',
    },
    cardPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
    shimmer: {
      position: 'absolute',
      top: -30,
      bottom: -30,
      width: 46,
      backgroundColor: '#FFFFFF2E',
    },
    cardTitle: { color: '#FFFFFF', fontWeight: '800', marginTop: 8 },
    bestRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    bestText: { color: '#FDE68A' },
    playChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: 12,
      alignSelf: 'flex-start',
      marginTop: 10,
    },
    playChipText: { fontWeight: '800', letterSpacing: 0.5 },
    cardLocked: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    lockBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitleLocked: { color: colors.text, fontWeight: '700', marginTop: 8 },
    lockCount: { color: colors.muted, marginTop: 2 },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceAlt,
      marginTop: 12,
      overflow: 'hidden',
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.violet,
    },
    sheetBackdrop: {
      flex: 1,
      backgroundColor: '#000000A0',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 36,
      alignItems: 'center',
    },
    ringWrap: { alignItems: 'center', justifyContent: 'center' },
    ringCenter: {
      position: 'absolute',
      alignItems: 'center',
    },
    ringCount: { color: colors.text, fontWeight: '800', marginTop: 2 },
    sheetTitle: { color: colors.text, fontWeight: '800', marginTop: 12 },
    sheetBody: { color: colors.muted, textAlign: 'center', marginTop: 4 },
    sheetCount: {
      color: colors.text,
      textAlign: 'center',
      marginTop: 14,
      lineHeight: 22,
    },
    sheetCountStrong: { color: colors.violet, fontWeight: '800' },
    sheetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 24,
      paddingVertical: 13,
      paddingHorizontal: 28,
      marginTop: 20,
    },
    sheetBtnText: { color: '#FFFFFF', fontWeight: '800' },
    sheetDismiss: { color: colors.muted, marginTop: 16 },
  });
