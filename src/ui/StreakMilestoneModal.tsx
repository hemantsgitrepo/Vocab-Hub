import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Snowflake } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import { playSfx } from '../lib/sfx';
import Confetti from '../screens/games/Confetti';

// ---------------------------------------------------------------------------
// Streak milestone celebration (7 / 14 / 30 / 50 / 100 days).
// ---------------------------------------------------------------------------

const COPY: Record<number, { title: string; body: string }> = {
  7: {
    title: 'A full week!',
    body: 'Seven days straight. This is the point where a habit starts to feel automatic.',
  },
  14: {
    title: 'Two weeks strong',
    body: 'Fourteen days of showing up. Your vocabulary is compounding now.',
  },
  30: {
    title: 'A whole month',
    body: 'Thirty days. Most people never get here — you did it one day at a time.',
  },
  50: {
    title: 'Fifty days',
    body: 'Half a hundred. Your consistency is doing more work than any cram session could.',
  },
  100: {
    title: 'One hundred days',
    body: 'A hundred consecutive days. That is genuinely rare air — take a moment with this one.',
  },
};

export default function StreakMilestoneModal({
  milestone,
  freezes,
  onClose,
}: {
  milestone: number | null;
  freezes: number;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const pop = useMemo(() => new Animated.Value(0), []);
  const glow = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (milestone === null) return;
    playSfx('fanfare');
    Vibration.vibrate([0, 20, 60, 30, 60, 40]);
    pop.setValue(0);
    Animated.spring(pop, {
      toValue: 1,
      friction: 6,
      tension: 70,
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [milestone, pop, glow]);

  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (milestone === null) return null;

  const copy = COPY[milestone] ?? {
    title: `${milestone} days`,
    body: 'Another milestone on the board.',
  };

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Confetti count={40} />
        <Animated.View
          style={[
            styles.card,
            {
              opacity: pop,
              transform: [
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
              ],
            },
          ]}
        >
          <View style={styles.badgeWrap}>
            <Animated.View
              style={[
                styles.badgeGlow,
                {
                  backgroundColor: colors.amber + '3D',
                  transform: [
                    { scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) },
                  ],
                },
              ]}
            />
            <LinearGradient
              colors={[colors.amber, colors.coral]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badge}
            >
              <Flame size={34} color="#FFFFFF" fill="#FFFFFF" />
            </LinearGradient>
          </View>

          <Text variant="labelMedium" style={styles.kicker}>
            {milestone} DAY STREAK
          </Text>
          <Text variant="headlineSmall" style={styles.title}>
            {copy.title}
          </Text>
          <Text variant="bodyMedium" style={styles.body}>
            {copy.body}
          </Text>

          {freezes > 0 && (
            <View style={styles.freezePill}>
              <Snowflake size={13} color={colors.primary} />
              <Text variant="labelMedium" style={styles.freezeText}>
                {freezes} streak {freezes === 1 ? 'freeze' : 'freezes'} banked
              </Text>
            </View>
          )}

          <Pressable onPress={onClose} accessibilityRole="button" style={styles.btnWrap}>
            {({ pressed }) => (
              <LinearGradient
                colors={[colors.amber, colors.coral]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.btn, pressed && styles.pressed]}
              >
                <Text variant="titleSmall" style={styles.btnText}>
                  Keep it going
                </Text>
              </LinearGradient>
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
      paddingBottom: 20,
      alignItems: 'center',
      alignSelf: 'stretch',
      maxWidth: 380,
    },
    badgeWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    badgeGlow: { position: 'absolute', width: 94, height: 94, borderRadius: 47 },
    badge: {
      width: 74,
      height: 74,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kicker: { color: colors.amber, fontWeight: '800', letterSpacing: 0.9 },
    title: { color: colors.text, fontWeight: '800', textAlign: 'center', marginTop: 4 },
    body: { color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    freezePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 14,
      borderRadius: 12,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: colors.surfaceAlt,
    },
    freezeText: { color: colors.text, fontWeight: '600' },
    btnWrap: { alignSelf: 'stretch', marginTop: 20 },
    btn: { borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
    btnText: { color: '#FFFFFF', fontWeight: '800' },
    pressed: { opacity: 0.85 },
  });
