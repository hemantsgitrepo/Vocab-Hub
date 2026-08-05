import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { ChevronLeft, ChevronRight, Snowflake } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';
import { CalendarCell, DayStatus, dayKey, effectiveDay, monthGrid } from '../lib/streakEngine';
import { playSfx } from '../lib/sfx';

// ---------------------------------------------------------------------------
// Monthly activity heatmap. Completed days fill with the streak gradient tint,
// freeze-protected days show a snowflake, genuine misses read as hollow, and
// days before the user ever started stay neutral so a new account doesn't look
// like a wall of failures.
// ---------------------------------------------------------------------------

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function StreakCalendar({
  counts,
  protectedDays,
  goal,
  firstActiveDay,
}: {
  counts: Map<string, number>;
  protectedDays: string[];
  goal: number;
  firstActiveDay: string | null;
}) {
  const { colors } = useAppTheme();
  const today = effectiveDay();
  const [offset, setOffset] = useState(0); // months back from the current one

  const shown = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [offset, today]);

  const cells = useMemo(
    () => monthGrid(shown.year, shown.month, counts, protectedDays, goal, firstActiveDay),
    [shown, counts, protectedDays, goal, firstActiveDay]
  );

  const fade = useMemo(() => new Animated.Value(1), []);
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [offset, fade]);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Leading blanks so the 1st lands under the right weekday.
  const lead = new Date(shown.year, shown.month, 1).getDay();
  const metCount = cells.filter((c) => c.status === 'met').length;
  const protCount = cells.filter((c) => c.status === 'protected').length;

  // Can't go earlier than the user's first word, or later than this month.
  const earliest = firstActiveDay ? new Date(firstActiveDay) : today;
  const maxOffset =
    (today.getFullYear() - earliest.getFullYear()) * 12 +
    (today.getMonth() - earliest.getMonth());

  const tint = (status: DayStatus) => {
    switch (status) {
      case 'met':
        return { backgroundColor: colors.amber, borderColor: colors.amber };
      case 'protected':
        return { backgroundColor: colors.primary + '2E', borderColor: colors.primary };
      case 'missed':
        return { backgroundColor: 'transparent', borderColor: colors.border };
      default:
        return { backgroundColor: colors.surfaceAlt, borderColor: 'transparent' };
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            playSfx('tap');
            setOffset((o) => Math.min(o + 1, Math.max(maxOffset, 0)));
          }}
          disabled={offset >= maxOffset}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={({ pressed }) => [
            styles.navBtn,
            offset >= maxOffset && styles.navDisabled,
            pressed && styles.pressed,
          ]}
        >
          <ChevronLeft size={18} color={colors.text} />
        </Pressable>

        <View style={styles.headerText}>
          <Text variant="titleSmall" style={styles.month}>
            {MONTHS[shown.month]} {shown.year}
          </Text>
          <Text variant="labelSmall" style={styles.summary}>
            {metCount} {metCount === 1 ? 'day' : 'days'} hit
            {protCount > 0 ? ` · ${protCount} protected` : ''}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            playSfx('tap');
            setOffset((o) => Math.max(o - 1, 0));
          }}
          disabled={offset === 0}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={({ pressed }) => [
            styles.navBtn,
            offset === 0 && styles.navDisabled,
            pressed && styles.pressed,
          ]}
        >
          <ChevronRight size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={`${d}${i}`} variant="labelSmall" style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      <Animated.View style={[styles.grid, { opacity: fade }]}>
        {Array.from({ length: lead }, (_, i) => (
          <View key={`lead${i}`} style={styles.cell} />
        ))}
        {cells.map((c) => (
          <Day key={c.key} cell={c} styles={styles} tint={tint(c.status)} colors={colors} />
        ))}
      </Animated.View>

      <View style={styles.legend}>
        <Legend styles={styles} swatch={{ backgroundColor: colors.amber }} label="Goal hit" />
        <Legend
          styles={styles}
          swatch={{ backgroundColor: colors.primary + '2E', borderWidth: 1.5, borderColor: colors.primary }}
          label="Freeze used"
        />
        <Legend
          styles={styles}
          swatch={{ borderWidth: 1.5, borderColor: colors.border }}
          label="Missed"
        />
      </View>
    </View>
  );
}

function Day({
  cell,
  styles,
  tint,
  colors,
}: {
  cell: CalendarCell;
  styles: ReturnType<typeof makeStyles>;
  tint: { backgroundColor: string; borderColor: string };
  colors: AppColors;
}) {
  const isFuture = cell.status === 'future';
  return (
    <View style={styles.cell}>
      <View
        style={[
          styles.day,
          { backgroundColor: tint.backgroundColor, borderColor: tint.borderColor },
          cell.status !== 'idle' && cell.status !== 'future' && styles.dayBordered,
          cell.isToday && { borderColor: colors.text, borderWidth: 2 },
        ]}
      >
        {cell.status === 'protected' ? (
          <Snowflake size={13} color={colors.primary} />
        ) : (
          <Text
            variant="labelSmall"
            style={[
              styles.dayNum,
              cell.status === 'met' && styles.dayNumMet,
              isFuture && styles.dayNumFuture,
            ]}
          >
            {cell.date.getDate()}
          </Text>
        )}
      </View>
    </View>
  );
}

function Legend({
  styles,
  swatch,
  label,
}: {
  styles: ReturnType<typeof makeStyles>;
  swatch: object;
  label: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, swatch]} />
      <Text variant="labelSmall" style={styles.legendText}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginTop: 12,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerText: { flex: 1, alignItems: 'center' },
    month: { color: colors.text, fontWeight: '800' },
    summary: { color: colors.muted, marginTop: 1 },
    navBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    navDisabled: { opacity: 0.35 },
    pressed: { opacity: 0.7 },
    weekRow: { flexDirection: 'row', marginTop: 12, marginBottom: 4 },
    weekday: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      color: colors.muted,
      fontWeight: '700',
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
    day: {
      flex: 1,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayBordered: { borderWidth: 1.5 },
    dayNum: { color: colors.muted, fontWeight: '700' },
    dayNumMet: { color: '#FFFFFF' },
    dayNumFuture: { color: colors.muted, opacity: 0.4 },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      marginTop: 12,
      justifyContent: 'center',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendSwatch: { width: 12, height: 12, borderRadius: 4 },
    legendText: { color: colors.muted },
  });
