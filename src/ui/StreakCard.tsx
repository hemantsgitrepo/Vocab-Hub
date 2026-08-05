import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Flame, Snowflake, Trophy } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import { StreakView } from '../lib/streakEngine';
import { playSfx } from '../lib/sfx';

// ---------------------------------------------------------------------------
// Dashboard streak card: the live streak with a breathing flame, the personal
// best, and the freeze inventory that makes the streak forgiving.
// ---------------------------------------------------------------------------

export default function StreakCard({
  view,
  onPress,
}: {
  view: StreakView;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const flame = useMemo(() => new Animated.Value(0), []);
  const pop = useMemo(() => new Animated.Value(0), []);

  // Breathing flame — a slow loop, so it reads as alive without nagging.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flame, {
          toValue: 1,
          duration: 1150,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flame, {
          toValue: 0,
          duration: 1150,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flame]);

  // A small pop whenever the number itself changes.
  useEffect(() => {
    pop.setValue(0);
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [view.streak, pop]);

  const styles = useMemo(() => makeStyles(colors), [colors]);
  const alive = view.streak > 0;
  const freezePct = 1 - view.daysToNextFreeze / 10;

  return (
    <Pressable
      onPress={() => {
        playSfx('tap');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${view.streak} day streak. Open your streak journey.`}
    >
      {({ pressed }) => (
        <LinearGradient
          colors={alive ? [colors.amber, colors.coral] : [colors.surfaceAlt, colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, pressed && styles.pressed]}
        >
          <View style={styles.topRow}>
            <Animated.View
              style={[
                styles.flameWrap,
                alive && {
                  transform: [
                    {
                      scale: flame.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.14],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Flame
                size={30}
                color={alive ? '#FFFFFF' : colors.muted}
                fill={alive ? '#FFFFFF' : 'transparent'}
              />
            </Animated.View>

            <View style={styles.countWrap}>
              <Animated.Text
                style={[
                  styles.count,
                  !alive && styles.countIdle,
                  {
                    transform: [
                      {
                        scale: pop.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.72, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {view.streak}
              </Animated.Text>
              <Text variant="titleSmall" style={[styles.unit, !alive && styles.unitIdle]}>
                {view.streak === 1 ? 'day streak' : 'day streak'}
              </Text>
            </View>

            <ChevronRight size={20} color={alive ? '#FFFFFFCC' : colors.muted} />
          </View>

          <Text variant="bodySmall" style={[styles.hint, !alive && styles.hintIdle]}>
            {view.todayMet
              ? "Today's goal is done — come back tomorrow to keep it going."
              : view.remainingToday === 1
                ? '1 more word today to extend your streak.'
                : `${view.remainingToday} more words today to extend your streak.`}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Trophy size={14} color={alive ? '#FFFFFF' : colors.amber} />
              <Text variant="labelMedium" style={[styles.statText, !alive && styles.statTextIdle]}>
                Best {view.longestStreak}
              </Text>
            </View>
            <View style={styles.stat}>
              <Snowflake size={14} color={alive ? '#FFFFFF' : colors.primary} />
              <Text variant="labelMedium" style={[styles.statText, !alive && styles.statTextIdle]}>
                {view.freezes} {view.freezes === 1 ? 'freeze' : 'freezes'}
              </Text>
            </View>
          </View>

          {/* Progress toward the next free freeze */}
          <View style={styles.freezeTrack}>
            <View
              style={[
                styles.freezeFill,
                {
                  width: `${Math.max(0, Math.min(1, freezePct)) * 100}%`,
                  backgroundColor: alive ? '#FFFFFF' : colors.primary,
                },
              ]}
            />
          </View>
          <Text variant="labelSmall" style={[styles.freezeHint, !alive && styles.hintIdle]}>
            {view.daysToNextFreeze === 0
              ? 'A new freeze is ready'
              : `${view.daysToNextFreeze} more ${
                  view.daysToNextFreeze === 1 ? 'day' : 'days'
                } until your next free freeze`}
          </Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: { borderRadius: 24, padding: 18, marginTop: 14 },
    pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    flameWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#FFFFFF2E',
      alignItems: 'center',
      justifyContent: 'center',
    },
    countWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    count: { color: '#FFFFFF', fontSize: 40, fontWeight: '800', lineHeight: 46 },
    countIdle: { color: colors.text },
    unit: { color: '#FFFFFFE0', fontWeight: '700' },
    unitIdle: { color: colors.muted },
    hint: { color: '#FFFFFFDD', marginTop: 10, lineHeight: 18 },
    hintIdle: { color: colors.muted },
    statsRow: { flexDirection: 'row', gap: 16, marginTop: 14 },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statText: { color: '#FFFFFF', fontWeight: '700' },
    statTextIdle: { color: colors.text },
    freezeTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: '#FFFFFF3D',
      marginTop: 14,
      overflow: 'hidden',
    },
    freezeFill: { height: 6, borderRadius: 3 },
    freezeHint: { color: '#FFFFFFC4', marginTop: 6 },
  });
