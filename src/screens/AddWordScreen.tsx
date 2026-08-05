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
import { FieldSource, lookupWord } from '../api/dictionary';
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

type FormKey = keyof typeof EMPTY;

/**
 * Provenance badge shown on auto-filled inputs. "Suggested" is deliberately
 * distinct — those values are derived locally by heuristic, so they're the ones
 * most worth a human read before saving.
 */
const SOURCE_LABEL: Record<FieldSource, string> = {
  dictionary: 'Dictionary',
  wiktionary: 'Wiktionary',
  datamuse: 'Datamuse',
  generated: 'Suggested',
};

/** Small pastel chip pinned to a field's outline showing where its value came from. */
function FieldBadge({
  source,
  colors,
  styles,
}: {
  source?: FieldSource;
  colors: AppColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  if (!source) return null;
  const tint =
    source === 'generated'
      ? colors.coral
      : source === 'wiktionary'
        ? colors.sage
        : source === 'datamuse'
          ? colors.amber
          : colors.violet;
  return (
    <View
      pointerEvents="none"
      style={[styles.badge, { backgroundColor: colors.background, borderColor: `${tint}66` }]}
    >
      <Sparkles size={9} color={tint} />
      <Text variant="labelSmall" style={[styles.badgeText, { color: tint }]}>
        {SOURCE_LABEL[source]}
      </Text>
    </View>
  );
}

export default function AddWordScreen() {
  const { colors } = useAppTheme();
  const [form, setForm] = useState(EMPTY);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState('');

  // Which fields the last auto-fill populated, and from where.
  const [filled, setFilled] = useState<Partial<Record<FormKey, FieldSource>>>({});

  // Editing a field makes it the user's own — drop its badge.
  const set = (key: FormKey) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFilled((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

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
        origin: result.wordOrigin || f.origin,
        layman: result.laymanExplanation || f.layman,
        partOfSpeech: result.partOfSpeech || f.partOfSpeech,
        wordForms: result.wordForms || f.wordForms,
      }));

      // Badge only the fields this lookup actually supplied.
      const s = result.sources;
      const badges: Partial<Record<FormKey, FieldSource>> = {};
      const mark = (key: FormKey, src?: FieldSource, value?: string) => {
        if (src && value) badges[key] = src;
      };
      mark('pronunciation', s.pronunciation, result.pronunciation);
      mark('meaning', s.meaning, result.meaning);
      mark('example', s.example, result.example);
      mark('origin', s.wordOrigin, result.wordOrigin);
      mark('layman', s.laymanExplanation, result.laymanExplanation);
      mark('partOfSpeech', s.partOfSpeech, result.partOfSpeech);
      mark('wordForms', s.wordForms, result.wordForms);
      mark('syn1', s.synonyms, result.synonyms[0]);
      mark('syn2', s.synonyms, result.synonyms[1]);
      mark('ant1', s.antonyms, result.antonyms[0]);
      mark('ant2', s.antonyms, result.antonyms[1]);
      setFilled(badges);

      const missing = (['syn2', 'ant2', 'origin'] as FormKey[]).filter((k) => !badges[k]);
      setSnack(
        missing.length
          ? `Filled ${Object.keys(badges).length} fields — a few need your touch.`
          : `Filled ${Object.keys(badges).length} fields — review and edit freely.`
      );
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
      setFilled({});
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
              {loading ? 'Filling…' : 'Auto-fill'}
            </Button>
          </View>

          <View style={styles.fieldWrap}>
            <TextInput
              mode="outlined"
              label="Pronunciation"
              value={form.pronunciation}
              onChangeText={set('pronunciation')}
              right={
                <TextInput.Icon
                  icon={() => <Volume2 size={22} color={colors.primary} />}
                  onPress={playPronunciation}
                  forceTextInputFocus={false}
                  accessibilityLabel="Play pronunciation"
                />
              }
            />
            <FieldBadge source={filled.pronunciation} colors={colors} styles={styles} />
          </View>

          <View style={styles.fieldWrap}>
            <TextInput
              mode="outlined"
              label="Grammatical form"
              placeholder="e.g. adjective, noun"
              value={form.partOfSpeech}
              onChangeText={set('partOfSpeech')}
            />
            <FieldBadge source={filled.partOfSpeech} colors={colors} styles={styles} />
          </View>

          <View style={styles.fieldWrap}>
            <TextInput
              mode="outlined"
              label="Other word forms"
              placeholder="e.g. adverb: meticulously"
              value={form.wordForms}
              onChangeText={set('wordForms')}
              multiline
            />
            <FieldBadge source={filled.wordForms} colors={colors} styles={styles} />
          </View>

          <View style={styles.fieldWrap}>
            <TextInput
              mode="outlined"
              label="Meaning"
              value={form.meaning}
              onChangeText={set('meaning')}
              multiline
            />
            <FieldBadge source={filled.meaning} colors={colors} styles={styles} />
          </View>

          <View style={styles.pairRow}>
            <View style={styles.flex}>
              <TextInput
                mode="outlined"
                label="Synonym 1"
                value={form.syn1}
                onChangeText={set('syn1')}
              />
              <FieldBadge source={filled.syn1} colors={colors} styles={styles} />
            </View>
            <View style={styles.flex}>
              <TextInput
                mode="outlined"
                label="Synonym 2"
                value={form.syn2}
                onChangeText={set('syn2')}
              />
              <FieldBadge source={filled.syn2} colors={colors} styles={styles} />
            </View>
          </View>
          <View style={styles.pairRow}>
            <View style={styles.flex}>
              <TextInput
                mode="outlined"
                label="Antonym 1"
                value={form.ant1}
                onChangeText={set('ant1')}
              />
              <FieldBadge source={filled.ant1} colors={colors} styles={styles} />
            </View>
            <View style={styles.flex}>
              <TextInput
                mode="outlined"
                label="Antonym 2"
                value={form.ant2}
                onChangeText={set('ant2')}
              />
              <FieldBadge source={filled.ant2} colors={colors} styles={styles} />
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <TextInput
              mode="outlined"
              label="Usage in a sentence"
              value={form.example}
              onChangeText={set('example')}
              multiline
            />
            <FieldBadge source={filled.example} colors={colors} styles={styles} />
          </View>

          <View style={styles.fieldWrap}>
            <TextInput
              mode="outlined"
              label="Origin of the word (optional)"
              value={form.origin}
              onChangeText={set('origin')}
              multiline
            />
            <FieldBadge source={filled.origin} colors={colors} styles={styles} />
          </View>

          <View style={styles.fieldWrap}>
            <TextInput
              mode="outlined"
              label="Layman's terms explanation (optional)"
              value={form.layman}
              onChangeText={set('layman')}
              multiline
            />
            <FieldBadge source={filled.layman} colors={colors} styles={styles} />
          </View>

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
  fieldWrap: { marginTop: 12 },
  pairRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  // Sits on the input's outline, like Paper's own floating label.
  badge: {
    position: 'absolute',
    top: -7,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.2 },
  diffLabel: { color: colors.muted, marginTop: 16, marginBottom: 8 },
  saveBtn: { marginTop: 20, borderRadius: 12 },
  saveBtnContent: { paddingVertical: 6 },
});
