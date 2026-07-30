import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, SegmentedButtons, Text } from 'react-native-paper';
import Word, { PracticeStatus } from '../db/models/Word';
import { fetchAllWords, setPracticeStatus, wordsFromPastDays } from '../db/words';
import { useQuizSynonyms } from '../hooks';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';

type QuizType = 'flashcards' | 'mcq' | 'fill';
type Phase = 'setup' | 'active' | 'done';

interface Question {
  word: Word;
  prompt: string;
  /** True when the prompt shows a synonym rather than the word itself. */
  promptIsSynonym: boolean;
  options: string[]; // empty for flashcards
  correctIndex: number;
}

const MAX_QUESTIONS = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildQuestions(words: Word[], type: QuizType, useSynonyms: boolean): Question[] {
  const pool = shuffle(words).slice(0, MAX_QUESTIONS);
  return pool.map((word) => {
    // Only swap in a synonym where one exists; otherwise fall back to the word.
    const synonym = useSynonyms ? shuffle(word.synonyms)[0] : undefined;
    const promptIsSynonym = Boolean(synonym);
    const headword = synonym ?? word.word;

    if (type === 'flashcards') {
      return { word, prompt: headword, promptIsSynonym, options: [], correctIndex: 0 };
    }
    const distractors = shuffle(words.filter((w) => w.id !== word.id)).slice(0, 3);
    if (type === 'mcq') {
      const options = shuffle([word.meaning, ...distractors.map((d) => d.meaning)]);
      return {
        word,
        prompt: headword,
        promptIsSynonym,
        options,
        correctIndex: options.indexOf(word.meaning),
      };
    }
    // fill-in-the-blank: blank the word out of its own example sentence.
    // The prompt is the sentence, so there's no headword to swap — a synonym
    // is offered as a hint instead.
    const blanked = word.exampleSentence.replace(
      new RegExp(`\\b${escapeRegExp(word.word)}\\b`, 'gi'),
      '_____'
    );
    const sentence = blanked.includes('_____')
      ? blanked
      : `${word.exampleSentence}\n\nWhich word fits this sentence?`;
    const prompt = synonym ? `${sentence}\n\nHint — similar to: ${synonym}` : sentence;
    const options = shuffle([word.word, ...distractors.map((d) => d.word)]);
    return {
      word,
      prompt,
      promptIsSynonym: false,
      options,
      correctIndex: options.indexOf(word.word),
    };
  });
}

function bumpStatus(word: Word, correct: boolean) {
  const next: PracticeStatus = correct
    ? word.practiceStatus === 'new'
      ? 'learning'
      : 'mastered'
    : 'learning';
  if (next !== word.practiceStatus) setPracticeStatus(word, next).catch(() => {});
}

