import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Chip, ProgressBar, Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BookOpen, Sparkles, Trash, Trophy } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAllWords, useDailyGoal, useStreakManager } from '../hooks';
import EmptyState from '../ui/EmptyState';
import { AppColors, difficultyColor } from '../theme';
import { useAppTheme } from '../ThemeContext';
import StreakCard from '../ui/StreakCard';
import StreakMilestoneModal from '../ui/StreakMilestoneModal';
import { useUnlockCelebration } from '../ui/UnlockProvider';
import StreakRepairModal from '../ui/StreakRepairModal';
import { deleteWord } from '../db/words';
import StreakJourneyModal from './StreakJourneyModal';
import GameArcade from './games/GameArcade';
import { useAppDialogs } from '../ui/AppDialogs';

export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const dialogs = useAppDialogs();
  const words = useAllWords();
  const [goal] = useDailyGoal();
  const [journeyOpen, setJourneyOpen] = useState(false);

  const streakMgr = useStreakManager();
  const { view: streakView } = streakMgr;
  // A bulk import can unlock a game and cross a streak milestone at once. Let
  // the game celebration land first rather than stacking two fanfares.
  const { celebration: gameCelebration } = useUnlockCelebration();
  // Local so a dismissed challenge doesn't immediately reopen this session.
  const [repairDismissed, setRepairDismissed] = useState(false);

  // Sourced from the streak engine so the 2am grace period applies here too —
  // at 01:00 the card and "today's progress" must agree on which day it is.
  const today = streakView.todayCount;
  const streak = streakView.streak;
  const mastered = words.filter((w) => w.practiceStatus === 'mastered').length;
  const progress = goal > 0 ? Math.min(today / goal, 1) : 0;
  const recent = words.slice(0, 5);

  const confirmDelete = async (word: typeof words[0]) => {
    const ok = await dialogs.confirm({
      title: 'Delete this word?',
      message: `"${word.word}" cannot be recovered once deleted.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!ok) return;
    deleteWord(word)
      .then(() => dialogs.toast(`"${word.word}" deleted.`, { kind: 'info' }))
      .catch(() => dialogs.toast("Couldn't delete that word.", { kind: 'error' }));
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
          </View>
        </LinearGradient>

        {/* Summary only — the calendar and mechanics live one tap away in the
            journey modal, keeping the home screen scannable. */}
        <StreakCard view={streakView} onPress={() => setJourneyOpen(true)} />

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

        <GameArcade />

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Recently added
        </Text>
        {recent.length === 0 ? (
          <EmptyState
            Icon={Sparkles}
            title="Your collection starts here"
            message="Type a word and the dictionary fills in the pronunciation, meaning, synonyms, antonyms, example sentence and origin for you."
            actionLabel="Add your first word"
            onAction={() => navigation.navigate('Add')}
            footnote={`${goal} words a day keeps your streak alive`}
          />
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
        view={streakView}
        counts={streakMgr.counts}
        protectedDays={streakMgr.state.protectedDays}
        firstActiveDay={streakMgr.firstActiveDay}
        totalWords={words.length}
        goal={goal}
      />

      <StreakMilestoneModal
        milestone={gameCelebration ? null : streakMgr.milestone}
        freezes={streakView.freezes}
        onClose={() => {
          if (streakMgr.milestone !== null) streakMgr.celebrateMilestone(streakMgr.milestone);
        }}
      />

      <StreakRepairModal
        repair={repairDismissed ? null : streakView.repair}
        todayCount={streakView.todayCount}
        onAccept={() => {
          // Keep the challenge running — just get out of the way so they can add words.
          setRepairDismissed(true);
          navigation.navigate('Add');
        }}
        onDecline={() => {
          setRepairDismissed(true);
          streakMgr.declineRepair();
        }}
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
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statCard: { flex: 1, backgroundColor: colors.surface },
  statContent: { alignItems: 'center', gap: 2 },
  statNum: { color: colors.text, fontWeight: '700' },
  statLabel: { color: colors.muted },
  sectionTitle: { color: colors.text, fontWeight: '600', marginTop: 24, marginBottom: 8 },
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
