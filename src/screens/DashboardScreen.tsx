import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Chip, ProgressBar, Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BookOpen, Flame, Trophy } from 'lucide-react-native';
import { useAllWords, useDailyGoal } from '../hooks';
import { colors, difficultyColor } from '../theme';
import { computeStreak, countToday } from '../lib/streak';

export default function DashboardScreen() {
  const words = useAllWords();
  const [goal] = useDailyGoal();

  const dates = words.map((w) => w.createdAt);
  const today = countToday(dates);
  const streak = computeStreak(dates, goal);
  const mastered = words.filter((w) => w.practiceStatus === 'mastered').length;
  const progress = goal > 0 ? Math.min(today / goal, 1) : 0;
  const recent = words.slice(0, 5);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          AptitudeWords
        </Text>

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
            <View style={styles.streakBadge}>
              <Flame size={28} color={colors.amber} fill={colors.amber} />
              <Text variant="titleLarge" style={styles.streakNum}>
                {streak}
              </Text>
              <Text variant="labelSmall" style={styles.streakLabel}>
                day streak
              </Text>
            </View>
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
                    {!!w.pronunciation && (
                      <Text variant="bodySmall" style={styles.pron}>
                        {w.pronunciation}
                      </Text>
                    )}
                  </View>
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
                </View>
                <Text variant="bodyMedium" numberOfLines={2} style={styles.meaning}>
                  {w.meaning}
                </Text>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  title: { color: colors.text, fontWeight: '700', marginBottom: 12 },
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
  streakNum: { color: '#FFFFFF', fontWeight: '700' },
  streakLabel: { color: '#E0E7FF' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statCard: { flex: 1, backgroundColor: colors.surface },
  statContent: { alignItems: 'center', gap: 2 },
  statNum: { color: colors.text, fontWeight: '700' },
  statLabel: { color: colors.muted },
  sectionTitle: { color: colors.text, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  emptyCard: { backgroundColor: colors.surface },
  emptyText: { color: colors.muted, lineHeight: 20 },
  wordCard: { backgroundColor: colors.surface, marginBottom: 10 },
  wordRow: { flexDirection: 'row', alignItems: 'center' },
  wordLeft: { flex: 1 },
  wordText: { color: colors.text, fontWeight: '700' },
  pron: { color: colors.muted },
  chip: { height: 28 },
  chipText: { fontSize: 12, lineHeight: 14, color: colors.text },
  meaning: { color: colors.muted, marginTop: 6 },
});
