// Shared visual identity for each arcade game, so the arcade card and the
// unlock celebration always agree on a game's colours and icon.
import { Blocks, Brain, Crown, Hexagon, Puzzle } from 'lucide-react-native';
import { GameKey } from '../../lib/games';

export const CARD_GRADIENTS: Record<GameKey, [string, string]> = {
  millionaire: ['#7C3AED', '#DB2777'],
  memory: ['#059669', '#0D9488'],
  scrabble: ['#D97706', '#B45309'],
  crossword: ['#2563EB', '#4F46E5'],
  bee: ['#EAB308', '#CA8A04'],
};

export const CARD_ICONS: Record<GameKey, typeof Crown> = {
  millionaire: Crown,
  memory: Brain,
  scrabble: Blocks,
  crossword: Puzzle,
  bee: Hexagon,
};
