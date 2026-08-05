import React, { useEffect, useMemo } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronRight,
  Flame,
  GraduationCap,
  Headphones,
  HeartCrack,
  PlusCircle,
  Snowflake,
  Trophy,
  X,
} from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import {
  FREEZE_EVERY,
  MILESTONES,
  REPAIR_WINDOW_HOURS,
  StreakView,
} from '../lib/streakEngine';
import StreakCalendar from '../ui/StreakCalendar';

interface Props {
  visible: boolean;
  onClose: () => void;
  view: StreakView;
  /** Words per effective day — the calendar's data source. */
  counts: Map<string, number>;
  protectedDays: string[];
  firstActiveDay: string | null;
  totalWords: number;
  goal: number;
}

/** Next target, taken from the list the engine actually celebrates on. */
function nextMilestone(streak: number): number {
  return MILESTONES.find((m) => m > streak) ?? streak + 100;
}

function motivation(
  streak: number,
  todayMet: boolean,
  remaining: number,
  totalWords: number
): { title: string; body: string } {
  const words = (n: number) => `${n} more word${n === 1 ? '' : 's'}`;
  if (totalWords === 0) {
    return {
      title: 'Plant the first seed 🌱',
      body: 'Every rich vocabulary begins with a single word. Add yours today and light the flame.',
    };
  }
  if (streak === 0) {
    return todayMet
      ? {
          title: 'The flame is lit! 🔥',
          body: 'Day one is done. Come back tomorrow and turn a good day into a great habit.',
        }
      : {
          title: 'Rekindle the flame',
          body: `Add ${words(remaining)} today and a brand-new streak begins. Two focused minutes is all it takes.`,
        };
  }
  if (!todayMet) {
    return {
      title: "Don't break the chain",
      body: `You're ${words(remaining)} away from day ${streak + 1}. Your ${streak}-day flame is counting on you.`,
    };
  }
  if (streak < 7) {
    return {
      title: 'Momentum is building 🔥',
      body: `${streak} days strong — and today is already banked. Consistency now is what makes words stick for exam day.`,
    };
  }
  if (streak < 30) {
    return {
      title: "You're on fire! 🔥",
      body: `${streak} straight days of showing up. This is exactly how top scorers build their vocabulary — one day at a time.`,
    };
  }
  return {
    title: 'Legendary dedication 🏆',
    body: `${streak} consecutive days. Your future self — walking out of that exam hall — will thank you for this.`,
  };
}

