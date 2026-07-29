import { MD3LightTheme } from 'react-native-paper';
import { DefaultTheme } from '@react-navigation/native';

export const colors = {
  primary: '#4338CA',
  primaryDark: '#312E81',
  violet: '#7C3AED',
  background: '#FAF6EF',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EDE3',
  text: '#1E1B4B',
  muted: '#6B7280',
  amber: '#F59E0B',
  green: '#10B981',
  red: '#EF4444',
  border: '#E7E2D8',
};

export const difficultyColor: Record<string, string> = {
  easy: colors.green,
  medium: colors.amber,
  hard: colors.red,
};

export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
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

export const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};
