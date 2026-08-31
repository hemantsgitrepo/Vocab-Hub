import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, Database, FileText, ShieldCheck, Sparkles } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import { playSfx } from '../lib/sfx';
import LegalViewerScreen from './legal/LegalViewerScreen';
import { PolicyId } from './legal/policies';

// ---------------------------------------------------------------------------
// First-launch, non-bypassable consent gate. Sits in front of the onboarding
// carousel: shown once, persisted via `settings.consentAccepted`, and skipped
// entirely on later launches. Reject cannot dismiss the app (RN has no clean
// cross-platform "quit" API and force-closing would be a bad pattern anyway)
// — it instead explains that continuing requires agreement and offers a way
// back into the same screen.
// ---------------------------------------------------------------------------

interface Props {
  onAccept: () => void;
}

const DATA_POINTS = [
  {
    Icon: Database,
    text: 'Your words, quiz scores and progress are stored locally on this device.',
  },
  {
    Icon: ShieldCheck,
    text: 'No account is required to use the core app — nothing leaves your device unless you opt into a feature that needs it.',
  },
  {
    Icon: FileText,
    text: 'Full detail on what is collected and why is in the Privacy Policy below.',
  },
];

export default function ConsentScreen({ onAccept }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [legalDoc, setLegalDoc] = useState<PolicyId | null>(null);
  const [rejected, setRejected] = useState(false);

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  if (rejected) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.rejectedWrap}>
          <ShieldCheck size={40} color={colors.muted} />
          <Text variant="titleLarge" style={styles.rejectedTitle}>
            Consent required
          </Text>
          <Text variant="bodyMedium" style={styles.rejectedBody}>
            Vocab Hub can't be used without agreeing to the Terms of Service and
            Privacy Policy. You're welcome to review them again below.
          </Text>
          <Pressable
            onPress={() => {
              playSfx('tap');
              setRejected(false);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.reviewAgainBtn, pressed && styles.pressed]}
          >
            <Text variant="titleSmall" style={styles.reviewAgainText}>
              Review again
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View
          style={{
            opacity: enter,
            transform: [
              { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
            ],
          }}
        >
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/logo-mark.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text variant="headlineMedium" style={styles.brand}>
              Vocab Hub
            </Text>
          </View>
          <Text variant="bodyMedium" style={styles.tagline}>
            An offline-first vocabulary trainer that fills in pronunciation,
            meaning and examples for every word you add.
          </Text>
        </Animated.View>

        <LinearGradient
          colors={[colors.primary, colors.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Sparkles size={22} color="#FFFFFF" />
          <Text variant="titleMedium" style={styles.heroTitle}>
            Before you start
          </Text>
          <Text variant="bodySmall" style={styles.heroBody}>
            Please review how Vocab Hub handles your data.
          </Text>
        </LinearGradient>

        {DATA_POINTS.map((d) => (
          <View key={d.text} style={styles.pointRow}>
            <View style={styles.pointIcon}>
              <d.Icon size={18} color={colors.primary} />
            </View>
            <Text variant="bodyMedium" style={styles.pointText}>
              {d.text}
            </Text>
          </View>
        ))}

        <View style={styles.linksRow}>
          <Pressable
            onPress={() => {
              playSfx('tap');
              setLegalDoc('terms');
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
          >
            <FileText size={16} color={colors.primary} />
            <Text variant="labelLarge" style={styles.linkText}>
              Terms of Service
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              playSfx('tap');
              setLegalDoc('privacy');
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
          >
            <ShieldCheck size={16} color={colors.primary} />
            <Text variant="labelLarge" style={styles.linkText}>
              Privacy Policy
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            playSfx('tap');
            onAccept();
          }}
          accessibilityRole="button"
          accessibilityLabel="Agree and continue"
          style={({ pressed }) => [styles.acceptWrap, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={[colors.primary, colors.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.acceptBtn}
          >
            <CheckCircle2 size={19} color="#FFFFFF" />
            <Text variant="titleMedium" style={styles.acceptText}>
              Agree &amp; Continue
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={() => {
            playSfx('tap');
            setRejected(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Reject"
          style={({ pressed }) => [styles.rejectBtn, pressed && styles.pressed]}
        >
          <Text variant="labelLarge" style={styles.rejectText}>
            Reject
          </Text>
        </Pressable>
      </ScrollView>

      <LegalViewerScreen
        visible={legalDoc !== null}
        initial={legalDoc ?? 'terms'}
        onClose={() => setLegalDoc(null)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 32 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    logo: { width: 34, height: 34 },
    brand: { color: colors.text, fontWeight: '800' },
    tagline: { color: colors.muted, marginTop: 8, lineHeight: 20 },
    hero: { borderRadius: 20, padding: 18, marginTop: 20 },
    heroTitle: { color: '#FFFFFF', fontWeight: '800', marginTop: 8 },
    heroBody: { color: '#FFFFFFD8', marginTop: 4 },
    pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 16 },
    pointIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primary + '1A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pointText: { color: colors.text, flex: 1, lineHeight: 20 },
    linksRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
    linkBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: 12,
      backgroundColor: colors.surface,
    },
    linkText: { color: colors.primary, fontWeight: '700' },
    acceptWrap: { marginTop: 26 },
    acceptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 20,
      paddingVertical: 16,
    },
    acceptText: { color: '#FFFFFF', fontWeight: '800' },
    pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
    rejectBtn: { marginTop: 14, alignItems: 'center', padding: 8 },
    rejectText: { color: colors.muted, fontWeight: '700' },
    rejectedWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    rejectedTitle: { color: colors.text, fontWeight: '700' },
    rejectedBody: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
    reviewAgainBtn: {
      marginTop: 8,
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    reviewAgainText: { color: colors.primary, fontWeight: '700' },
  });
