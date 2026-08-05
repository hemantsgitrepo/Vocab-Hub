import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { HeartCrack, Timer } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import { RepairChallenge } from '../lib/streakEngine';
import { playSfx } from '../lib/sfx';

// ---------------------------------------------------------------------------
// Streak repair challenge: a broken streak isn't gone yet — hit a bigger target
// inside 48 hours and it comes back. Deliberately encouraging rather than
// punishing, and always dismissible.
// ---------------------------------------------------------------------------

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 1) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export default function StreakRepairModal({
  repair,
  todayCount,
  onAccept,
  onDecline,
}: {
  repair: RepairChallenge | null;
  todayCount: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { colors } = useAppTheme();
  const pop = useMemo(() => new Animated.Value(0), []);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!repair) return;
    playSfx('tap');
    pop.setValue(0);
    Animated.spring(pop, {
      toValue: 1,
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start();
    // Tick the countdown while the sheet is open.
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [repair, pop]);

  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!repair) return null;

  const done = Math.min(todayCount, repair.target);
  const pct = repair.target > 0 ? done / repair.target : 0;

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: pop,
              transform: [
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
              ],
            },
          ]}
        >
          <View style={styles.iconWrap}>
            <HeartCrack size={26} color={colors.coral} />
          </View>

          <Text variant="titleLarge" style={styles.title}>
            Your {repair.brokenStreak}-day streak is on the line
          </Text>
          <Text variant="bodyMedium" style={styles.body}>
            You missed a day and had no freeze left — but it isn't gone yet. Learn{' '}
            <Text style={styles.strong}>{repair.target} words</Text> today and your{' '}
            {repair.brokenStreak}-day streak comes straight back.
          </Text>

          <View style={styles.timerRow}>
            <Timer size={13} color={colors.muted} />
            <Text variant="labelMedium" style={styles.timerText}>
              {formatRemaining(repair.expiresAt - now)}
            </Text>
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct * 100}%` }]} />
          </View>
          <Text variant="labelMedium" style={styles.progressText}>
            {done} / {repair.target} words today
          </Text>

          <Pressable
            onPress={() => {
              playSfx('tap');
              onAccept();
            }}
            accessibilityRole="button"
            style={styles.btnWrap}
          >
            {({ pressed }) => (
              <LinearGradient
                colors={[colors.primary, colors.violet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.btn, pressed && styles.pressed]}
              >
                <Text variant="titleSmall" style={styles.btnText}>
                  Take the challenge
                </Text>
              </LinearGradient>
            )}
          </Pressable>

          <Pressable onPress={onDecline} hitSlop={8} accessibilityRole="button">
            {({ pressed }) => (
              <Text variant="titleSmall" style={[styles.decline, pressed && styles.pressed]}>
                Let it go
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
      backgroundColor: '#000000B0',
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
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.coral + '22',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    title: { color: colors.text, fontWeight: '800', textAlign: 'center' },
    body: { color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    strong: { color: colors.text, fontWeight: '800' },
    timerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
    timerText: { color: colors.muted, fontWeight: '700' },
    track: {
      alignSelf: 'stretch',
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceAlt,
      marginTop: 14,
      overflow: 'hidden',
    },
    fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
    progressText: { color: colors.muted, marginTop: 6 },
    btnWrap: { alignSelf: 'stretch', marginTop: 18 },
    btn: { borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
    btnText: { color: '#FFFFFF', fontWeight: '800' },
    decline: { color: colors.muted, fontWeight: '700', marginTop: 12, padding: 6 },
    pressed: { opacity: 0.82 },
  });
