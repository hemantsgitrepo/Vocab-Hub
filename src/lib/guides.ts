// Copy for the "How it works" info sheets. Kept in one place so the wording
// stays consistent and every screen pulls from the same source of truth.
import {
  Blocks,
  BookOpen,
  Brain,
  Crown,
  Flame,
  Gauge,
  Hexagon,
  Layers,
  Lightbulb,
  ListOrdered,
  Lock,
  PenLine,
  Puzzle,
  Repeat,
  Scissors,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  Trophy,
} from 'lucide-react-native';
import { GameKey } from './games';

export interface GuideStep {
  Icon: typeof Layers;
  title: string;
  body: string;
}

export interface Guide {
  title: string;
  subtitle: string;
  steps: GuideStep[];
}

export const TRAVEL_GUIDE: Guide = {
  title: 'Travel Mode',
  subtitle: 'Hands-free listening for commutes, walks and chores.',
  steps: [
    {
      Icon: ListOrdered,
      title: 'One word at a time, in order',
      body: 'Each word is spoken field by field — word, meaning, synonyms, antonyms, example, then the layman’s explanation. There’s a short pause between fields and a longer one between words, so you have time to recall before the answer arrives.',
    },
    {
      Icon: SlidersHorizontal,
      title: 'Choose what gets read',
      body: 'Settings → Travel fields controls which of the six fields are spoken. Turn off the ones you already know cold and the playlist gets shorter. Changes apply mid-session — no need to restart playback.',
    },
    {
      Icon: Gauge,
      title: 'Tune the voice',
      body: 'Speed (0.8x / 1x / 1.25x) and pitch (low / mid / high) adjust the on-device voice. Nothing is streamed or downloaded — playback is fully offline.',
    },
    {
      Icon: Repeat,
      title: 'Pick a playlist, then loop it',
      body: 'Tap words to include or exclude them, or use Select all. Loop restarts the playlist when it ends, and Skip jumps to the next word without stopping the session.',
    },
  ],
};

export const QUIZ_GUIDE: Guide = {
  title: 'Quiz Arena',
  subtitle: 'Active recall turns learned words into owned words.',
  steps: [
    {
      Icon: Layers,
      title: 'Three ways to test yourself',
      body: 'Flashcards flip so you can self-grade honestly. Meanings asks you to pick the right definition from four. Fill the blank drops the word out of its own example sentence.',
    },
    {
      Icon: BookOpen,
      title: 'Prompt with synonyms or antonyms',
      body: 'In Settings you can have quizzes prompt with a synonym or an antonym instead of the word itself — a harder recall path once the basics feel easy.',
    },
    {
      Icon: Target,
      title: 'Quiz a time window',
      body: 'Words from All time, Past 7 days or Past 30 days. The recent windows are the fastest way to check whether this week’s additions actually stuck.',
    },
    {
      Icon: Flame,
      title: 'How the streak works',
      body: 'Your streak counts consecutive days where you added at least your daily goal of new words (5 by default, configurable in Settings). It tracks words added, not quizzes taken — so quizzing never puts your streak at risk.',
    },
    {
      Icon: Trophy,
      title: 'Scoring',
      body: 'Each round scores as a percentage of correct answers. Land 80% or higher and the result screen celebrates properly.',
    },
  ],
};

