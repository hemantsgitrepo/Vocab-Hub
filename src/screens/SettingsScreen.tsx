import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  LayoutAnimation,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Dialog, Divider, Portal, Snackbar, Switch, Text } from 'react-native-paper';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Gamepad2,
  GraduationCap,
  Globe,
  Headphones,
  Info,
  Minus,
  Moon,
  MonitorSmartphone,
  Plus,
  ShieldCheck,
  Sun,
  Target,
  Upload,
} from 'lucide-react-native';
import {
  useDailyGoal,
  useGameSounds,
  useQuizAntonyms,
  useQuizSynonyms,
  useTravelFields,
} from '../hooks';
import { TRAVEL_FIELDS, ThemeMode, TravelField } from '../db/settings';
import { fetchAllWords } from '../db/words';
import { CSV_TEMPLATE, ImportError, importWordsFromCsv, wordsToCsv } from '../db/csv';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import LegalViewerScreen from './legal/LegalViewerScreen';
import { POLICIES, PolicyId } from './legal/policies';

const MIN_GOAL = 1;
const MAX_GOAL = 50;

/**
 * Short, consistent easing shared by every expand/collapse on this screen.
 * No opt-in call is needed — layout animations are always on under the New
 * Architecture, and `setLayoutAnimationEnabledExperimental` only warns there.
 */
const COLLAPSE_ANIM = {
  duration: 220,
  update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
} as const;

interface Partner {
  name: string;
  url: string;
  logo: ImageSourcePropType;
  /** Used on dark themes when the default asset lacks contrast there. */
  logoDark?: ImageSourcePropType;
}

// Logos are transparent PNGs, so they sit on any surface in either theme.
const PARTNERS: Partner[] = [
  { name: 'Jobmanch.ai', url: 'https://jobmanch.ai', logo: require('../../assets/Jobmanch Logo.png') },
  {
    name: 'Upquarx.com',
    url: 'https://upquarx.com',
    logo: require('../../assets/Upquarx Logo.png'),
    // This mark's black element would vanish against the dark charcoal surface.
    logoDark: require('../../assets/Upquarx Logo Dark.png'),
  },
];

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

const THEME_OPTIONS: { key: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { key: 'light', label: 'Light', Icon: Sun },
  { key: 'dark', label: 'Dark', Icon: Moon },
  { key: 'system', label: 'Auto', Icon: MonitorSmartphone },
];

/** Groups the cards below it, so related settings read as one block. */
function SectionLabel({
  children,
  styles,
}: {
  children: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Text
      variant="labelMedium"
      accessibilityRole="header"
      style={styles.sectionLabel}
    >
      {children}
    </Text>
  );
}

/**
 * A preference row where the whole row is the target, not just the switch.
 * The Switch is inert — the Pressable owns both the gesture and the
 * accessibility contract, so a screen reader hears one switch, not two.
 */
function SwitchRow({
  label,
  hint,
  value,
  onToggle,
  styles,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onToggle: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={() => {
        Vibration.vibrate(10);
        onToggle();
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.fieldRow, pressed && styles.rowPressed]}
    >
      <View style={styles.quizText}>
        <Text variant="bodyLarge" style={styles.fieldLabel}>
          {label}
        </Text>
        {hint ? (
          <Text variant="bodySmall" style={styles.hint}>
            {hint}
          </Text>
        ) : null}
      </View>
      <View pointerEvents="none">
        <Switch value={value} onValueChange={onToggle} />
      </View>
    </Pressable>
  );
}

