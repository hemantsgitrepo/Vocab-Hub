import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowRight,
  BookOpen,
  Crown,
  Flame,
  Gamepad2,
  GraduationCap,
  Headphones,
  Layers,
  Radio,
  Sparkles,
  Target,
  Trophy,
  Wand2,
} from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import { playSfx } from '../lib/sfx';

// ---------------------------------------------------------------------------
// First-launch onboarding: three swipeable slides introducing the habit loop,
// Travel Mode and the quiz/arcade progression. Shown once — completion is
// persisted in settings so it never interrupts again.
// ---------------------------------------------------------------------------

interface Bullet {
  Icon: typeof Layers;
  text: string;
}

interface Slide {
  key: string;
  Icon: typeof Layers;
  gradient: [string, string];
  kicker: string;
  title: string;
  body: string;
  bullets: Bullet[];
}

const SLIDES: Slide[] = [
  {
    key: 'habit',
    Icon: Wand2,
    gradient: ['#5D54B4', '#8B7ED4'],
    kicker: 'BUILD THE HABIT',
    title: 'Five words a day,\nfilled in for you',
    body: 'Type a word and the dictionary does the rest — pronunciation, meaning, synonyms, antonyms, an example sentence and where the word came from.',
    bullets: [
      { Icon: Sparkles, text: 'Auto-fill from the free dictionary, no typing it all out' },
      { Icon: BookOpen, text: 'Origin and etymology captured with every word' },
      { Icon: Flame, text: 'Hit your daily goal to keep your streak alive' },
    ],
  },
  {
    key: 'travel',
    Icon: Headphones,
    gradient: ['#5E9C7C', '#8FD0C0'],
    kicker: 'LEARN HANDS-FREE',
    title: 'Your words,\nread aloud',
    body: 'Travel Mode plays your collection back-to-back so commutes, walks and washing-up turn into revision time. Everything runs on-device.',
    bullets: [
      { Icon: Radio, text: 'Continuous playback with natural pauses to recall' },
      { Icon: Target, text: 'Choose exactly which fields get spoken' },
      { Icon: Layers, text: 'Fully offline — no signal or streaming needed' },
    ],
  },
  {
    key: 'play',
    Icon: Gamepad2,
    gradient: ['#7C3AED', '#DB2777'],
    kicker: 'MAKE IT STICK',
    title: 'Quiz, then\nplay for it',
    body: 'Active recall locks words in. Quiz yourself three ways, and unlock a five-game arcade built entirely from the words you have added.',
    bullets: [
      { Icon: GraduationCap, text: 'Flashcards, meanings and fill-the-blank rounds' },
      { Icon: Crown, text: 'Millionaire, Memory Match, Scrabble, Crossword, Spelling Bee' },
      { Icon: Trophy, text: 'Each game unlocks as your collection grows' },
    ],
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isLast = index === SLIDES.length - 1;

  const goTo = (next: number) => {
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  };

  const handleNext = () => {
    playSfx('tap');
    if (isLast) onDone();
    else goTo(index + 1);
  };

  const handleSkip = () => {
    playSfx('tap');
    onDone();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Sparkles size={16} color={colors.violet} />
          <Text variant="labelLarge" style={styles.brand}>
            Vocab Hub
          </Text>
        </View>
        {!isLast && (
          <Pressable onPress={handleSkip} hitSlop={10} accessibilityRole="button">
            {({ pressed }) => (
              <Text variant="labelLarge" style={[styles.skip, pressed && styles.pressed]}>
                Skip
              </Text>
            )}
          </Pressable>
        )}
      </View>

      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
          listener: (e: any) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width)),
        })}
        scrollEventThrottle={16}
        style={styles.scroll}
      >
        {SLIDES.map((slide, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          return (
            <View key={slide.key} style={[styles.slide, { width }]}>
              <Animated.View
                style={[
                  styles.artWrap,
                  {
                    opacity: scrollX.interpolate({
                      inputRange,
                      outputRange: [0, 1, 0],
                      extrapolate: 'clamp',
                    }),
                    transform: [
                      {
                        scale: scrollX.interpolate({
                          inputRange,
                          outputRange: [0.76, 1, 0.76],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={[styles.artHalo, { backgroundColor: slide.gradient[0] + '1C' }]}>
                  <LinearGradient
                    colors={slide.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.artBadge}
                  >
                    <slide.Icon size={46} color="#FFFFFF" />
                  </LinearGradient>
                </View>
              </Animated.View>

              <Animated.View
                style={{
                  transform: [
                    {
                      translateY: scrollX.interpolate({
                        inputRange,
                        outputRange: [26, 0, 26],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                  opacity: scrollX.interpolate({
                    inputRange,
                    outputRange: [0, 1, 0],
                    extrapolate: 'clamp',
                  }),
                }}
              >
                <Text variant="labelMedium" style={[styles.kicker, { color: slide.gradient[0] }]}>
                  {slide.kicker}
                </Text>
                <Text variant="headlineMedium" style={styles.title}>
                  {slide.title}
                </Text>
                <Text variant="bodyMedium" style={styles.body}>
                  {slide.body}
                </Text>

                <View style={styles.bullets}>
                  {slide.bullets.map((b) => (
                    <View key={b.text} style={styles.bulletRow}>
                      <View
                        style={[
                          styles.bulletIcon,
                          { backgroundColor: slide.gradient[0] + '1E' },
                        ]}
                      >
                        <b.Icon size={15} color={slide.gradient[0]} />
                      </View>
                      <Text variant="bodySmall" style={styles.bulletText}>
                        {b.text}
                      </Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            </View>
          );
        })}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            return (
              <Animated.View
                key={s.key}
                style={[
                  styles.dot,
                  {
                    opacity: scrollX.interpolate({
                      inputRange,
                      outputRange: [0.3, 1, 0.3],
                      extrapolate: 'clamp',
                    }),
                    transform: [
                      {
                        // scaleX (not width) so the pill stays on the native driver.
                        scaleX: scrollX.interpolate({
                          inputRange,
                          outputRange: [1, 2.6, 1],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  },
                ]}
              />
            );
          })}
        </View>

        <Pressable onPress={handleNext} accessibilityRole="button" style={styles.ctaWrap}>
          {({ pressed }) => (
            <LinearGradient
              colors={[colors.primary, colors.violet]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.cta, pressed && styles.pressed]}
            >
              <Text variant="titleMedium" style={styles.ctaText}>
                {isLast ? 'Get started' : 'Next'}
              </Text>
              <ArrowRight size={19} color="#FFFFFF" />
            </LinearGradient>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 22,
      paddingTop: 8,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    brand: { color: colors.text, fontWeight: '800' },
    skip: { color: colors.muted, fontWeight: '700', padding: 6 },
    scroll: { flex: 1 },
    slide: { paddingHorizontal: 30, justifyContent: 'center' },
    artWrap: { alignItems: 'center', marginBottom: 34 },
    artHalo: {
      width: 168,
      height: 168,
      borderRadius: 84,
      alignItems: 'center',
      justifyContent: 'center',
    },
    artBadge: {
      width: 108,
      height: 108,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kicker: { fontWeight: '800', letterSpacing: 1.1 },
    title: { color: colors.text, fontWeight: '800', marginTop: 8, lineHeight: 36 },
    body: { color: colors.muted, marginTop: 12, lineHeight: 21 },
    bullets: { marginTop: 22, gap: 12 },
    bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    bulletIcon: {
      width: 30,
      height: 30,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bulletText: { color: colors.text, flex: 1, lineHeight: 18 },
    footer: { paddingHorizontal: 30, paddingBottom: 10, gap: 20 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    ctaWrap: { alignSelf: 'stretch' },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      borderRadius: 20,
      paddingVertical: 16,
    },
    ctaText: { color: '#FFFFFF', fontWeight: '800' },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  });
