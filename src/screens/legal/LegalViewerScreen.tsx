import React, { useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SegmentedButtons, Text } from 'react-native-paper';
import Markdown from 'react-native-markdown-display';
import { X } from 'lucide-react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../ThemeContext';
import { POLICIES, PolicyId } from './policies';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Which document to show first. */
  initial: PolicyId;
}

async function openLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch (err) {
    console.error('LINK_OPEN_ERROR', url, err);
  }
}

export default function LegalViewerScreen({ visible, onClose, initial }: Props) {
  const { colors } = useAppTheme();
  const [active, setActive] = useState<PolicyId>(initial);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const mdStyles = useMemo(() => makeMarkdownStyles(colors), [colors]);

  // Re-anchor to the row the user tapped each time the sheet is opened.
  const [lastInitial, setLastInitial] = useState(initial);
  if (visible && initial !== lastInitial) {
    setLastInitial(initial);
    setActive(initial);
  }

  const doc = POLICIES.find((p) => p.id === active) ?? POLICIES[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="headlineSmall" style={styles.title}>
              Legal &amp; Privacy
            </Text>
            <Text variant="bodySmall" style={styles.subtitle}>
              {doc.subtitle}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            style={styles.closeBtn}
          >
            <X size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          <SegmentedButtons
            value={active}
            onValueChange={(v) => setActive(v as PolicyId)}
            density="small"
            buttons={POLICIES.map((p) => ({
              value: p.id,
              label: p.tab,
              showSelectedCheck: false,
            }))}
          />
        </View>

        <ScrollView
          // Remounting per document resets scroll to the top on tab switch.
          key={doc.id}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <Markdown
            style={mdStyles}
            onLinkPress={(url) => {
              openLink(url);
              return false; // links are handled here, not by the library
            }}
          >
            {doc.markdown}
          </Markdown>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerText: { flex: 1 },
  title: { color: colors.text, fontWeight: '700' },
  subtitle: { color: colors.muted, marginTop: 2 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
});

/**
 * Markdown element styles. The library takes a plain style map keyed by
 * markdown-it token names, so theme colours are threaded through here rather
 * than inherited.
 */
const makeMarkdownStyles = (colors: AppColors) => ({
  body: { color: colors.text, fontSize: 15, lineHeight: 23 },
  heading1: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 31,
    marginBottom: 10,
  },
  heading2: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700' as const,
    lineHeight: 26,
    marginTop: 22,
    marginBottom: 8,
  },
  heading3: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    marginTop: 16,
    marginBottom: 6,
  },
  paragraph: { marginTop: 0, marginBottom: 12 },
  strong: { fontWeight: '700' as const, color: colors.text },
  em: { fontStyle: 'italic' as const },
  link: { color: colors.primary, textDecorationLine: 'underline' as const },
  bullet_list: { marginBottom: 12 },
  ordered_list: { marginBottom: 12 },
  list_item: { marginBottom: 6, flexDirection: 'row' as const },
  bullet_list_icon: { color: colors.primary, marginLeft: 4, marginRight: 10 },
  ordered_list_icon: { color: colors.primary, marginLeft: 4, marginRight: 10 },
  blockquote: {
    backgroundColor: colors.surfaceAlt,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 2,
    marginBottom: 14,
  },
  code_inline: {
    backgroundColor: colors.surfaceAlt,
    color: colors.primary,
    borderWidth: 0,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontSize: 13,
  },
  hr: { backgroundColor: colors.border, height: 1, marginVertical: 18 },
});
