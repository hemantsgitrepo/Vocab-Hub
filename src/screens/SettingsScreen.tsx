import React, { useMemo, useState } from 'react';
import { Image, ImageSourcePropType, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Dialog, Divider, Portal, Snackbar, Switch, Text } from 'react-native-paper';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  Brain,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Globe,
  Headphones,
  Info,
  Minus,
  Moon,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
} from 'lucide-react-native';
import { useDailyGoal, useQuizSynonyms, useTravelFields } from '../hooks';
import { TRAVEL_FIELDS, TravelField } from '../db/settings';
import { fetchAllWords } from '../db/words';
import { CSV_TEMPLATE, ImportError, importWordsFromCsv, wordsToCsv } from '../db/csv';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';

const MIN_GOAL = 1;
const MAX_GOAL = 50;

const FEATURES = [
  {
    Icon: Headphones,
    title: 'Travel Audio Mode',
    body: 'Loop vocabulary audio hands-free while commuting.',
  },
  {
    Icon: Brain,
    title: 'Adaptive Quizzing',
    body: 'Practice active recall on learned words.',
  },
  {
    Icon: ShieldCheck,
    title: 'Offline First',
    body: 'Local storage with total privacy (built on WatermelonDB).',
  },
] as const;

const PARTNERS = [
  { name: 'Jobmanch.ai', url: 'https://jobmanch.ai', logo: require('../../assets/Jobmanch Logo.png') },
  { name: 'Upquarx.com', url: 'https://upquarx.com', logo: require('../../assets/Upquarx Logo.png') },
] as const;

async function openLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch (err) {
    console.error('LINK_OPEN_ERROR', url, err);
  }
}