/** Card whose header toggles its body, with a chevron that rotates to match. */
function CollapsibleCard({
  Icon,
  title,
  subtitle,
  expanded,
  onToggle,
  colors,
  styles,
  children,
}: {
  Icon: typeof Sun;
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  colors: AppColors;
  styles: ReturnType<typeof makeStyles>;
  children: React.ReactNode;
}) {
  const spin = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(spin, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [expanded, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Pressable
          onPress={() => {
            LayoutAnimation.configureNext(COLLAPSE_ANIM);
            onToggle();
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={title}
          accessibilityHint={expanded ? 'Collapses this section' : 'Expands this section'}
          style={({ pressed }) => [styles.collapseHeader, pressed && styles.rowPressed]}
        >
          <Icon size={22} color={colors.primary} />
          <View style={styles.collapseHeaderText}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="bodySmall" style={styles.hint}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <ChevronDown size={20} color={colors.muted} />
          </Animated.View>
        </Pressable>
        {expanded ? <View style={styles.collapseBody}>{children}</View> : null}
      </Card.Content>
    </Card>
  );
}

/** Theme option that eases into its selected state instead of snapping. */
function ThemeOption({
  label,
  Icon,
  active,
  onPress,
  colors,
  styles,
}: {
  label: string;
  Icon: typeof Sun;
  active: boolean;
  onPress: () => void;
  colors: AppColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const on = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(on, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 90,
    }).start();
  }, [active, on]);

  const scale = on.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <Animated.View style={[styles.flex, { transform: [{ scale }] }]}>
      <Pressable
        onPress={() => {
          Vibration.vibrate(10);
          onPress();
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${label} theme`}
        style={[styles.themeOption, active && styles.themeOptionActive]}
      >
        <Icon size={20} color={active ? colors.primary : colors.muted} />
        <Text
          variant="labelLarge"
          style={[styles.themeLabel, active && styles.themeLabelActive]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const { colors, isDark, mode, setMode } = useAppTheme();
  const [goal, setGoal] = useDailyGoal();
  const [travelFields, setTravelFields] = useTravelFields();
  // Same stored preferences the Quiz setup screen uses; both re-read on focus.
  const [quizSynonyms, setQuizSynonyms] = useQuizSynonyms();
  const [quizAntonyms, setQuizAntonyms] = useQuizAntonyms();
  const [gameSounds, setGameSoundsOn] = useGameSounds();
  const [busy, setBusy] = useState<'export' | 'template' | 'import' | null>(null);
  const [snack, setSnack] = useState('');
  const [importErrors, setImportErrors] = useState<ImportError[] | null>(null);
  const [legalDoc, setLegalDoc] = useState<PolicyId | null>(null);
  // Travel fields start open so the six toggles stay readable at a glance;
  // About starts closed because it is read-once reference material.
  const [travelOpen, setTravelOpen] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);

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
    if (next !== goal) {
      Vibration.vibrate(10);
      setGoal(next);
    }
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

        <SectionLabel styles={styles}>Appearance</SectionLabel>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.hint}>
              Pick a theme, or let Auto follow your device setting.
            </Text>
            <View
              style={styles.themeRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="App theme"
            >
              {THEME_OPTIONS.map(({ key, label, Icon }) => (
                <ThemeOption
                  key={key}
                  label={label}
                  Icon={Icon}
                  active={mode === key}
                  onPress={() => setMode(key)}
                  colors={colors}
                  styles={styles}
                />
              ))}
            </View>
          </Card.Content>
        </Card>

        <SectionLabel styles={styles}>Practice</SectionLabel>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.goalHeader}>
              <Target size={22} color={colors.primary} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Daily goal
              </Text>
            </View>
            <Text variant="bodyMedium" style={styles.hint}>
              How many new words you aim to add each day. Your streak counts days
              where you hit this number.
            </Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => bump(-1)}
                disabled={goal <= MIN_GOAL}
                accessibilityRole="button"
                accessibilityLabel="Decrease daily goal"
                accessibilityState={{ disabled: goal <= MIN_GOAL }}
                style={({ pressed }) => [
                  styles.stepBtn,
                  goal <= MIN_GOAL && styles.stepBtnDisabled,
                  pressed && styles.stepBtnPressed,
                ]}
              >
                <Minus size={22} color={goal <= MIN_GOAL ? colors.muted : colors.primary} />
              </Pressable>
              <Text
                variant="displaySmall"
                style={styles.goalNum}
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${goal} words per day`}
              >
                {goal}
              </Text>
              <Pressable
                onPress={() => bump(1)}
                disabled={goal >= MAX_GOAL}
                accessibilityRole="button"
                accessibilityLabel="Increase daily goal"
                accessibilityState={{ disabled: goal >= MAX_GOAL }}
                style={({ pressed }) => [
                  styles.stepBtn,
                  goal >= MAX_GOAL && styles.stepBtnDisabled,
                  pressed && styles.stepBtnPressed,
                ]}
              >
                <Plus size={22} color={goal >= MAX_GOAL ? colors.muted : colors.primary} />
              </Pressable>
            </View>
            <Text variant="labelMedium" style={styles.goalUnit} importantForAccessibility="no">
              words per day
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.goalHeader}>
              <GraduationCap size={22} color={colors.primary} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Quiz prompts
              </Text>
            </View>
            <SwitchRow
              label="Ask with synonyms"
              hint="Shows a synonym instead of the word, so you recall it from a related term."
              value={quizSynonyms}
              onToggle={() => setQuizSynonyms(!quizSynonyms)}
              styles={styles}
            />
            <Divider />
            <SwitchRow
              label="Ask with antonyms"
              hint="Shows an antonym instead of the word, so you recall it from its opposite."
              value={quizAntonyms}
              onToggle={() => setQuizAntonyms(!quizAntonyms)}
              styles={styles}
            />
          </Card.Content>
        </Card>

        <SectionLabel styles={styles}>Audio</SectionLabel>

        <CollapsibleCard
          Icon={Headphones}
          title="Travel mode fields"
          subtitle="What gets read aloud for each word."
          expanded={travelOpen}
          onToggle={() => setTravelOpen((v) => !v)}
          colors={colors}
          styles={styles}
        >
          {TRAVEL_FIELDS.map((field, i) => (
            <View key={field.key}>
              {i > 0 && <Divider />}
              <SwitchRow
                label={field.label}
                value={travelFields.includes(field.key)}
                onToggle={() => toggleField(field.key)}
                styles={styles}
              />
            </View>
          ))}
          {travelFields.length === 0 && (
            <Text variant="bodySmall" style={styles.warning}>
              Nothing selected — Travel mode has nothing to play.
            </Text>
          )}
        </CollapsibleCard>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.goalHeader}>
              <Gamepad2 size={22} color={colors.primary} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Game Arcade
              </Text>
            </View>
            <SwitchRow
              label="Sound effects"
              hint="Taps, chimes, and fanfares while playing arcade games."
              value={gameSounds}
              onToggle={() => setGameSoundsOn(!gameSounds)}
              styles={styles}
            />
          </Card.Content>
        </Card>

        <SectionLabel styles={styles}>Your data</SectionLabel>

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

        <SectionLabel styles={styles}>About</SectionLabel>

        <CollapsibleCard
          Icon={Info}
          title="About &amp; legal"
          subtitle="Terms, privacy and who builds Vocab Hub."
          expanded={aboutOpen}
          onToggle={() => setAboutOpen((v) => !v)}
          colors={colors}
          styles={styles}
        >
          {POLICIES.map((doc, i) => {
            const RowIcon = doc.id === 'terms' ? FileText : ShieldCheck;
            return (
              <React.Fragment key={doc.id}>
                {i > 0 && <Divider style={styles.legalDivider} />}
                <Pressable
                  onPress={() => setLegalDoc(doc.id)}
                  accessibilityRole="button"
                  accessibilityLabel={doc.title}
                  accessibilityHint={doc.subtitle}
                  style={({ pressed }) => [
                    styles.legalRow,
                    pressed && styles.legalRowPressed,
                  ]}
                >
                  <View style={styles.legalIcon}>
                    <RowIcon size={20} color={colors.primary} />
                  </View>
                  <View style={styles.legalText}>
                    <Text variant="bodyLarge" style={styles.featureTitle}>
                      {doc.title}
                    </Text>
                    <Text variant="bodySmall" style={styles.hint}>
                      {doc.subtitle}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.muted} />
                </Pressable>
              </React.Fragment>
            );
          })}

          <Divider style={styles.legalDivider} />
          <Text variant="labelMedium" style={styles.partnersLabel}>
            Developed &amp; powered by
          </Text>
          <View style={styles.partnersRow}>
            {PARTNERS.map(({ logoDark, ...p }) => (
              <PartnerCard
                key={p.name}
                {...p}
                logo={isDark && logoDark ? logoDark : p.logo}
                colors={colors}
                styles={styles}
              />
            ))}
          </View>
        </CollapsibleCard>
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

      <LegalViewerScreen
        visible={legalDoc !== null}
        initial={legalDoc ?? 'terms'}
        onClose={() => setLegalDoc(null)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title: { color: colors.text, fontWeight: '700', marginBottom: 4 },
  card: { backgroundColor: colors.surface, marginBottom: 12 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { color: colors.text, fontWeight: '600' },
  sectionLabel: {
    color: colors.muted,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  collapseHeaderText: { flex: 1 },
  collapseBody: { marginTop: 6 },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  stepBtnPressed: { backgroundColor: colors.surfaceAlt, transform: [{ scale: 0.94 }] },
  partnersLabel: { color: colors.muted, marginTop: 14 },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  legalRowPressed: { backgroundColor: colors.surfaceAlt },
  legalIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalText: { flex: 1 },
  legalDivider: { backgroundColor: colors.border },
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
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginHorizontal: -4,
    borderRadius: 10,
  },
  themeRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  themeOption: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  themeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '14',
  },
  themeLabel: { color: colors.muted, fontWeight: '700' },
  themeLabelActive: { color: colors.primary },
  fieldLabel: { color: colors.text },
  quizText: { flex: 1, paddingRight: 12 },
  warning: { color: colors.red, marginTop: 8 },
  featureTitle: { color: colors.text, fontWeight: '600' },
  partnersRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
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
