import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text } from 'react-native-paper';
import { Minus, Plus, Target } from 'lucide-react-native';
import { useDailyGoal } from '../hooks';
import { colors } from '../theme';

const MIN_GOAL = 1;
const MAX_GOAL = 50;

export default function SettingsScreen() {
  const [goal, setGoal] = useDailyGoal();

  const bump = (delta: number) => {
    const next = Math.min(MAX_GOAL, Math.max(MIN_GOAL, goal + delta));
    if (next !== goal) setGoal(next);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Settings
        </Text>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.goalHeader}>
              <Target size={22} color={colors.primary} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Daily practice goal
              </Text>
            </View>
            <Text variant="bodyMedium" style={styles.hint}>
              How many new words you aim to add each day. Your streak counts days
              where you hit this number.
            </Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => bump(-1)}
                style={[styles.stepBtn, goal <= MIN_GOAL && styles.stepBtnDisabled]}
              >
                <Minus size={22} color={goal <= MIN_GOAL ? colors.muted : colors.primary} />
              </Pressable>
              <Text variant="displaySmall" style={styles.goalNum}>
                {goal}
              </Text>
              <Pressable
                onPress={() => bump(1)}
                style={[styles.stepBtn, goal >= MAX_GOAL && styles.stepBtnDisabled]}
              >
                <Plus size={22} color={goal >= MAX_GOAL ? colors.muted : colors.primary} />
              </Pressable>
            </View>
            <Text variant="labelMedium" style={styles.goalUnit}>
              words per day
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              About
            </Text>
            <Text variant="bodyMedium" style={styles.hint}>
              AptitudeWords stores everything on your device — no account, no
              cloud. Word definitions come from the Free Dictionary API, and audio
              playback uses your phone's built-in text-to-speech.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  title: { color: colors.text, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: colors.surface, marginBottom: 16 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { color: colors.text, fontWeight: '600' },
  hint: { color: colors.muted, lineHeight: 20 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    marginTop: 20,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { borderColor: colors.border },
  goalNum: { color: colors.text, fontWeight: '700', minWidth: 64, textAlign: 'center' },
  goalUnit: { color: colors.muted, textAlign: 'center', marginTop: 4 },
});
