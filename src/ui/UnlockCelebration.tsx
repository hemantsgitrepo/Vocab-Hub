import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Sparkles } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import { GameDef } from '../lib/games';
import { CARD_GRADIENTS, CARD_ICONS } from '../screens/games/gameVisuals';
import { playSfx } from '../lib/sfx';
import Confetti from '../screens/games/Confetti';

// ---------------------------------------------------------------------------
// Milestone unlock celebration: confetti, fanfare and a direct route into the
// game the user just earned. Fires once per game (see useUnlockCelebration).
// ---------------------------------------------------------------------------

interface UnlockCelebrationProps {
  /** The game to headline, or null when nothing is being celebrated. */
  game: GameDef | null;
  /** How many *other* games unlocked in the same batch (bulk CSV import). */
  alsoUnlocked?: number;
  onPlay: () => void;
  onClose: () => void;
}

export default function UnlockCelebration({
  game,
  alsoUnlocked = 0,
  onPlay,
  onClose,
}: UnlockCelebrationProps) {
  const { colors } = useAppTheme();
  const pop = useMemo(() => new Animated.Value(0), []);
  const glow = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (!game) return;
    playSfx('fanfare');
    Vibration.vibrate([0, 18, 70, 26]);
    pop.setValue(0);
    Animated.spring(pop, {
      toValue: 1,
      friction: 6,
      tension: 72,
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [game, pop, glow]);

  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!game) return null;

  const [gradA, gradB] = CARD_GRADIENTS[game.key];
  const Icon = CARD_ICONS[game.key];

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Confetti count={34} />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: pop,
              transform: [
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
              ],
            },
          ]}
        >
          <View style={styles.badgeWrap}>
            <Animated.View
              style={[
                styles.badgeGlow,
                {
                  backgroundColor: gradA + '38',
                  transform: [
                    { scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) },
                  ],
                },
              ]}
            />
            <LinearGradient
              colors={[gradA, gradB]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badge}
            >
              <Icon size={34} color="#FFFFFF" />
            </LinearGradient>
          </View>

          <View style={styles.kicker}>
            <Sparkles size={13} color={colors.amber} />
            <Text variant="labelMedium" style={styles.kickerText}>
              {game.unlockAt} WORDS REACHED
            </Text>
          </View>

          <Text variant="headlineSmall" style={styles.title}>
            {game.title} unlocked!
          </Text>
          <Text variant="bodyMedium" style={styles.tagline}>
            {game.tagline}
          </Text>

          {alsoUnlocked > 0 && (
            <View style={styles.alsoPill}>
              <Text variant="labelMedium" style={styles.alsoText}>
                +{alsoUnlocked} more {alsoUnlocked === 1 ? 'game' : 'games'} unlocked too
              </Text>
            </View>
          )}

          <Pressable onPress={onPlay} accessibilityRole="button" style={styles.playWrap}>
            {({ pressed }) => (
              <LinearGradient
                colors={[gradA, gradB]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.playBtn, pressed && styles.pressed]}
              >
                <Play size={17} color="#FFFFFF" fill="#FFFFFF" />
                <Text variant="titleSmall" style={styles.playText}>
                  Play now
                </Text>
              </LinearGradient>
            )}
          </Pressable>

          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
            {({ pressed }) => (
              <Text variant="titleSmall" style={[styles.later, pressed && styles.pressed]}>
                Maybe later
              </Text>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: '#000000BB',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 24,
      paddingTop: 26,
      paddingBottom: 18,
      alignItems: 'center',
      alignSelf: 'stretch',
      maxWidth: 380,
    },
    badgeWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    badgeGlow: { position: 'absolute', width: 92, height: 92, borderRadius: 46 },
    badge: {
      width: 72,
      height: 72,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kicker: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    kickerText: { color: colors.amber, fontWeight: '800', letterSpacing: 0.7 },
    title: {
      color: colors.text,
      fontWeight: '800',
      textAlign: 'center',
      marginTop: 5,
    },
    tagline: {
      color: colors.muted,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 20,
    },
    alsoPill: {
      marginTop: 12,
      borderRadius: 12,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: colors.surfaceAlt,
    },
    alsoText: { color: colors.muted, fontWeight: '600' },
    playWrap: { alignSelf: 'stretch', marginTop: 20 },
    playBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 18,
      paddingVertical: 14,
    },
    playText: { color: '#FFFFFF', fontWeight: '800' },
    later: { color: colors.muted, fontWeight: '700', marginTop: 14, padding: 6 },
    pressed: { opacity: 0.82 },
  });
