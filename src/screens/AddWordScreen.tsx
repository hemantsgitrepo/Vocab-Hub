import React, { useMemo, useState } from 'react';
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
import { Sparkles, Volume2 } from 'lucide-react-native';
import { lookupWord } from '../api/dictionary';
import { speakOnce } from '../lib/tts';
import { capitalizeFirst } from '../lib/text';
import { createWord, wordExists } from '../db/words';
import { DifficultyLevel } from '../db/models/Word';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';

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
  origin: '',
  partOfSpeech: '',
  wordForms: '',
};

export default function AddWordScreen() {
  const { colors } = useAppTheme();
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
        word: capitalizeFirst(f.word),
        pronunciation: result.pronunciation || f.pronunciation,
        audioUrl: result.audioUrl || f.audioUrl,
        meaning: capitalizeFirst(result.meaning || f.meaning),
        example: capitalizeFirst(result.example || f.example),
        syn1: capitalizeFirst(result.synonyms[0] ?? f.syn1),
        syn2: capitalizeFirst(result.synonyms[1] ?? f.syn2),
        ant1: capitalizeFirst(result.antonyms[0] ?? f.ant1),
        ant2: capitalizeFirst(result.antonyms[1] ?? f.ant2),
        partOfSpeech: result.partOfSpeech || f.partOfSpeech,
        wordForms: result.wordForms || f.wordForms,
      }));
      setSnack('Filled from dictionary — review and edit freely.');
    } catch {
      setSnack('Could not reach the dictionary. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const playPronunciation = () => {
    if (!form.word.trim()) {
      setSnack('Type a word first to hear it.');
      return;
    }
    speakOnce(form.word);
  };

  const save = async () => {
    if (!form.word.trim() || !form.meaning.trim()) {
      setSnack('Word and meaning are required.');
      return;
    }
    setSaving(true);
    try {
      if (await wordExists(form.word)) {
        setSnack(`"${capitalizeFirst(form.word)}" is already in your list.`);
        return;
      }
      await createWord({
        word: form.word,
        pronunciation: form.pronunciation,
        audioUrl: form.audioUrl,
        meaning: form.meaning,
        synonyms: [form.syn1, form.syn2],
        antonyms: [form.ant1, form.ant2],
        exampleSentence: form.example,
        laymanExplanation: form.layman || undefined,
        wordOrigin: form.origin || undefined,
        partOfSpeech: form.partOfSpeech,
        wordForms: form.wordForms,
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

  const styles = useMemo(() => makeStyles(colors), [colors]);

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
            right={
              <TextInput.Icon
                icon={() => <Volume2 size={22} color={colors.primary} />}
                onPress={playPronunciation}
                forceTextInputFocus={false}
                accessibilityLabel="Play pronunciation"
              />
            }
          />
          <TextInput
            mode="outlined"
            label="Grammatical form"
            placeholder="e.g. adjective, noun"
            value={form.partOfSpeech}
            onChangeText={set('partOfSpeech')}
            style={styles.field}
          />
          <TextInput
            mode="outlined"
            label="Other word forms"
            placeholder="e.g. adverb: meticulously"
            value={form.wordForms}
            onChangeText={set('wordForms')}
            multiline
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
            label="Origin of the word (optional)"
            value={form.origin}
            onChangeText={set('origin')}
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

const makeStyles = (colors: AppColors) => StyleSheet.create({
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
