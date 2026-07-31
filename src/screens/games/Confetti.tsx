import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';

const PALETTE = ['#F59E0B', '#F97316', '#EC4899', '#8B5CF6', '#38BDF8', '#34D399', '#FACC15'];

interface PieceSpec {
  x: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  round: boolean;
}

/**
 * Full-screen confetti rain built on the core Animated API (transform/opacity
 * only, so every particle runs on the native driver). Remount (via `key`) to
 * replay the burst.
 */
export default function Confetti({ count = 26 }: { count?: number }) {
  const { width, height } = useWindowDimensions();

  const pieces = useMemo<PieceSpec[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        size: 8 + Math.random() * 8,
        color: PALETTE[i % PALETTE.length],
        delay: Math.random() * 600,
        duration: 2200 + Math.random() * 1800,
        drift: (Math.random() - 0.5) * 160,
        spin: (Math.random() - 0.5) * 12,
        round: Math.random() < 0.35,
      })),
    [count, width]
  );

  const anims = useMemo(() => pieces.map(() => new Animated.Value(0)), [pieces]);

  useEffect(() => {
    const animations = anims.map((a, i) =>
      Animated.timing(a, {
        toValue: 1,
        duration: pieces[i].duration,
        delay: pieces[i].delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      })
    );
    Animated.parallel(animations).start();
    return () => animations.forEach((an) => an.stop());
  }, [anims, pieces]);

  return (
    <>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.piece,
            {
              left: p.x,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              borderRadius: p.round ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity: anims[i].interpolate({
                inputRange: [0, 0.75, 1],
                outputRange: [1, 1, 0],
              }),
              transform: [
                {
                  translateY: anims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [-40, height + 40],
                  }),
                },
                {
                  translateX: anims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, p.drift],
                  }),
                },
                {
                  rotate: anims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${p.spin * 60}deg`],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0 },
});
