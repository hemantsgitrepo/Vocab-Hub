import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Layers } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import { playSfx } from '../lib/sfx';

// ---------------------------------------------------------------------------
// Inviting empty state: a softly floating pastel icon, a reason the screen is
// empty, and a single obvious action. Used wherever a screen has nothing to
// show yet because the collection is still small.
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  Icon?: typeof Layers;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Small print under the button, e.g. an unlock threshold reminder. */
  footnote?: string;
  /** Accent for the icon halo — defaults to the theme violet. */
  tint?: string;
}

export default function EmptyState({
  Icon = Layers,
  title,
  message,
  actionLabel,
  onAction,
  footnote,
  tint,
}: EmptyStateProps) {
  const { colors } = useAppTheme();
  const float = useMemo(() => new Animated.Value(0), []);
  const enter = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float, enter]);

  const styles = useMemo(() => makeStyles(colors), [colors]);
  const accent = tint ?? colors.violet;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: enter,
          transform: [
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.halo,
          {
            backgroundColor: accent + '1E',
            transform: [
              {
                translateY: float.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -9],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[styles.haloInner, { backgroundColor: accent + '26' }]}>
          <Icon size={30} color={accent} />
        </View>
      </Animated.View>

      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      <Text variant="bodyMedium" style={styles.message}>
        {message}
      </Text>

      {actionLabel && onAction && (
        <Pressable
          onPress={() => {
            playSfx('tap');
            onAction();
          }}
          accessibilityRole="button"
          style={styles.actionWrap}
        >
          {({ pressed }) => (
            <LinearGradient
              colors={[colors.primary, colors.violet]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.action, pressed && styles.pressed]}
            >
              <Text variant="titleSmall" style={styles.actionText}>
                {actionLabel}
              </Text>
            </LinearGradient>
          )}
        </Pressable>
      )}

      {!!footnote && (
        <Text variant="labelMedium" style={styles.footnote}>
          {footnote}
        </Text>
      )}
    </Animated.View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 26 },
    halo: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    haloInner: {
      width: 66,
      height: 66,
      borderRadius: 33,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { color: colors.text, fontWeight: '700', textAlign: 'center' },
    message: {
      color: colors.muted,
      textAlign: 'center',
      marginTop: 7,
      lineHeight: 20,
    },
    actionWrap: { marginTop: 20, alignSelf: 'stretch' },
    action: { borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
    actionText: { color: '#FFFFFF', fontWeight: '800' },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    footnote: { color: colors.muted, marginTop: 12, textAlign: 'center' },
  });
