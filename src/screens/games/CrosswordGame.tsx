import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Vibration,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Delete, HelpCircle, Puzzle, RotateCcw, Sparkles, Trophy, X } from 'lucide-react-native';
import { GAME_GUIDES } from '../../lib/guides';
import { InfoSheet } from '../../ui/InfoSheet';
import Word from '../../db/models/Word';
import Confetti from './Confetti';
import { getGameStat, setGameStat } from '../../db/settings';
import { playSfx } from '../../lib/sfx';
import { CrosswordPuzzle, CrosswordWord, buildCrossword } from '../../lib/games';

// Blueprint-blue newsroom palette.
const C = {
  bgTop: '#0B1F44',
  bgBottom: '#040B1D',
  cell: '#12295C',
  cellBorder: '#274680',
  cellActiveWord: '#1D3C7F',
  cellCursor: '#3B82F6',
  solved: '#123B23',
  solvedBorder: '#34D399',
  text: '#EAF1FF',
  ink: '#FFFFFF',
  muted: '#8FA6D4',
  blue: '#60A5FA',
  gold: '#FBBF24',
  red: '#F87171',
  keyBg: '#16305F',
  keyBorder: '#2C4C8C',
};

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

interface Props {
  visible: boolean;
  onClose: () => void;
  words: Word[];
}

const keyOf = (r: number, c: number) => `${r},${c}`;

