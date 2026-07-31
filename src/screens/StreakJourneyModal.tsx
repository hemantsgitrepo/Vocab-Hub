import React, { useEffect, useMemo, useState } from 'react';
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
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import {
  BookOpen,
  ChevronRight,
  Flame,
  GraduationCap,
  Headphones,
  PlusCircle,
  Trophy,
  X,
} from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import { DayEntry } from '../lib/streak';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const MILESTONES = [3, 7, 14, 21, 30, 50, 100, 365];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const COLS = 4;
const NODE_R = 21;
const ROW_H = 96;
const LABEL_H = 34;

interface Props {
  visible: boolean;
  onClose: () => void;
  history: DayEntry[]; // oldest first, ends today
  streak: number;
  best: number;
  metDays: number;
  totalWords: number;
  goal: number;
}

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
  history,
  streak,
  best,
  metDays,
  totalWords,
  goal,
}: Props) {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const [mapWidth, setMapWidth] = useState(0);

  const today = history[history.length - 1];
  const todayMet = today?.met ?? false;
  const remaining = Math.max(goal - (today?.count ?? 0), 0);
  const milestone = nextMilestone(streak);
  const message = motivation(streak, todayMet, remaining, totalWords);

  // ----- Geometry: serpentine node positions + connecting path -----
  const nodeCount = history.length + 1; // +1 trophy milestone node
  const geometry = useMemo(() => {
    if (mapWidth <= 0) return null;
    const colW = mapWidth / COLS;
    const points = Array.from({ length: nodeCount }, (_, i) => {
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      const c = row % 2 === 0 ? col : COLS - 1 - col; // snake back on odd rows
      return { x: colW * c + colW / 2, y: NODE_R + 8 + row * ROW_H };
    });
    let d = `M ${points[0].x} ${points[0].y}`;
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      if (prev.y === cur.y) {
        d += ` L ${cur.x} ${cur.y}`;
        length += Math.abs(cur.x - prev.x);
      } else {
        // U-turn into the next row, bulging past the outer edge.
        const dir = prev.x > mapWidth / 2 ? 1 : -1;
        const bulge = colW * 0.6 * dir;
        d += ` C ${prev.x + bulge} ${prev.y}, ${cur.x + bulge} ${cur.y}, ${cur.x} ${cur.y}`;
        length += ROW_H + Math.abs(bulge) * 1.3; // close-enough arc length
      }
    }
    const height = points[points.length - 1].y + NODE_R + LABEL_H;
    return { points, d, length, height, colW };
  }, [mapWidth, nodeCount]);

  // ----- Animations -----
  const pathAnim = useMemo(() => new Animated.Value(0), []);
  const msgAnim = useMemo(() => new Animated.Value(0), []);
  const flameAnim = useMemo(() => new Animated.Value(1), []);
  const ringAnim = useMemo(() => new Animated.Value(0), []);
  const nodeAnims = useMemo(
    () => Array.from({ length: nodeCount }, () => new Animated.Value(0)),
    [nodeCount]
  );

  useEffect(() => {
    if (!visible) return;
    pathAnim.setValue(0);
    msgAnim.setValue(0);
    nodeAnims.forEach((a) => a.setValue(0));

    const entrance = Animated.parallel([
      Animated.timing(pathAnim, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false, // SVG props need the JS driver
      }),
      Animated.stagger(
        55,
        nodeAnims.map((a) =>
          Animated.spring(a, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true })
        )
      ),
      Animated.timing(msgAnim, {
        toValue: 1,
        duration: 500,
        delay: 700,
        useNativeDriver: true,
      }),
    ]);
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
    const ringLoop = Animated.loop(
      Animated.timing(ringAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    entrance.start();
    flameLoop.start();
    ringLoop.start();
    return () => {
      entrance.stop();
      flameLoop.stop();
      ringLoop.stop();
    };
  }, [visible, nodeAnims, pathAnim, msgAnim, flameAnim, ringAnim]);

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
          <LinearGradient
            colors={[colors.primary, colors.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={22} color="#FFFFFF" />
            </Pressable>
            <Animated.View style={[styles.flameHalo, { transform: [{ scale: flameAnim }] }]}>
              <Flame size={44} color={colors.amber} fill={colors.amber} />
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
                <BookOpen size={20} color={colors.violet} />
                <Text variant="titleLarge" style={styles.statNum}>
                  {totalWords}
                </Text>
                <Text variant="labelSmall" style={styles.statLabel}>
                  words learned
                </Text>
              </Card.Content>
            </Card>
          </View>

          {/* ----- Journey map ----- */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Your last {history.length} days
          </Text>
          <Card style={styles.mapCard}>
            <Card.Content>
              <View onLayout={(e) => setMapWidth(e.nativeEvent.layout.width)}>
                {geometry && (
                  <View style={{ height: geometry.height }}>
                    <Svg width={mapWidth} height={geometry.height}>
                      <Defs>
                        <SvgGradient id="journey" x1="0" y1="0" x2="1" y2="1">
                          <Stop offset="0" stopColor={colors.primary} />
                          <Stop offset="1" stopColor={colors.violet} />
                        </SvgGradient>
                      </Defs>
                      {/* Faint full route underneath, so the road ahead is visible */}
                      <Path
                        d={geometry.d}
                        stroke={colors.border}
                        strokeWidth={4}
                        strokeLinecap="round"
                        fill="none"
                      />
                      <AnimatedPath
                        d={geometry.d}
                        stroke="url(#journey)"
                        strokeWidth={4}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={[geometry.length, geometry.length]}
                        strokeDashoffset={pathAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [geometry.length, 0],
                        })}
                      />
                    </Svg>
                    {history.map((day, i) => {
                      const p = geometry.points[i];
                      const label = day.isToday ? 'Today' : WEEKDAYS[day.date.getDay()];
                      return (
                        <Animated.View
                          key={day.date.getTime()}
                          style={[
                            styles.nodeWrap,
                            {
                              left: p.x - geometry.colW / 2,
                              top: p.y - NODE_R,
                              width: geometry.colW,
                              opacity: nodeAnims[i],
                              transform: [{ scale: nodeAnims[i] }],
                            },
                          ]}
                        >
                          {day.isToday && (
                            <Animated.View
                              style={[
                                styles.todayRing,
                                {
                                  opacity: ringAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.55, 0],
                                  }),
                                  transform: [
                                    {
                                      scale: ringAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [1, 1.7],
                                      }),
                                    },
                                  ],
                                },
                              ]}
                            />
                          )}
                          <View
                            style={[
                              styles.node,
                              day.met
                                ? styles.nodeMet
                                : day.isToday
                                  ? styles.nodeToday
                                  : styles.nodeMissed,
                            ]}
                          >
                            {day.met ? (
                              <Flame size={20} color="#FFFFFF" fill="#FFFFFF" />
                            ) : day.isToday ? (
                              <Text variant="labelMedium" style={styles.nodeCount}>
                                {day.count}/{goal}
                              </Text>
                            ) : (
                              <View style={styles.nodeDot} />
                            )}
                          </View>
                          <Text
                            variant="labelSmall"
                            style={[styles.nodeLabel, day.isToday && styles.nodeLabelToday]}
                          >
                            {label}
                          </Text>
                        </Animated.View>
                      );
                    })}
                    {/* Trophy node: the next milestone up the road */}
                    {(() => {
                      const p = geometry.points[nodeCount - 1];
                      return (
                        <Animated.View
                          style={[
                            styles.nodeWrap,
                            {
                              left: p.x - geometry.colW / 2,
                              top: p.y - NODE_R,
                              width: geometry.colW,
                              opacity: nodeAnims[nodeCount - 1],
                              transform: [{ scale: nodeAnims[nodeCount - 1] }],
                            },
                          ]}
                        >
                          <View style={[styles.node, styles.nodeGoal]}>
                            <Trophy size={20} color="#FFFFFF" />
                          </View>
                          <Text variant="labelSmall" style={[styles.nodeLabel, styles.nodeLabelGoal]}>
                            Day {milestone}
                          </Text>
                        </Animated.View>
                      );
                    })()}
                  </View>
                )}
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
    headerLabel: { color: '#E0E7FF' },
    headerSub: { color: '#C7D2FE', marginTop: 8, textAlign: 'center' },
    statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    statCard: { flex: 1, backgroundColor: colors.surface },
    statContent: { alignItems: 'center', gap: 2, paddingVertical: 12, paddingHorizontal: 4 },
    statNum: { color: colors.text, fontWeight: '700' },
    statLabel: { color: colors.muted, textAlign: 'center' },
    sectionTitle: { color: colors.text, fontWeight: '600', marginTop: 20, marginBottom: 8 },
    mapCard: { backgroundColor: colors.surface },
    nodeWrap: { position: 'absolute', alignItems: 'center' },
    node: {
      width: NODE_R * 2,
      height: NODE_R * 2,
      borderRadius: NODE_R,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nodeMet: { backgroundColor: colors.amber },
    nodeMissed: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 2,
      borderColor: colors.border,
    },
    nodeToday: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    nodeGoal: { backgroundColor: colors.violet },
    nodeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    nodeCount: { color: colors.primary, fontWeight: '700' },
    todayRing: {
      position: 'absolute',
      top: 0,
      width: NODE_R * 2,
      height: NODE_R * 2,
      borderRadius: NODE_R,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    nodeLabel: { color: colors.muted, marginTop: 4 },
    nodeLabelToday: { color: colors.primary, fontWeight: '700' },
    nodeLabelGoal: { color: colors.violet, fontWeight: '700' },
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
