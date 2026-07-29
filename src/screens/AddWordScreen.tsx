import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Button,
  SegmentedButtons,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { Sparkles } from 'lucide-react-native';
import { lookupWord } from '../api/dictionary';
import { createWord } from '../db/words';
import { DifficultyLevel } from '../db/models/Word';
import { colors } from '../theme';

const EMPTY = {
  word: '',
  pronunciation: '',
  audioUrl: '',
  meaning: '',
  syn1: '',
  syn2: '',
  ant1: '',
  ant2: '',
  example: '',
  layman: '',
};

export default function AddWordScreen() {
  const [form, setForm] = useState(EMPTY);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState('');

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const autofill = async () => {
    if (!form.word.trim()) {
      setSnack('Type a word first, then tap Auto-fill.');
      return;
    }
    setLoading(true);
    try {
      const result = await lookupWord(form.word);
      if (!result) {
        setSnack(`No dictionary entry found for “${form.word.trim()}”.`);
        return;
      }
      setForm((f) => ({
        ...f,
        pronunciation: result.pronunciation || f.pronunciation,
        audioUrl: result.audioUrl || f.audioUrl,
        meaning: result.meaning || f.meaning,
        example: result.example || f.example,
        syn1: result.synonyms[0] ?? f.syn1,
        syn2: result.synonyms[1] ?? f.syn2,
        ant1: result.antonyms[0] ?? f.ant1,
        ant2: result.antonyms[1] ?? f.ant2,
      }));
      setSnack('Filled from dictionary — review and edit freely.');
    } catch {
      setSnack('Could not reach the dictionary. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!form.word.trim() || !form.meaning.trim() || !form.example.trim()) {
      setSnack('Word, meaning and example sentence are required.');
      return;
    }
    setSaving(true);
    try {
      await createWord({
        word: form.word,
        pronunciation: form.pronunciation,
        audioUrl: form.audioUrl,
        meaning: form.meaning,
        synonyms: [form.syn1, form.syn2],
        antonyms: [form.ant1, form.ant2],
        exampleSentence: form.example,
        laymanExplanation: form.layman || undefined,
        difficultyLevel: difficulty,
      });
      setForm(EMPTY);
      setDifficulty('medium');
      setSnack('Word saved. Keep the streak going! 🔥');
    } catch (e) {
      console.error('SAVE_ERROR', e);
      setSnack('Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="headlineMedium" style={styles.title}>
            Add a word
          </Text>

          <View style={styles.autofillRow}>
            <TextInput
              mode="outlined"
              label="Word"
              value={form.word}
              onChangeText={set('word')}
              autoCapitalize="none"
              style={styles.flex}
            />
            <Button
              mode="contained-tonal"
              onPress={autofill}
              disabled={loading}
              style={styles.autofillBtn}
              icon={({ size, color }) =>
                loading ? (
                  <ActivityIndicator size={size} color={color} />
                ) : (
                  <Sparkles size={size} color={color} />
                )
              }
            >
              Auto-fill
            </Button>
          </View>

          <TextInput
            mode="outlined"
            label="Pronunciation"
            value={form.pronunciation}
            onChangeText={set('pronunciation')}
            style={styles.field}
          />
          <TextInput
            mode="outlined"
            label="Meaning"
            value={form.meaning}
            onChangeText={set('meaning')}
            multiline
            style={styles.field}
          />

          <View style={styles.pairRow}>
            <TextInput
              mode="outlined"
              label="Synonym 1"
              value={form.syn1}
              onChangeText={set('syn1')}
              style={styles.flex}
            />
            <TextInput
              mode="outlined"
              label="Synonym 2"
              value={form.syn2}
              onChangeText={set('syn2')}
              style={styles.flex}
            />
          </View>
          <View style={styles.pairRow}>
            <TextInput
              mode="outlined"
              label="Antonym 1"
              value={form.ant1}
              onChangeText={set('ant1')}
              style={styles.flex}
            />
            <TextInput
              mode="outlined"
              label="Antonym 2"
              value={form.ant2}
              onChangeText={set('ant2')}
              style={styles.flex}
            />
          </View>

          <TextInput
            mode="outlined"
            label="Usage in a sentence"
            value={form.example}
            onChangeText={set('example')}
            multiline
            style={styles.field}
          />
          <TextInput
            mode="outlined"
            label="Layman's terms explanation (optional)"
            value={form.layman}
            onChangeText={set('layman')}
            multiline
            style={styles.field}
          />

          <Text variant="labelLarge" style={styles.diffLabel}>
            Difficulty
          </Text>
          <SegmentedButtons
            value={difficulty}
            onValueChange={(v) => setDifficulty(v as DifficultyLevel)}
            buttons={[
              { value: 'easy', label: 'Easy', showSelectedCheck: false },
              { value: 'medium', label: 'Medium', showSelectedCheck: false },
              { value: 'hard', label: 'Hard', showSelectedCheck: false },
            ]}
          />

          <Button
            mode="contained"
            onPress={save}
            loading={saving}
            disabled={saving}
            style={styles.saveBtn}
            contentStyle={styles.saveBtnContent}
          >
            Save word
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={2500}>
        {snack}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title: { color: colors.text, fontWeight: '700', marginBottom: 12 },
  autofillRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  autofillBtn: { marginTop: 6 },
  field: { marginTop: 12 },
  pairRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  diffLabel: { color: colors.muted, marginTop: 16, marginBottom: 8 },
  saveBtn: { marginTop: 20, borderRadius: 12 },
  saveBtnContent: { paddingVertical: 6 },
});
