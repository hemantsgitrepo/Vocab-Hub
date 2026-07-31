import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Chip, ProgressBar, Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BookOpen, Flame, Trash, Trophy } from 'lucide-react-native';
import { useAllWords, useDailyGoal } from '../hooks';
import { AppColors, difficultyColor } from '../theme';
import { useAppTheme } from '../ThemeContext';
import { bestStreak, computeStreak, countMetDays, countToday, dayHistory } from '../lib/streak';
import { deleteWord } from '../db/words';
import StreakJourneyModal from './StreakJourneyModal';

const JOURNEY_DAYS = 14;

export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const words = useAllWords();
  const [goal] = useDailyGoal();
  const [journeyOpen, setJourneyOpen] = useState(false);

  const dates = words.map((w) => w.createdAt);
  const today = countToday(dates);
  const streak = computeStreak(dates, goal);
  const mastered = words.filter((w) => w.practiceStatus === 'mastered').length;
  const progress = goal > 0 ? Math.min(today / goal, 1) : 0;
  const recent = words.slice(0, 5);

  const confirmDelete = (word: typeof words[0]) => {
    Alert.alert(
      'Delete this word?',
      `"${word.word}" cannot be recovered once deleted.`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Delete',
          onPress: () => deleteWord(word).catch(() => {}),
          style: 'destructive',
        },
      ]
    );
  };

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/logo-mark.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text variant="headlineMedium" style={styles.title}>
            Vocab Hub
          </Text>
        </View>

        <LinearGradient
          colors={[colors.primary, colors.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroRow}>
            <View style={styles.heroLeft}>
              <Text variant="titleMedium" style={styles.heroLabel}>
                Today's progress
              </Text>
              <Text variant="displaySmall" style={styles.heroCount}>
                {today}
                <Text variant="titleLarge" style={styles.heroGoal}>
                  {' '}
                  / {goal} words
                </Text>
              </Text>
              <ProgressBar
                progress={progress}
                color={colors.amber}
                style={styles.progress}
              />
            </View>
            <Pressable
              onPress={() => setJourneyOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="View your streak journey"
              style={({ pressed }) => [styles.streakBadge, pressed && styles.streakBadgePressed]}
            >
              <Flame size={28} color={colors.amber} fill={colors.amber} />
              <Text variant="titleLarge" style={styles.streakNum}>
                {streak}
              </Text>
              <Text variant="labelSmall" style={styles.streakLabel}>
                day streak
              </Text>
              <Text variant="labelSmall" style={styles.streakHint}>
                tap for journey
              </Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <BookOpen size={22} color={colors.primary} />
              <Text variant="headlineSmall" style={styles.statNum}>
                {words.length}
              </Text>
              <Text variant="labelMedium" style={styles.statLabel}>
                words learned
              </Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Trophy size={22} color={colors.amber} />
              <Text variant="headlineSmall" style={styles.statNum}>
                {mastered}
              </Text>
              <Text variant="labelMedium" style={styles.statLabel}>
                mastered
              </Text>
            </Card.Content>
          </Card>
        </View>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Recently added
        </Text>
        {recent.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.emptyText}>
                No words yet. Head to the Add tab to capture your first word —
                the dictionary will fill in the details for you.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          recent.map((w) => (
            <Card key={w.id} style={styles.wordCard}>
              <Card.Content>
                <View style={styles.wordRow}>
                  <View style={styles.wordLeft}>
                    <Text variant="titleMedium" style={styles.wordText}>
                      {w.word}
                    </Text>
                    <Text variant="bodySmall" style={styles.pron}>
                      {[w.pronunciation, w.partOfSpeech].filter(Boolean).join('  ·  ')}
                    </Text>
                  </View>
                  <View style={styles.wordRight}>
                    <Chip
                      compact
                      textStyle={styles.chipText}
                      style={[
                        styles.chip,
                        { backgroundColor: difficultyColor[w.difficultyLevel] + '22' },
                      ]}
                    >
                      {w.difficultyLevel}
                    </Chip>
                    <Pressable
                      onPress={() => confirmDelete(w)}
                      style={styles.deleteBtn}
                      hitSlop={8}
                    >
                      <Trash size={18} color={colors.red} />
                    </Pressable>
                  </View>
                </View>
                <Text variant="bodyMedium" numberOfLines={2} style={styles.meaning}>
                  {w.meaning}
                </Text>
                {!!w.wordForms && (
                  <Text variant="bodySmall" style={styles.forms}>
                    {w.wordForms}
                  </Text>
                )}
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <StreakJourneyModal
        visible={journeyOpen}
        onClose={() => setJourneyOpen(false)}
        history={dayHistory(dates, goal, JOURNEY_DAYS)}
        streak={streak}
        best={bestStreak(dates, goal)}
        metDays={countMetDays(dates, goal)}
        totalWords={words.length}
        goal={goal}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  logo: { width: 32, height: 32 },
  title: { color: colors.text, fontWeight: '700' },
  hero: { borderRadius: 20, padding: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroLeft: { flex: 1 },
  heroLabel: { color: '#E0E7FF' },
  heroCount: { color: '#FFFFFF', fontWeight: '700', marginVertical: 4 },
  heroGoal: { color: '#C7D2FE' },
  progress: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF33', marginTop: 8 },
  streakBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF1F',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginLeft: 16,
  },
  streakBadgePressed: { backgroundColor: '#FFFFFF33', transform: [{ scale: 0.96 }] },
  streakNum: { color: '#FFFFFF', fontWeight: '700' },
  streakLabel: { color: '#E0E7FF' },
  streakHint: { color: '#FFFFFF99', marginTop: 2, fontSize: 9 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statCard: { flex: 1, backgroundColor: colors.surface },
  statContent: { alignItems: 'center', gap: 2 },
  statNum: { color: colors.text, fontWeight: '700' },
  statLabel: { color: colors.muted },
  sectionTitle: { color: colors.text, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  emptyCard: { backgroundColor: colors.surface },
  emptyText: { color: colors.muted, lineHeight: 20 },
  wordCard: { backgroundColor: colors.surface, marginBottom: 10 },
  wordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordLeft: { flex: 1 },
  wordText: { color: colors.text, fontWeight: '700' },
  pron: { color: colors.muted },
  wordRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { height: 28 },
  chipText: { fontSize: 12, lineHeight: 14, color: colors.text },
  deleteBtn: { padding: 4 },
  meaning: { color: colors.muted, marginTop: 6 },
  forms: { color: colors.violet, marginTop: 6 },
});