function PartnerCard({
  name,
  url,
  logo,
  colors,
  styles,
}: {
  name: string;
  url: string;
  logo: ImageSourcePropType;
  colors: AppColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <Pressable
      onPress={() => openLink(url)}
      style={({ pressed }) => [styles.partnerCard, pressed && styles.partnerCardPressed]}
    >
      {logoFailed ? (
        <View style={styles.partnerLogoFallback}>
          <Globe size={22} color={colors.muted} />
        </View>
      ) : (
        <Image
          source={logo}
          style={styles.partnerLogo}
          resizeMode="contain"
          onError={() => setLogoFailed(true)}
        />
      )}
      <View style={styles.partnerLinkRow}>
        <Text variant="bodyMedium" style={styles.partnerLinkText}>
          {name.toLowerCase()}
        </Text>
        <ExternalLink size={13} color={colors.primary} />
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { colors, isDark, setDark } = useAppTheme();
  const [goal, setGoal] = useDailyGoal();
  const [travelFields, setTravelFields] = useTravelFields();
  // Same stored preference the Quiz setup screen uses; both re-read on focus.
  const [quizSynonyms, setQuizSynonyms] = useQuizSynonyms();
  const [busy, setBusy] = useState<'export' | 'template' | 'import' | null>(null);
  const [snack, setSnack] = useState('');
  const [importErrors, setImportErrors] = useState<ImportError[] | null>(null);

  const shareCsv = async (fileName: string, content: string, dialogTitle: string) => {
    const file = new File(Paths.cache, fileName);
    file.create({ overwrite: true });
    file.write(content);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle });
    } else {
      setSnack("Sharing isn't available on this device.");
    }
  };

  const exportWords = async () => {
    setBusy('export');
    try {
      const words = await fetchAllWords();
      if (words.length === 0) {
        setSnack("Add a word first — there's nothing to export yet.");
        return;
      }
      await shareCsv('vocab-hub-words.csv', wordsToCsv(words), 'Export Vocab Hub words');
    } catch (e) {
      console.error('CSV_EXPORT_ERROR', e);
      setSnack('Something went wrong while exporting.');
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = async () => {
    setBusy('template');
    try {
      await shareCsv('vocab-hub-template.csv', CSV_TEMPLATE, 'Vocab Hub CSV template');
    } catch (e) {
      console.error('CSV_TEMPLATE_ERROR', e);
      setSnack('Something went wrong while preparing the template.');
    } finally {
      setBusy(null);
    }
  };

  const importCsv = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    setBusy('import');
    try {
      const text = await new File(picked.assets[0].uri).text();
      const { imported, errors } = await importWordsFromCsv(text);
      if (errors.length > 0) {
        setImportErrors(errors);
      } else {
        setSnack(`Imported ${imported} word${imported === 1 ? '' : 's'}.`);
      }
    } catch (e) {
      console.error('CSV_IMPORT_ERROR', e);
      setSnack("Could not read that file — make sure it's a CSV file.");
    } finally {
      setBusy(null);
    }
  };

  const bump = (delta: number) => {
    const next = Math.min(MAX_GOAL, Math.max(MIN_GOAL, goal + delta));
    if (next !== goal) setGoal(next);
  };

  const toggleField = (key: TravelField) => {
    const next = travelFields.includes(key)
      ? travelFields.filter((f) => f !== key)
      : // Rebuilt from TRAVEL_FIELDS so playback order stays canonical.
        TRAVEL_FIELDS.map((f) => f.key).filter(
          (k) => k === key || travelFields.includes(k)
        );
    setTravelFields(next);
  };

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Settings
        </Text>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.goalHeader}>
              <Moon size={22} color={colors.primary} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Appearance
              </Text>
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.quizText}>
                <Text variant="bodyLarge" style={styles.fieldLabel}>
                  Dark mode
                </Text>
                <Text variant="bodySmall" style={styles.hint}>
                  Switch the app to a dark theme.
                </Text>
              </View>
              <Switch value={isDark} onValueChange={setDark} />
            </View>
          </Card.Content>
        </Card>

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
            <View style={styles.goalHeader}>
              <Headphones size={22} color={colors.primary} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Travel mode audio
              </Text>
            </View>
            <Text variant="bodyMedium" style={styles.hint}>
              Choose what gets read aloud for each word during a session.
            </Text>
            {TRAVEL_FIELDS.map((field, i) => (
              <View key={field.key}>
                {i > 0 && <Divider />}
                <View style={styles.fieldRow}>
                  <Text variant="bodyLarge" style={styles.fieldLabel}>
                    {field.label}
                  </Text>
                  <Switch
                    value={travelFields.includes(field.key)}
                    onValueChange={() => toggleField(field.key)}
                  />
                </View>
              </View>
            ))}
            {travelFields.length === 0 && (
              <Text variant="bodySmall" style={styles.warning}>
                Nothing selected — Travel mode has nothing to play.
              </Text>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.goalHeader}>
              <GraduationCap size={22} color={colors.primary} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Quiz
              </Text>
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.quizText}>
                <Text variant="bodyLarge" style={styles.fieldLabel}>
                  Ask with synonyms
                </Text>
                <Text variant="bodySmall" style={styles.hint}>
                  Shows a synonym instead of the word, so you recall it from a
                  related term.
                </Text>
              </View>
              <Switch value={quizSynonyms} onValueChange={setQuizSynonyms} />
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.goalHeader}>
              <FileText size={22} color={colors.primary} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Import &amp; export
              </Text>
            </View>
            <Text variant="bodyMedium" style={styles.hint}>
              Back up your words to a CSV file, or bring in words from a
              spreadsheet.
            </Text>
            <Button
              mode="outlined"
              icon={({ size, color }) => <Download size={size} color={color} />}
              onPress={exportWords}
              loading={busy === 'export'}
              disabled={busy !== null}
              style={styles.dataBtn}
            >
              Export words (CSV)
            </Button>
            <Button
              mode="outlined"
              icon={({ size, color }) => <FileText size={size} color={color} />}
              onPress={downloadTemplate}
              loading={busy === 'template'}
              disabled={busy !== null}
              style={styles.dataBtn}
            >
              Download CSV template
            </Button>
            <Button
              mode="contained-tonal"
              icon={({ size, color }) => <Upload size={size} color={color} />}
              onPress={importCsv}
              loading={busy === 'import'}
              disabled={busy !== null}
              style={styles.dataBtn}
            >
              Import words (CSV)
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.goalHeader}>
              <Info size={22} color={colors.primary} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                About Vocab Hub
              </Text>
            </View>
            <Text variant="bodyMedium" style={styles.aboutSubtitle}>
              Designed for ambitious learners and competitive exam aspirants
              building a high-impact vocabulary.
            </Text>

            <Divider style={styles.aboutDivider} />

            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <f.Icon size={18} color={colors.violet} />
                <View style={styles.featureText}>
                  <Text variant="bodyLarge" style={styles.featureTitle}>
                    {f.title}
                  </Text>
                  <Text variant="bodySmall" style={styles.hint}>
                    {f.body}
                  </Text>
                </View>
              </View>
            ))}

            <Divider style={styles.aboutDivider} />

            <View style={styles.visionRow}>
              <Sparkles size={16} color={colors.amber} />
              <Text variant="bodySmall" style={styles.visionText}>
                We are constantly evolving Vocab Hub with intelligent learning
                features—stay tuned for upcoming updates!
              </Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Developed &amp; Powered By
            </Text>
            <View style={styles.partnersRow}>
              {PARTNERS.map((p) => (
                <PartnerCard key={p.name} {...p} colors={colors} styles={styles} />
              ))}
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      <Portal>
        <Dialog visible={importErrors !== null} onDismiss={() => setImportErrors(null)}>
          <Dialog.Icon icon={({ size }) => <FileText size={size} color={colors.red} />} />
          <Dialog.Title style={styles.dialogTitle}>
            {importErrors?.length === 1
              ? '1 problem found in your file'
              : `${importErrors?.length ?? 0} problems found in your file`}
          </Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView contentContainerStyle={styles.dialogScrollContent}>
              <Text variant="bodyMedium" style={styles.dialogIntro}>
                Nothing was imported. Fix the issues below in your spreadsheet
                and try again.
              </Text>
              {importErrors?.map((err, i) => (
                <View key={i} style={styles.errorRow}>
                  <Text variant="labelMedium" style={styles.errorRowNum}>
                    Row {err.row}
                  </Text>
                  <Text variant="bodyMedium" style={styles.errorMessage}>
                    {err.message}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setImportErrors(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={3000}>
        {snack}
      </Snackbar>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
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
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  fieldLabel: { color: colors.text },
  quizText: { flex: 1, paddingRight: 12 },
  warning: { color: colors.red, marginTop: 8 },
  aboutSubtitle: { color: colors.muted, lineHeight: 20, marginTop: 4 },
  aboutDivider: { backgroundColor: colors.border, marginVertical: 14 },
  featureRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 14 },
  featureText: { flex: 1 },
  featureTitle: { color: colors.text, fontWeight: '600' },
  visionRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  visionText: { flex: 1, color: colors.muted, fontStyle: 'italic', lineHeight: 18 },
  partnersRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  partnerCard: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  partnerCardPressed: { opacity: 0.7 },
  partnerLogo: { width: 100, height: 40 },
  partnerLogoFallback: { width: 100, height: 40, alignItems: 'center', justifyContent: 'center' },
  partnerLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  partnerLinkText: { color: colors.primary, fontWeight: '600' },
  dataBtn: { marginTop: 12 },
  dialogTitle: { color: colors.text, textAlign: 'center' },
  dialogScrollArea: { maxHeight: 340, paddingHorizontal: 0 },
  dialogScrollContent: { paddingHorizontal: 24, paddingBottom: 8 },
  dialogIntro: { color: colors.muted, marginBottom: 12, lineHeight: 20 },
  errorRow: { marginBottom: 12 },
  errorRowNum: { color: colors.red, fontWeight: '700', marginBottom: 2 },
  errorMessage: { color: colors.text, lineHeight: 20 },
});