export const GAME_GUIDES: Record<GameKey, Guide> = {
  millionaire: {
    title: 'Vocab Millionaire',
    subtitle: '15 questions. One shot at 1,000,000 points.',
    steps: [
      {
        Icon: Crown,
        title: 'Climb the ladder',
        body: 'Fifteen questions, each worth more than the last — 100 points at the bottom, 1,000,000 at the top. Every question shows four meanings and exactly one is right. Questions are ordered easiest first.',
      },
      {
        Icon: Shield,
        title: 'Safe havens bank your score',
        body: 'Clear question 5 and 1,000 points are yours to keep. Clear question 10 and 32,000 points are locked in. A wrong answer after that drops you to your last banked total instead of zero.',
      },
      {
        Icon: Scissors,
        title: 'Three lifelines, once each',
        body: '50:50 strikes out two wrong answers. Hint and Clue each reveal a different angle on the word. Spend them on the questions that genuinely stump you.',
      },
    ],
  },
  memory: {
    title: 'Memory Match',
    subtitle: 'Flip the grid, pair every word with its match.',
    steps: [
      {
        Icon: Brain,
        title: 'Six pairs, twelve cards',
        body: 'Each round deals six random words from your collection. Every word is paired with its first synonym — or its meaning when it has no synonym recorded.',
      },
      {
        Icon: Sparkles,
        title: 'Flip two at a time',
        body: 'Tap two cards to reveal them. Match and they stay face up; miss and they flip back. Clear all six pairs to finish the board.',
      },
      {
        Icon: Trophy,
        title: 'Fewer moves is better',
        body: 'Your score is the number of moves taken, so a lower number is a better result. The board reshuffles every round — memorising positions won’t help you twice.',
      },
    ],
  },
  scrabble: {
    title: 'Vocab Scrabble',
    subtitle: 'Spell your words from a rack of 7 tiles.',
    steps: [
      {
        Icon: Blocks,
        title: 'Seven tiles, your words',
        body: 'Each rack is seeded from a real word in your collection, then padded with common letters. Only words you have actually added count as valid — this is a test of your own vocabulary, not a dictionary.',
      },
      {
        Icon: Star,
        title: 'Letters carry standard values',
        body: 'Scoring uses the classic Scrabble letter values: common letters like E, A and I are worth 1, while Q and Z are worth 10.',
      },
      {
        Icon: Sparkles,
        title: 'Hit the bonus slots',
        body: 'Two slots on the play row carry bonuses each round. DL and TL double or triple that single letter; DW and TW double or triple the whole word. Line your highest-value letter up with a letter bonus for the biggest score.',
      },
    ],
  },
  crossword: {
    title: 'Context Crossword',
    subtitle: 'A fresh mini crossword from your own words.',
    steps: [
      {
        Icon: Puzzle,
        title: 'Generated from your collection',
        body: 'Every puzzle is built on the spot from words you have added, crossed onto a 7×7 grid. No two puzzles are the same, and every answer is a word you have already studied.',
      },
      {
        Icon: Lightbulb,
        title: 'Clues come in three flavours',
        body: 'A clue may be the word’s own example sentence with the word blanked out, its plain meaning, or an “Opposite of…” prompt built from its antonym. The variety keeps you recalling rather than pattern-matching.',
      },
      {
        Icon: Trophy,
        title: 'Solve as many as you like',
        body: 'Your stat is the number of puzzles solved, so it climbs the more you play. Generate a fresh grid any time from the header.',
      },
    ],
  },
  bee: {
    title: 'Spelling Bee',
    subtitle: 'Seven hexes, one golden pangram.',
    steps: [
      {
        Icon: Hexagon,
        title: 'The centre letter is mandatory',
        body: 'Build words using the seven letters in the hive. Letters can repeat, but every valid answer must contain the centre letter.',
      },
      {
        Icon: BookOpen,
        title: 'Only your words count',
        body: 'Answers are drawn from the words in your collection that fit the hive — so the puzzle grows richer as your vocabulary does.',
      },
      {
        Icon: Star,
        title: 'Pangrams are worth chasing',
        body: 'A four-letter word scores 1 point; longer words score their length. Use all seven letters in one word — a pangram — and you bank a 7-point bonus on top.',
      },
    ],
  },
};

/** Unlock-teaser copy shown before a game is available. */
export const LOCKED_GUIDE_HINT: GuideStep = {
  Icon: Lock,
  title: 'Not unlocked yet',
  body: 'Keep adding words — this game opens automatically the moment you cross its threshold.',
};