export default function CrosswordGame({ visible, onClose, words }: Props) {
  const { width } = useWindowDimensions();

  const [puzzle, setPuzzle] = useState<CrosswordPuzzle | null>(null);
  const [entries, setEntries] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState(0); // index into puzzle.words
  const [cursor, setCursor] = useState(0); // letter index within selected word
  const [solved, setSolved] = useState<Set<number>>(new Set());
  const [won, setWon] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const shakeAnim = useMemo(() => new Animated.Value(0), []);
  const clueAnim = useMemo(() => new Animated.Value(1), []);
  const resultAnim = useMemo(() => new Animated.Value(0), []);

  const newPuzzle = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPuzzle(buildCrossword(words));
    setEntries(new Map());
    setSelected(0);
    setCursor(0);
    setSolved(new Set());
    setWon(false);
  };

  useEffect(() => {
    if (!visible) return;
    getGameStat('crossword').then(setSolvedCount);
    newPuzzle();
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Pop the clue card whenever the selection changes.
  useEffect(() => {
    clueAnim.setValue(0.85);
    Animated.spring(clueAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  }, [selected, clueAnim]);

  if (!puzzle) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <LinearGradient colors={[C.bgTop, C.bgBottom]} style={styles.bg}>
          <SafeAreaView style={styles.centerFill}>
            <Puzzle size={40} color={C.muted} />
            <Text variant="titleMedium" style={{ color: C.text, textAlign: 'center' }}>
              Couldn't weave a crossword from your words yet.{'\n'}Add a few more
              short words and try again!
            </Text>
            <Pressable onPress={onClose}>
              <Text variant="labelLarge" style={styles.exitText}>
                Close
              </Text>
            </Pressable>
          </SafeAreaView>
        </LinearGradient>
      </Modal>
    );
  }

  const sel = puzzle.words[selected];

  const cellsOf = (w: CrosswordWord): [number, number][] =>
    Array.from({ length: w.word.length }, (_, i) => [
      w.row + (w.dir === 'down' ? i : 0),
      w.col + (w.dir === 'across' ? i : 0),
    ]);

  // Which words pass through a cell?
  const wordsAt = (r: number, c: number): number[] =>
    puzzle.words
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => cellsOf(w).some(([rr, cc]) => rr === r && cc === c))
      .map(({ i }) => i);

  const usedCells = new Set(puzzle.words.flatMap((w) => cellsOf(w).map(([r, c]) => keyOf(r, c))));
  const selCells = new Set(cellsOf(sel).map(([r, c]) => keyOf(r, c)));
  const cursorCell = cellsOf(sel)[cursor];

  const tapCell = (r: number, c: number) => {
    const here = wordsAt(r, c);
    if (here.length === 0) return;
    playSfx('tap');
    let nextSel: number;
    if (here.includes(selected) && here.length > 1) {
      // Toggle to the crossing word on re-tap.
      nextSel = here.find((i) => i !== selected)!;
    } else if (here.includes(selected)) {
      nextSel = selected;
    } else {
      nextSel = here[0];
    }
    setSelected(nextSel);
    const cells = cellsOf(puzzle.words[nextSel]);
    setCursor(cells.findIndex(([rr, cc]) => rr === r && cc === c));
  };

  const checkWord = (idx: number, nextEntries: Map<string, string>) => {
    const w = puzzle.words[idx];
    const cells = cellsOf(w);
    const filled = cells.map(([r, c]) => nextEntries.get(keyOf(r, c)) ?? '');
    if (filled.some((l) => !l)) return;
    if (filled.join('') === w.word) {
      playSfx('success');
      Vibration.vibrate(30);
      const nextSolved = new Set(solved).add(idx);
      setSolved(nextSolved);
      if (nextSolved.size === puzzle.words.length) {
        timers.current.push(
          setTimeout(() => {
            setWon(true);
            playSfx('fanfare');
            Vibration.vibrate([0, 70, 70, 70, 70, 200]);
            resultAnim.setValue(0);
            Animated.spring(resultAnim, {
              toValue: 1,
              friction: 5,
              tension: 60,
              useNativeDriver: true,
            }).start();
            const n = solvedCount + 1;
            setSolvedCount(n);
            setGameStat('crossword', n);
          }, 500)
        );
      } else {
        // Hop to the next unsolved word for flow.
        const next = puzzle.words.findIndex((_, i) => !nextSolved.has(i));
        if (next >= 0) {
          setSelected(next);
          setCursor(0);
        }
      }
    } else {
      playSfx('error');
      Vibration.vibrate([0, 45, 40, 45]);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]).start();
    }
  };

  const typeLetter = (letter: string) => {
    if (won || solved.has(selected)) return;
    playSfx('tap');
    Vibration.vibrate(8);
    const cells = cellsOf(sel);
    const [r, c] = cells[cursor];
    const next = new Map(entries);
    next.set(keyOf(r, c), letter);
    setEntries(next);
    // Advance to the next empty cell in this word, else next cell.
    let adv = cursor + 1;
    while (adv < cells.length) {
      const [rr, cc] = cells[adv];
      if (!next.get(keyOf(rr, cc))) break;
      adv++;
    }
    setCursor(Math.min(adv, cells.length - 1));
    checkWord(selected, next);
  };

  const backspace = () => {
    if (won || solved.has(selected)) return;
    playSfx('tap');
    const cells = cellsOf(sel);
    const [r, c] = cells[cursor];
    const next = new Map(entries);
    if (next.get(keyOf(r, c))) {
      next.delete(keyOf(r, c));
      setEntries(next);
    } else if (cursor > 0) {
      const [pr, pc] = cells[cursor - 1];
      next.delete(keyOf(pr, pc));
      setEntries(next);
      setCursor(cursor - 1);
    }
  };

  // ----- Layout -----
  const H_PAD = 16;
  const cellSize = Math.floor((width - H_PAD * 2) / puzzle.size) - 2;
  const gridW = (cellSize + 2) * puzzle.size;

  const numberAt = (r: number, c: number): number | null => {
    const w = puzzle.words.find((w) => w.row === r && w.col === c);
    return w ? w.num : null;
  };

  const solvedCellSet = new Set(
    puzzle.words
      .filter((_, i) => solved.has(i))
      .flatMap((w) => cellsOf(w).map(([r, c]) => keyOf(r, c)))
  );

  const keyW = Math.floor((width - 12 * 2 - 9 * 5) / 10);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <LinearGradient colors={[C.bgTop, C.bgBottom]} style={styles.bg}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.headerBtn}>
              <X size={20} color={C.muted} />
            </Pressable>
            <Pressable
              onPress={() => {
                playSfx('tap');
                setHelpOpen(true);
              }}
              hitSlop={10}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="How Context Crossword works"
            >
              <HelpCircle size={18} color={C.muted} />
            </Pressable>
            <View style={styles.headerCenter}>
              <View style={styles.titleRow}>
                <Puzzle size={18} color={C.blue} />
                <Text variant="titleMedium" style={styles.title}>
                  Context Crossword
                </Text>
              </View>
              <Text variant="labelSmall" style={styles.subtitle}>
                {solved.size}/{puzzle.words.length} solved
                {solvedCount > 0 ? ` · ${solvedCount} completed all-time` : ''}
              </Text>
            </View>
            <Pressable onPress={newPuzzle} hitSlop={10} style={styles.headerBtn}>
              <RotateCcw size={18} color={C.muted} />
            </Pressable>
          </View>

          <InfoSheet
            visible={helpOpen}
            onClose={() => setHelpOpen(false)}
            guide={GAME_GUIDES.crossword}
          />

          {/* Grid */}
          <Animated.View
            style={[
              styles.gridWrap,
              {
                width: gridW,
                transform: [
                  {
                    translateX: shakeAnim.interpolate({
                      inputRange: [-1, 1],
                      outputRange: [-7, 7],
                    }),
                  },
                ],
              },
            ]}
          >
            {Array.from({ length: puzzle.size }, (_, r) => (
              <View key={r} style={styles.gridRow}>
                {Array.from({ length: puzzle.size }, (_, c) => {
                  const k = keyOf(r, c);
                  if (!usedCells.has(k)) {
                    return (
                      <View key={c} style={{ width: cellSize + 2, height: cellSize + 2 }} />
                    );
                  }
                  const isSolved = solvedCellSet.has(k);
                  const inSelWord = selCells.has(k);
                  const isCursor = cursorCell[0] === r && cursorCell[1] === c;
                  const num = numberAt(r, c);
                  return (
                    <Pressable key={c} onPress={() => tapCell(r, c)}>
                      <View
                        style={[
                          styles.cell,
                          { width: cellSize, height: cellSize },
                          inSelWord && styles.cellInWord,
                          isCursor && !isSolved && styles.cellCursor,
                          isSolved && styles.cellSolved,
                        ]}
                      >
                        {num !== null && <Text style={styles.cellNum}>{num}</Text>}
                        <Text
                          style={[
                            styles.cellLetter,
                            { fontSize: cellSize * 0.48 },
                            isSolved && { color: C.solvedBorder },
                          ]}
                        >
                          {entries.get(k) ?? ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Animated.View>

          {/* Clue card */}
          <Animated.View style={[styles.clueCard, { transform: [{ scale: clueAnim }] }]}>
            <Text variant="labelSmall" style={styles.clueKicker}>
              {sel.num} {sel.dir.toUpperCase()} · {sel.word.length} LETTERS
            </Text>
            <Text variant="bodyMedium" numberOfLines={3} style={styles.clueText}>
              {sel.clue}
            </Text>
          </Animated.View>

          {/* Keyboard */}
          <View style={styles.keyboard}>
            {KEY_ROWS.map((row, ri) => (
              <View key={ri} style={styles.keyRow}>
                {ri === 2 && <View style={{ width: keyW / 2 }} />}
                {row.split('').map((letter) => (
                  <Pressable key={letter} onPress={() => typeLetter(letter)}>
                    {({ pressed }) => (
                      <View
                        style={[styles.key, { width: keyW }, pressed && styles.keyPressed]}
                      >
                        <Text style={styles.keyText}>{letter}</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
                {ri === 2 && (
                  <Pressable onPress={backspace}>
                    {({ pressed }) => (
                      <View
                        style={[
                          styles.key,
                          { width: keyW * 1.5 },
                          pressed && styles.keyPressed,
                        ]}
                      >
                        <Delete size={18} color={C.text} />
                      </View>
                    )}
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          {/* Victory overlay */}
          {won && (
            <View style={styles.overlay}>
              <Animated.View
                style={[
                  styles.resultCard,
                  {
                    opacity: resultAnim,
                    transform: [
                      {
                        scale: resultAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.7, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.trophyHalo}>
                  <Trophy size={46} color={C.gold} fill={C.gold} />
                </View>
                <Text variant="headlineSmall" style={styles.resultTitle}>
                  Puzzle solved!
                </Text>
                <Text style={styles.resultScore}>
                  {puzzle.words.length}
                  <Text style={styles.resultUnit}> words woven</Text>
                </Text>
                <View style={styles.newBestChip}>
                  <Sparkles size={14} color={C.bgBottom} />
                  <Text variant="labelMedium" style={styles.newBestText}>
                    {solvedCount} PUZZLE{solvedCount === 1 ? '' : 'S'} COMPLETED
                  </Text>
                </View>
                <Text variant="bodyMedium" style={styles.resultBody}>
                  Recalling words from their context is the deepest kind of practice.
                </Text>
                <Pressable onPress={newPuzzle}>
                  <LinearGradient
                    colors={['#60A5FA', '#4F46E5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.againBtn}
                  >
                    <Puzzle size={18} color="#FFFFFF" />
                    <Text variant="titleMedium" style={styles.againText}>
                      New puzzle
                    </Text>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={onClose} hitSlop={8}>
                  <Text variant="labelLarge" style={styles.exitText}>
                    Back to studying
                  </Text>
                </Pressable>
              </Animated.View>
              <Confetti count={36} />
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1 },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  headerBtn: { width: 40, alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: C.text, fontWeight: '800' },
  subtitle: { color: C.muted, marginTop: 2 },
  gridWrap: { alignSelf: 'center', marginTop: 14 },
  gridRow: { flexDirection: 'row' },
  cell: {
    margin: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.cellBorder,
    backgroundColor: C.cell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInWord: { backgroundColor: C.cellActiveWord, borderColor: C.blue + '88' },
  cellCursor: { borderColor: C.cellCursor, borderWidth: 2.5 },
  cellSolved: { backgroundColor: C.solved, borderColor: C.solvedBorder },
  cellNum: {
    position: 'absolute',
    top: 1,
    left: 3,
    fontSize: 8,
    color: C.muted,
    fontWeight: '700',
  },
  cellLetter: { color: C.ink, fontWeight: '800' },
  clueCard: {
    backgroundColor: C.keyBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.keyBorder,
    marginHorizontal: 16,
    marginTop: 'auto',
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 68,
    justifyContent: 'center',
  },
  clueKicker: { color: C.blue, letterSpacing: 1, fontWeight: '800' },
  clueText: { color: C.text, marginTop: 3, lineHeight: 19 },
  keyboard: { paddingHorizontal: 12, paddingBottom: 10, gap: 7 },
  keyRow: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  key: {
    height: 44,
    borderRadius: 8,
    backgroundColor: C.keyBg,
    borderWidth: 1,
    borderColor: C.keyBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { backgroundColor: C.cellCursor, transform: [{ scale: 0.94 }] },
  keyText: { color: C.text, fontSize: 16, fontWeight: '700' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#040B1DEE',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resultCard: { alignItems: 'center' },
  trophyHalo: {
    backgroundColor: C.gold + '1A',
    borderRadius: 44,
    padding: 18,
    borderWidth: 1,
    borderColor: C.gold + '40',
    marginBottom: 12,
  },
  resultTitle: { color: C.text, fontWeight: '800' },
  resultScore: { color: C.blue, fontSize: 40, fontWeight: '800', marginTop: 4 },
  resultUnit: { fontSize: 16, color: C.muted },
  newBestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  newBestText: { color: C.bgBottom, fontWeight: '800', letterSpacing: 0.5 },
  resultBody: { color: C.muted, textAlign: 'center', marginTop: 10, lineHeight: 21 },
  againBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 26,
    paddingVertical: 13,
    paddingHorizontal: 28,
    marginTop: 22,
  },
  againText: { color: '#FFFFFF', fontWeight: '800' },
  exitText: { color: C.muted, marginTop: 16, textAlign: 'center' },
});