export default function StreakJourneyModal({
  visible,
  onClose,
  view,
  counts,
  protectedDays,
  firstActiveDay,
  totalWords,
  goal,
}: Props) {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();

  const streak = view.streak;
  const best = view.longestStreak;
  const todayMet = view.todayMet;
  const remaining = view.remainingToday;
  const milestone = nextMilestone(streak);
  const message = motivation(streak, todayMet, remaining, totalWords);

  // Derived from the same effective-day counts the calendar uses, so the two
  // can't disagree across the 2am grace boundary.
  const metDays = useMemo(
    () => (goal > 0 ? [...counts.values()].filter((c) => c >= goal).length : 0),
    [counts, goal]
  );

  // ----- Animations -----
  const msgAnim = useMemo(() => new Animated.Value(0), []);
  const flameAnim = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    if (!visible) return;
    msgAnim.setValue(0);

    const entrance = Animated.timing(msgAnim, {
      toValue: 1,
      duration: 500,
      delay: 240,
      useNativeDriver: true,
    });
    const flameLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, {
          toValue: 1.15,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flameAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    entrance.start();
    flameLoop.start();
    return () => {
      entrance.stop();
      flameLoop.stop();
    };
  }, [visible, msgAnim, flameAnim]);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const goTo = (tab: string) => {
    onClose();
    navigation.navigate(tab);
  };

  // ----- Recommendations (max 3, most relevant first) -----
  const recommendations: {
    key: string;
    Icon: typeof PlusCircle;
    tint: string;
    title: string;
    body: string;
    tab: string;
  }[] = [];
  if (!todayMet) {
    recommendations.push({
      key: 'add',
      Icon: PlusCircle,
      tint: colors.primary,
      title: remaining === goal ? 'Start today’s session' : 'Finish today’s goal',
      body: `${remaining} word${remaining === 1 ? '' : 's'} to go — keep the flame alive.`,
      tab: 'Add',
    });
  } else {
    recommendations.push({
      key: 'bonus',
      Icon: PlusCircle,
      tint: colors.green,
      title: 'Go beyond the goal',
      body: 'Bank a bonus word while the momentum is hot.',
      tab: 'Add',
    });
  }
  if (totalWords >= 4) {
    recommendations.push({
      key: 'quiz',
      Icon: GraduationCap,
      tint: colors.violet,
      title: 'Quiz your recent words',
      body: 'Active recall is what moves words to "mastered".',
      tab: 'Quiz',
    });
  }
  if (totalWords >= 1) {
    recommendations.push({
      key: 'travel',
      Icon: Headphones,
      tint: colors.amber,
      title: 'Review hands-free',
      body: 'Let Travel Mode read your words on your next commute.',
      tab: 'Travel',
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* ----- Header ----- */}
          {/* Amber/coral matches the home streak card — one colour identity
              for the streak across both surfaces. */}
          <LinearGradient
            colors={[colors.amber, colors.coral]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={22} color="#FFFFFF" />
            </Pressable>
            <Animated.View style={[styles.flameHalo, { transform: [{ scale: flameAnim }] }]}>
              <Flame size={44} color="#FFFFFF" fill="#FFFFFF" />
            </Animated.View>
            <Text variant="displayMedium" style={styles.headerStreak}>
              {streak}
            </Text>
            <Text variant="titleMedium" style={styles.headerLabel}>
              day streak
            </Text>
            <Text variant="bodyMedium" style={styles.headerSub}>
              {streak >= milestone
                ? 'Beyond every milestone — keep going!'
                : `${milestone - streak} day${milestone - streak === 1 ? '' : 's'} to your ${milestone}-day milestone`}
            </Text>
          </LinearGradient>

          {/* ----- Stats strip ----- */}
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Card.Content style={styles.statContent}>
                <Trophy size={20} color={colors.amber} />
                <Text variant="titleLarge" style={styles.statNum}>
                  {best}
                </Text>
                <Text variant="labelSmall" style={styles.statLabel}>
                  best streak
                </Text>
              </Card.Content>
            </Card>
            <Card style={styles.statCard}>
              <Card.Content style={styles.statContent}>
                <Flame size={20} color={colors.primary} />
                <Text variant="titleLarge" style={styles.statNum}>
                  {metDays}
                </Text>
                <Text variant="labelSmall" style={styles.statLabel}>
                  days completed
                </Text>
              </Card.Content>
            </Card>
            <Card style={styles.statCard}>
              <Card.Content style={styles.statContent}>
                <Snowflake size={20} color={colors.primary} />
                <Text variant="titleLarge" style={styles.statNum}>
                  {view.freezes}
                </Text>
                <Text variant="labelSmall" style={styles.statLabel}>
                  {view.freezes === 1 ? 'freeze ready' : 'freezes ready'}
                </Text>
              </Card.Content>
            </Card>
          </View>

          {/* ----- Activity calendar ----- */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Your activity
          </Text>
          <StreakCalendar
            counts={counts}
            protectedDays={protectedDays}
            goal={goal}
            firstActiveDay={firstActiveDay}
          />

          {/* ----- How the safety net works ----- */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Your safety net
          </Text>
          <Card style={styles.messageCard}>
            <Card.Content>
              <View style={styles.netRow}>
                <View style={[styles.netIcon, { backgroundColor: colors.primary + '22' }]}>
                  <Snowflake size={18} color={colors.primary} />
                </View>
                <View style={styles.netText}>
                  <Text variant="titleSmall" style={styles.netTitle}>
                    Streak freezes
                  </Text>
                  <Text variant="bodySmall" style={styles.netBody}>
                    You earn one free freeze every {FREEZE_EVERY} days. Miss a day and a freeze is
                    spent automatically to keep your streak alive — those days show as
                    {' '}snowflakes above.
                  </Text>
                </View>
              </View>
              <View style={[styles.netRow, styles.netRowLast]}>
                <View style={[styles.netIcon, { backgroundColor: colors.coral + '22' }]}>
                  <HeartCrack size={18} color={colors.coral} />
                </View>
                <View style={styles.netText}>
                  <Text variant="titleSmall" style={styles.netTitle}>
                    Repair challenge
                  </Text>
                  <Text variant="bodySmall" style={styles.netBody}>
                    Break a streak with no freeze left and you get {REPAIR_WINDOW_HOURS} hours to
                    win it back in one bigger session.
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>


          {/* ----- Motivation ----- */}
          <Animated.View
            style={{
              opacity: msgAnim,
              transform: [
                {
                  translateY: msgAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
                },
              ],
            }}
          >
            <Card style={styles.messageCard}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.messageTitle}>
                  {message.title}
                </Text>
                <Text variant="bodyMedium" style={styles.messageBody}>
                  {message.body}
                </Text>
              </Card.Content>
            </Card>

            <Text variant="titleMedium" style={styles.sectionTitle}>
              Keep it going
            </Text>
            {recommendations.map((rec) => (
              <Pressable key={rec.key} onPress={() => goTo(rec.tab)}>
                {({ pressed }) => (
                  <Card style={[styles.recCard, pressed && styles.recCardPressed]}>
                    <Card.Content style={styles.recContent}>
                      <View style={[styles.recIcon, { backgroundColor: rec.tint + '22' }]}>
                        <rec.Icon size={20} color={rec.tint} />
                      </View>
                      <View style={styles.recText}>
                        <Text variant="titleSmall" style={styles.recTitle}>
                          {rec.title}
                        </Text>
                        <Text variant="bodySmall" style={styles.recBody}>
                          {rec.body}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={colors.muted} />
                    </Card.Content>
                  </Card>
                )}
              </Pressable>
            ))}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 40 },
    header: {
      borderRadius: 24,
      paddingVertical: 28,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    closeBtn: {
      position: 'absolute',
      top: 14,
      right: 14,
      backgroundColor: '#FFFFFF26',
      borderRadius: 16,
      padding: 6,
    },
    flameHalo: {
      backgroundColor: '#FFFFFF1F',
      borderRadius: 40,
      padding: 16,
      marginBottom: 8,
    },
    headerStreak: { color: '#FFFFFF', fontWeight: '700', lineHeight: 52 },
    headerLabel: { color: '#FFFFFFE6', fontWeight: '700' },
    headerSub: { color: '#FFFFFFCC', marginTop: 8, textAlign: 'center' },
    statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    statCard: { flex: 1, backgroundColor: colors.surface },
    statContent: { alignItems: 'center', gap: 2, paddingVertical: 12, paddingHorizontal: 4 },
    statNum: { color: colors.text, fontWeight: '700' },
    statLabel: { color: colors.muted, textAlign: 'center' },
    sectionTitle: { color: colors.text, fontWeight: '600', marginTop: 20, marginBottom: 8 },
    netRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
    netRowLast: { marginBottom: 0 },
    netIcon: {
      width: 36,
      height: 36,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    netText: { flex: 1 },
    netTitle: { color: colors.text, fontWeight: '700' },
    netBody: { color: colors.muted, marginTop: 2, lineHeight: 18 },
    messageCard: { backgroundColor: colors.surface, marginTop: 20 },
    messageTitle: { color: colors.text, fontWeight: '700' },
    messageBody: { color: colors.muted, marginTop: 4, lineHeight: 21 },
    recCard: { backgroundColor: colors.surface, marginBottom: 10 },
    recCardPressed: { opacity: 0.75 },
    recContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    recIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recText: { flex: 1 },
    recTitle: { color: colors.text, fontWeight: '600' },
    recBody: { color: colors.muted, marginTop: 1 },
  });
