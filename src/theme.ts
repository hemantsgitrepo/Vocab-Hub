import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { DarkTheme as NavDarkTheme, DefaultTheme as NavLightTheme } from '@react-navigation/native';

export interface AppColors {
  primary: string;
  primaryDark: string;
  violet: string;
  /** Soft sage green — calm accents, success states. */
  sage: string;
  /** Pale coral — warm accents, gentle warnings. */
  coral: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  amber: string;
  green: string;
  red: string;
  border: string;
}

// ---------------------------------------------------------------------------
// Sophisticated pastel palette.
// Light: cream paper, muted lavender ink, sage/coral accents.
// Dark: deep charcoal-slate (never pure black) with pastel glows.
// Text/primary pairs hold WCAG AA contrast for daily reading.
// ---------------------------------------------------------------------------

export const lightColors: AppColors = {
  primary: '#5D54B4', // deep muted lavender — 4.9:1 on white
  primaryDark: '#453E8C',
  violet: '#8B7ED4', // warm lavender accent
  sage: '#5E9C7C',
  coral: '#E08A72',
  background: '#FAF7F1', // warm cream
  surface: '#FFFFFF',
  surfaceAlt: '#F0EBE1',
  text: '#2B2840', // slate ink
  muted: '#6E6A80', // muted slate
  amber: '#DFA23F',
  green: '#4E9B6F', // sage-leaning success
  red: '#D96B57', // coral-leaning destructive
  border: '#E7E1D5',
};

export const darkColors: AppColors = {
  primary: '#9C93EC', // pastel lavender glow — reads on charcoal
  primaryDark: '#7A6FD0',
  violet: '#8FD0C0', // soft mint-sage glow
  sage: '#8CC9A6',
  coral: '#E8A18E',
  background: '#14161D', // deep charcoal slate
  surface: '#1C1F2A',
  surfaceAlt: '#252938',
  text: '#EDECF4',
  muted: '#9B99AB',
  amber: '#E5BB6E',
  green: '#82C9A0',
  red: '#E28E7E',
  border: '#2E3245',
};

export const difficultyColor: Record<string, string> = {
  easy: '#4E9B6F',
  medium: '#DFA23F',
  hard: '#D96B57',
};

export function paperThemeFor(colors: AppColors, dark: boolean) {
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    dark,
    colors: {
      ...base.colors,
      primary: colors.primary,
      secondary: colors.violet,
      background: colors.background,
      surface: colors.surface,
      surfaceVariant: colors.surfaceAlt,
      error: colors.red,
      onSurface: colors.text,
      outline: colors.border,
    },
  };
}

export function navThemeFor(colors: AppColors, dark: boolean) {
  const base = dark ? NavDarkTheme : NavLightTheme;
  return {
    ...base,
    dark,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };
}
