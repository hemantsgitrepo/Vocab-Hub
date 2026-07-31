import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HelpCircle, X } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import { Guide } from '../lib/guides';
import { playSfx } from '../lib/sfx';

// ---------------------------------------------------------------------------
// "How it works" bottom sheet — a pastel, scrollable explainer any screen can
// open from a header `?` button. Animated with the core Animated API (same as
// the rest of the app) so it needs no extra native module.
// ---------------------------------------------------------------------------

interface InfoSheetProps {
  visible: boolean;
  onClose: () => void;
  guide: Guide;
}

export function InfoSheet({ visible, onClose, guide }: InfoSheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Keep the sheet mounted through its exit animation.
  const [mounted, setMounted] = useState(visible);
  const anim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        friction: 9,
        tension: 62,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 190,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // `mounted` is deliberately not a dependency — including it re-runs the
    // effect right after setMounted(true) and restarts the open animation.
  }, [visible, anim]);

  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Cycle pastel accents so consecutive steps read as distinct.
  const accents = [colors.violet, colors.sage, colors.coral, colors.primary, colors.amber];

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: anim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 18,
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [420, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.handle} />

          <LinearGradient
            colors={[colors.primary, colors.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerText}>
              <Text variant="titleLarge" style={styles.headerTitle}>
                {guide.title}
              </Text>
              <Text variant="bodySmall" style={styles.headerSub}>
                {guide.subtitle}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <X size={18} color="#FFFFFF" />
            </Pressable>
          </LinearGradient>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {guide.steps.map((step, i) => {
              const tint = accents[i % accents.length];
              return (
                <View key={step.title} style={styles.step}>
                  <View style={[styles.stepIcon, { backgroundColor: tint + '22' }]}>
                    <step.Icon size={19} color={tint} />
                  </View>
                  <View style={styles.stepText}>
                    <Text variant="titleSmall" style={styles.stepTitle}>
                      {step.title}
                    </Text>
                    <Text variant="bodySmall" style={styles.stepBody}>
                      {step.body}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <Pressable onPress={onClose} accessibilityRole="button">
            {({ pressed }) => (
              <LinearGradient
                colors={[colors.primary, colors.violet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.gotIt, pressed && styles.pressed]}
              >
                <Text variant="titleSmall" style={styles.gotItText}>
                  Got it
                </Text>
              </LinearGradient>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

export interface InfoButtonProps {
  onPress: () => void;
  label?: string;
  tint?: string;
  /** Styling for placement on a gradient/dark header rather than the page. */
  onDark?: boolean;
}

/** Circular `?` button for screen headers. */
export function InfoButton({
  onPress,
  label = 'How it works',
  tint,
  onDark = false,
}: InfoButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={() => {
        playSfx('tap');
        onPress();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.infoBtn,
        onDark && styles.infoBtnOnDark,
        pressed && styles.pressed,
      ]}
    >
      <HelpCircle size={20} color={tint ?? (onDark ? '#FFFFFF' : colors.primary)} />
    </Pressable>
  );
}

/** Convenience hook: `const help = useInfoSheet(GUIDE)` → `help.button`, `help.sheet`. */
export function useInfoSheet(
  guide: Guide,
  opts?: { tint?: string; onDark?: boolean }
) {
  const [open, setOpen] = useState(false);
  return {
    open,
    show: () => setOpen(true),
    hide: () => setOpen(false),
    button: (
      <InfoButton
        onPress={() => setOpen(true)}
        label={`How ${guide.title} works`}
        tint={opts?.tint}
        onDark={opts?.onDark}
      />
    ),
    sheet: <InfoSheet visible={open} onClose={() => setOpen(false)} guide={guide} />,
  };
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#000000A8',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 18,
      paddingTop: 10,
      maxHeight: '86%',
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      borderRadius: 22,
      padding: 18,
    },
    headerText: { flex: 1 },
    headerTitle: { color: '#FFFFFF', fontWeight: '800' },
    headerSub: { color: '#FFFFFFD8', marginTop: 3, lineHeight: 18 },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#FFFFFF2E',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: { marginTop: 4 },
    scrollContent: { paddingVertical: 14, gap: 16 },
    step: { flexDirection: 'row', gap: 13, alignItems: 'flex-start' },
    stepIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepText: { flex: 1 },
    stepTitle: { color: colors.text, fontWeight: '700' },
    stepBody: { color: colors.muted, marginTop: 3, lineHeight: 19 },
    gotIt: { borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
    gotItText: { color: '#FFFFFF', fontWeight: '800' },
    infoBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    infoBtnOnDark: { backgroundColor: '#FFFFFF2E' },
    pressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  });
