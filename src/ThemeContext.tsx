import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { AppColors, darkColors, lightColors, navThemeFor, paperThemeFor } from './theme';
import { ThemeMode, getThemeMode, setThemeMode } from './db/settings';

interface ThemeContextValue {
  colors: AppColors;
  isDark: boolean;
  /** The user's stored preference — 'system' follows the OS. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  paperTheme: ReturnType<typeof paperThemeFor>;
  navTheme: ReturnType<typeof navThemeFor>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    getThemeMode().then(setModeState);
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    setThemeMode(next);
  };

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';

  const value = useMemo<ThemeContextValue>(() => {
    const colors = isDark ? darkColors : lightColors;
    return {
      colors,
      isDark,
      mode,
      setMode,
      paperTheme: paperThemeFor(colors, isDark),
      navTheme: navThemeFor(colors, isDark),
    };
  }, [isDark, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider');
  return ctx;
}
