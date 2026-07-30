import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { DarkTheme as NavDarkTheme, DefaultTheme as NavLightTheme } from '@react-navigation/native';

export interface AppColors {
  primary: string;
  primaryDark: string;
  violet: string;
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

// Difficulty/status accents stay the same in both themes.
const amber = '#F59E0B';
const green = '#10B981';
const red = '#EF4444';

export const lightColors: AppColors = {
  primary: '#4338CA',
  primaryDark: '#312E81',
  violet: '#7C3AED',
  background: '#FAF6EF',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EDE3',
  text: '#1E1B4B',
  muted: '#6B7280',
  amber,
  green,
  red,
  border: '#E7E2D8',
};

// Lifted from Jobmanch.ai's dark theme: surface-950/850/800, trust-500, ai-500.
export const darkColors: AppColors = {
  primary: '#6366F1',
  primaryDark: '#4338CA',
  violet: '#06B6D4',
  background: '#070A12',
  surface: '#0F1422',
  surfaceAlt: '#151B2B',
  text: '#F1F5F9',
  muted: '#9CA0AC',
  amber,
  green,
  red,
  border: '#222A3D',
};

export const difficultyColor: Record<string, string> = { easy: green, medium: amber, hard: red };

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