export default function QuizScreen() {
  const { colors } = useAppTheme();
  const [phase, setPhase] = useState<Phase>('setup');
  const [type, setType] = useState<QuizType>('flashcards');
  const [source, setSource] = useState('all');
  // Read-only here — the toggle itself lives in Settings.
  const [useSynonyms] = useQuizSynonyms();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [notice, setNotice] = useState('');

  const start = async () => {
    setNotice('');
    const words =
      source === 'all' ? await fetchAllWords() : await wordsFromPastDays(Number(source));
    const needed = type === 'flashcards' ? 1 : 4;
    if (words.length < needed) {
      setNotice(
        type === 'flashcards'
          ? 'Add at least one word to start a quiz.'
          : `This quiz type needs at least 4 words in the selected range — you have ${words.length}.`
      );
      return;
    }
    setQuestions(buildQuestions(words, type, useSynonyms));
    setQIndex(0);
    setScore(0);
    setAnswered(null);
    setRevealed(false);
    setPhase('active');
  };

  const answer = (idx: number) => {
    if (answered !== null) return;
    setAnswered(idx);
    const q = questions[qIndex];
    const correct = idx === q.correctIndex;
    if (correct) setScore((s) => s + 1);
    bumpStatus(q.word, correct);
  };

  const flashcardResult = (knewIt: boolean) => {
    const q = questions[qIndex];
    if (knewIt) setScore((s) => s + 1);
    bumpStatus(q.word, knewIt);
    next();
  };

  const next = () => {
    if (qIndex + 1 >= questions.length) {
      setPhase('done');
      return;
    }
    setQIndex((i) => i + 1);
    setAnswered(null);
    setRevealed(false);
  };

  const q = questions[qIndex];

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Quiz
        </Text>

        {phase === 'setup' && (
          <>
            <Text variant="labelLarge" style={styles.label}>
              Quiz type
            </Text>
            <SegmentedButtons
              value={type}
              onValueChange={(v) => setType(v as QuizType)}
              buttons={[
                { value: 'flashcards', label: 'Cards', showSelectedCheck: false },
                { value: 'mcq', label: 'Meanings', showSelectedCheck: false },
                { value: 'fill', label: 'Fill blank', showSelectedCheck: false },
              ]}
            />
            <Text variant="labelLarge" style={styles.label}>
              Words from
            </Text>
            <SegmentedButtons
              value={source}
              onValueChange={setSource}
              buttons={[
                { value: 'all', label: 'All time', showSelectedCheck: false },
                { value: '7', label: 'Past 7 days', showSelectedCheck: false },
                { value: '30', label: 'Past 30 days', showSelectedCheck: false },
              ]}
            />
            {!!notice && (
              <Text variant="bodyMedium" style={styles.notice}>
                {notice}
              </Text>
            )}
            <Button mode="contained" onPress={start} style={styles.startBtn} contentStyle={styles.btnContent}>
              Start quiz
            </Button>
          </>
        )}

        {phase === 'active' && q && (
          <>
            <Text variant="labelLarge" style={styles.progress}>
              Question {qIndex + 1} of {questions.length} · Score {score}
            </Text>

            {type === 'flashcards' ? (
              <>
                <Pressable onPress={() => setRevealed((r) => !r)}>
                  <Card style={styles.flashcard}>
                    <Card.Content style={styles.flashcardContent}>
                      {revealed ? (
                        <>
                          {q.promptIsSynonym && (
                            <Text variant="headlineSmall" style={styles.revealWord}>
                              {q.word.word}
                            </Text>
                          )}
                          <Text variant="titleLarge" style={styles.flashBack}>
                            {q.word.meaning}
                          </Text>
                          {q.word.synonyms.length > 0 && (
                            <Text variant="bodyMedium" style={styles.flashHint}>
                              Similar: {q.word.synonyms.join(', ')}
                            </Text>
                          )}
                          {!!q.word.laymanExplanation && (
                            <Text variant="bodyMedium" style={styles.flashHint}>
                              In plain terms: {q.word.laymanExplanation}
                            </Text>
                          )}
                        </>
                      ) : (
                        <>
                          {q.promptIsSynonym && (
                            <Text variant="labelMedium" style={styles.synonymBadge}>
                              SYNONYM OF
                            </Text>
                          )}
                          <Text variant="displaySmall" style={styles.flashWord}>
                            {q.prompt}
                          </Text>
                          {!q.promptIsSynonym && !!q.word.pronunciation && (
                            <Text variant="bodyLarge" style={styles.flashHint}>
                              {q.word.pronunciation}
                            </Text>
                          )}
                          <Text variant="labelMedium" style={styles.tapHint}>
                            {q.promptIsSynonym
                              ? 'Tap to reveal the word'
                              : 'Tap to reveal meaning'}
                          </Text>
                        </>
                      )}
                    </Card.Content>
                  </Card>
                </Pressable>
                {revealed && (
                  <View style={styles.flashButtons}>
                    <Button
                      mode="outlined"
                      onPress={() => flashcardResult(false)}
                      style={styles.flex}
                      textColor={colors.red}
                    >
                      Review again
                    </Button>
                    <Button
                      mode="contained"
                      onPress={() => flashcardResult(true)}
                      style={styles.flex}
                      buttonColor={colors.green}
                    >
                      Knew it
                    </Button>
                  </View>
                )}
              </>
            ) : (
              <>
                <Card style={styles.questionCard}>
                  <Card.Content>
                    {q.promptIsSynonym && (
                      <Text variant="labelMedium" style={styles.synonymBadge}>
                        SYNONYM OF
                      </Text>
                    )}
                    <Text
                      variant={type === 'mcq' ? 'displaySmall' : 'titleLarge'}
                      style={type === 'mcq' ? styles.flashWord : styles.sentence}
                    >
                      {q.prompt}
                    </Text>
                  </Card.Content>
                </Card>
                {q.options.map((opt, idx) => {
                  const isCorrect = answered !== null && idx === q.correctIndex;
                  const isWrongPick = answered === idx && idx !== q.correctIndex;
                  return (
                    <Pressable key={idx} onPress={() => answer(idx)}>
                      <Card
                        style={[
                          styles.option,
                          isCorrect && styles.optionCorrect,
                          isWrongPick && styles.optionWrong,
                        ]}
                      >
                        <Card.Content>
                          <Text variant="bodyLarge" style={styles.optionText}>
                            {opt}
                          </Text>
                        </Card.Content>
                      </Card>
                    </Pressable>
                  );
                })}
                {answered !== null && (
                  <Button mode="contained" onPress={next} style={styles.startBtn} contentStyle={styles.btnContent}>
                    {qIndex + 1 >= questions.length ? 'See results' : 'Next'}
                  </Button>
                )}
              </>
            )}
          </>
        )}

        {phase === 'done' && (
          <Card style={styles.resultCard}>
            <Card.Content style={styles.resultContent}>
              <Text variant="displayMedium" style={styles.resultScore}>
                {score}/{questions.length}
              </Text>
              <Text variant="titleMedium" style={styles.resultText}>
                {score === questions.length
                  ? 'Perfect round! 🏆'
                  : score >= questions.length / 2
                    ? 'Nice work — keep practicing!'
                    : 'Tough one. Revisit these words in Travel mode.'}
              </Text>
              <Button
                mode="contained"
                onPress={() => setPhase('setup')}
                style={styles.startBtn}
                contentStyle={styles.btnContent}
              >
                New quiz
              </Button>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title: { color: colors.text, fontWeight: '700', marginBottom: 12 },
  label: { color: colors.muted, marginTop: 16, marginBottom: 8 },
  notice: { color: colors.red, marginTop: 16 },
  startBtn: { marginTop: 20, borderRadius: 12 },
  btnContent: { paddingVertical: 6 },
  progress: { color: colors.muted, marginBottom: 12 },
  flashcard: { backgroundColor: colors.surface, minHeight: 220, justifyContent: 'center' },
  flashcardContent: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  flashWord: { color: colors.text, fontWeight: '700', textAlign: 'center' },
  flashBack: { color: colors.text, textAlign: 'center', lineHeight: 28 },
  flashHint: { color: colors.muted, textAlign: 'center' },
  synonymBadge: {
    color: colors.violet,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 4,
  },
  revealWord: { color: colors.primary, fontWeight: '700', textAlign: 'center' },
  tapHint: { color: colors.primary, marginTop: 12 },
  flashButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  questionCard: { backgroundColor: colors.surface, marginBottom: 16 },
  sentence: { color: colors.text, lineHeight: 30 },
  option: { backgroundColor: colors.surface, marginBottom: 8 },
  optionCorrect: { backgroundColor: colors.green + '33', borderWidth: 2, borderColor: colors.green },
  optionWrong: { backgroundColor: colors.red + '22', borderWidth: 2, borderColor: colors.red },
  optionText: { color: colors.text },
  resultCard: { backgroundColor: colors.surface, marginTop: 24 },
  resultContent: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  resultScore: { color: colors.primary, fontWeight: '700' },
  resultText: { color: colors.muted, textAlign: 'center' },
});
